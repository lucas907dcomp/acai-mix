import { create } from 'zustand'
import { toast } from 'sonner'
import { getHours, getMinutes } from 'date-fns'
import { supabase } from '@/lib/supabase'
import { db } from '@/providers/sync/DexieDatabase'
import { useShiftStore } from '@/stores/shiftStore'
import { useAuthStore } from '@/stores/authStore'
import type { Sale, Shift } from '@/types'
import type { PendingSale, ProvisionalShift } from '@/providers/sync/DexieDatabase'

interface SyncState {
  isOnline: boolean
  pendingCount: number
  pendingSales: PendingSale[]
  isSyncing: boolean
  lastSoftCloseAt: number | null
  addPending: (sale: Sale) => Promise<void>
  cancelPending: (saleId: string) => Promise<void>
  drain: () => Promise<void>
  initListeners: () => void
  startClockWatch: () => void
  refreshPendingCount: () => Promise<void>
  _createProvisionalShift: (locationId: string) => Promise<void>
}

let _clockInterval: ReturnType<typeof setInterval> | null = null
let _listenersAttached = false

export const useSyncStore = create<SyncState>((set, get) => ({
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  pendingCount: 0,
  pendingSales: [],
  isSyncing: false,
  lastSoftCloseAt: null,

  refreshPendingCount: async () => {
    const unsyncedSales = await db.pending_sales.filter((s) => !s.synced).sortBy('created_at')
    set({ pendingCount: unsyncedSales.length, pendingSales: unsyncedSales })
  },

  addPending: async (sale: Sale) => {
    await db.pending_sales.add({
      ...sale,
      created_offline: true,
      synced: false,
      sync_attempts: 0,
    })
    await get().refreshPendingCount()
  },

  cancelPending: async (saleId: string) => {
    if (get().isSyncing) {
      toast.error('Sincronização em andamento. Aguarde e tente novamente.')
      return
    }
    const sale = await db.pending_sales.where('id').equals(saleId).first()
    if (!sale) return
    if (sale.synced) {
      toast.error('Esta venda já foi sincronizada. Cancele pelo Histórico de Vendas.')
      return
    }
    await db.pending_sales.where('id').equals(saleId).delete()
    useShiftStore.getState().reverseTotals(sale.amount, sale.payment_method)
    await get().refreshPendingCount()
    toast.success('Venda offline removida.')
  },

  _createProvisionalShift: async (locationId: string) => {
    const { activeShift } = useShiftStore.getState()
    if (!activeShift || activeShift.status === 'provisional') return

    const { profile } = useAuthStore.getState()
    const local_id = crypto.randomUUID()
    const newShiftNumber: 1 | 2 = activeShift.shift_number === 1 ? 2 : 1

    const ps: ProvisionalShift = {
      local_id,
      location_id: locationId,
      shift_number: newShiftNumber,
      opened_at: new Date().toISOString(),
      opened_by: profile?.id ?? 'system',
      status: 'provisional',
    }

    await db.provisional_shifts.add(ps)

    const provisionalAsShift: Shift = {
      id: local_id,
      location_id: locationId,
      shift_number: newShiftNumber,
      opened_at: ps.opened_at,
      opened_by: ps.opened_by,
      closed_at: null,
      closed_by: null,
      status: 'provisional',
      total_sales: 0,
      total_pix: 0,
      total_card: 0,
      total_cash: 0,
      sale_count: 0,
    }

    useShiftStore.setState({ activeShift: provisionalAsShift })
    set({ lastSoftCloseAt: getHours(new Date()) })
  },

  startClockWatch: () => {
    if (_clockInterval) return
    _clockInterval = setInterval(async () => {
      const { isOnline, lastSoftCloseAt } = get()
      if (isOnline) return

      const h = getHours(new Date())
      const m = getMinutes(new Date())
      const isCutoff = (h === 16 || h === 23) && m < 5

      if (!isCutoff || h === lastSoftCloseAt) return

      const { activeShift } = useShiftStore.getState()
      if (!activeShift || activeShift.status !== 'open') return

      await get()._createProvisionalShift(activeShift.location_id)
      toast.warning(
        'Turno virou enquanto offline. Vendas serão sincronizadas ao reconectar.',
        { duration: 8000 }
      )
    }, 30_000)
  },

  drain: async () => {
    if (get().isSyncing || !get().isOnline) return
    set({ isSyncing: true })

    try {
      // Step 1: sync provisional shifts before pending sales
      const provisionals = await db.provisional_shifts
        .where('status')
        .equals('provisional')
        .toArray()

      for (const ps of provisionals) {
        try {
          const { data, error } = await supabase
            .from('shifts')
            .insert({
              location_id: ps.location_id,
              shift_number: ps.shift_number,
              opened_by: ps.opened_by,
              opened_at: ps.opened_at,
            })
            .select()
            .single()

          if (error) throw error

          await db.provisional_shifts.update(ps.local_id, {
            status: 'synced',
            remote_id: data.id,
          })

          await db.pending_sales
            .where('shift_id')
            .equals(ps.local_id)
            .modify({ shift_id: data.id })

          const activeShift = useShiftStore.getState().activeShift
          if (activeShift?.id === ps.local_id) {
            useShiftStore.setState({
              activeShift: { ...activeShift, id: data.id, status: 'open' },
            })
          }
        } catch (err) {
          console.error('Error syncing provisional shift:', err)
        }
      }

      // Step 2: drain pending sales via Edge Function
      const batch = await db.pending_sales.filter((s) => !s.synced).sortBy('created_at')

      if (batch.length === 0) return

      const { data, error } = await supabase.functions.invoke('sync-sales', {
        body: { sales: batch },
      })

      if (error) throw error

      const result = data as {
        synced: number
        reconciled: number
        errors: Array<{ id: string; error: string }>
      }

      const errorIds = new Set((result.errors ?? []).map((e) => e.id))
      const now = new Date().toISOString()

      for (const sale of batch) {
        if (!errorIds.has(sale.id)) {
          await db.pending_sales.update(sale.local_id!, {
            synced: true,
            synced_at: now,
          })
        } else {
          const errMsg =
            result.errors.find((e) => e.id === sale.id)?.error ?? 'Erro desconhecido'
          await db.pending_sales.update(sale.local_id!, {
            sync_attempts: sale.sync_attempts + 1,
            last_sync_error: errMsg,
          })
        }
      }

      await get().refreshPendingCount()

      const syncedCount = batch.length - errorIds.size
      if (syncedCount > 0) {
        toast.success(`${syncedCount} venda(s) sincronizada(s).`)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('drain error:', msg)
      toast.error('Falha ao sincronizar vendas. Tentará novamente ao reconectar.')
    } finally {
      set({ isSyncing: false })
    }
  },

  initListeners: () => {
    if (typeof window === 'undefined') return

    if (_listenersAttached) {
      get().refreshPendingCount()
      return
    }
    _listenersAttached = true

    const handleOnline = async () => {
      set({ isOnline: true })
      await get().drain()
    }
    const handleOffline = () => set({ isOnline: false })

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    get().refreshPendingCount()
  },
}))
