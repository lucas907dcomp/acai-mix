import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { queryClient } from '@/lib/queryClient'
import type { PaymentMethod, Shift } from '@/types'

interface ShiftState {
  activeShift: Shift | null
  isLoading: boolean
  error: string | null
  loadActiveShift: (locationId: string) => Promise<void>
  openShift: (locationId: string, openedBy: string) => Promise<void>
  closeShift: (closedBy: string) => Promise<void>
  updateTotals: (amount: number, paymentMethod: PaymentMethod) => void
  reverseTotals: (amount: number, paymentMethod: PaymentMethod) => void
  clearShift: () => void
  startPolling: (locationId: string) => void
  stopPolling: () => void
}

function getShiftNumber(): 1 | 2 {
  const hour = new Date().getHours()
  return hour < 16 ? 1 : 2
}

let _pollingInterval: ReturnType<typeof setInterval> | null = null

export const useShiftStore = create<ShiftState>()(
  persist(
    (set, get) => ({
      activeShift: null,
      isLoading: false,
      error: null,

      loadActiveShift: async (locationId) => {
        set({ isLoading: true, error: null })
        try {
          const { data, error } = await supabase
            .from('shifts')
            .select('*')
            .eq('status', 'open')
            .eq('location_id', locationId)
            .maybeSingle()

          if (error) throw error
          set({ activeShift: data as Shift | null })
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Erro ao carregar turno'
          set({ error: msg })
        } finally {
          set({ isLoading: false })
        }
      },

      openShift: async (locationId, openedBy) => {
        set({ isLoading: true, error: null })
        try {
          const { data, error } = await supabase
            .from('shifts')
            .insert({
              location_id: locationId,
              shift_number: getShiftNumber(),
              opened_by: openedBy,
            })
            .select()
            .single()

          if (error) throw error
          set({ activeShift: data as Shift })
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Erro ao abrir turno'
          set({ error: msg })
          throw err
        } finally {
          set({ isLoading: false })
        }
      },

      closeShift: async (closedBy) => {
        const { activeShift } = get()
        if (!activeShift) return

        set({ isLoading: true, error: null })
        try {
          const { error } = await supabase
            .from('shifts')
            .update({ status: 'closed', closed_at: new Date().toISOString(), closed_by: closedBy })
            .eq('id', activeShift.id)

          if (error) throw error
          set({ activeShift: null })
          queryClient.invalidateQueries({ queryKey: ['shift-history'] })
          queryClient.invalidateQueries({ queryKey: ['shift-sales'] })
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Erro ao fechar turno'
          set({ error: msg })
          throw err
        } finally {
          set({ isLoading: false })
        }
      },

      updateTotals: (amount, paymentMethod) => {
        const { activeShift } = get()
        if (!activeShift) return

        const isCard = paymentMethod === 'credit' || paymentMethod === 'debit'

        set({
          activeShift: {
            ...activeShift,
            sale_count: activeShift.sale_count + 1,
            total_sales: Math.round((activeShift.total_sales + amount) * 100) / 100,
            total_pix:
              paymentMethod === 'pix'
                ? Math.round((activeShift.total_pix + amount) * 100) / 100
                : activeShift.total_pix,
            total_card: isCard
              ? Math.round((activeShift.total_card + amount) * 100) / 100
              : activeShift.total_card,
            total_cash:
              paymentMethod === 'cash'
                ? Math.round((activeShift.total_cash + amount) * 100) / 100
                : activeShift.total_cash,
          },
        })
      },

      reverseTotals: (amount, paymentMethod) => {
        const { activeShift } = get()
        if (!activeShift) return
        const isCard = paymentMethod === 'credit' || paymentMethod === 'debit'
        set({
          activeShift: {
            ...activeShift,
            sale_count: Math.max(activeShift.sale_count - 1, 0),
            total_sales: Math.max(Math.round((activeShift.total_sales - amount) * 100) / 100, 0),
            total_pix:
              paymentMethod === 'pix'
                ? Math.max(Math.round((activeShift.total_pix - amount) * 100) / 100, 0)
                : activeShift.total_pix,
            total_card: isCard
              ? Math.max(Math.round((activeShift.total_card - amount) * 100) / 100, 0)
              : activeShift.total_card,
            total_cash:
              paymentMethod === 'cash'
                ? Math.max(Math.round((activeShift.total_cash - amount) * 100) / 100, 0)
                : activeShift.total_cash,
          },
        })
      },

      clearShift: () => set({ activeShift: null }),

      startPolling: (locationId: string) => {
        if (_pollingInterval) clearInterval(_pollingInterval)
        _pollingInterval = setInterval(async () => {
          const prevShift = get().activeShift
          try {
            await get().loadActiveShift(locationId)
          } catch {
            return
          }
          const nextShift = get().activeShift
          if (prevShift && !nextShift) {
            toast.info('Turno encerrado automaticamente. Inicie um novo turno para continuar.')
          }
        }, 60_000)
      },

      stopPolling: () => {
        if (_pollingInterval) {
          clearInterval(_pollingInterval)
          _pollingInterval = null
        }
      },
    }),
    {
      name: 'acaimix-shift',
      storage: {
        getItem: (key) => {
          const val = sessionStorage.getItem(key)
          return val ? JSON.parse(val) : null
        },
        setItem: (key, val) => sessionStorage.setItem(key, JSON.stringify(val)),
        removeItem: (key) => sessionStorage.removeItem(key),
      },
      partialize: (state) => ({ activeShift: state.activeShift }) as ShiftState,
    }
  )
)
