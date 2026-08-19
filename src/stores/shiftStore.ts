import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { queryClient } from '@/lib/queryClient'
import type { PaymentMethod, PaymentSplitItem, Shift } from '@/types'

interface ShiftState {
  activeShift: Shift | null
  isLoading: boolean
  error: string | null
  loadActiveShift: (locationId: string) => Promise<void>
  openShift: (locationId: string, openedBy: string) => Promise<void>
  closeShift: (closedBy: string) => Promise<void>
  updateTotals: (amount: number, paymentMethod: PaymentMethod) => void
  updateTotalsFromSplit: (amount: number, split: PaymentSplitItem[]) => void
  reverseTotals: (amount: number, paymentMethod: PaymentMethod) => void
  clearShift: () => void
  startPolling: (locationId: string) => void
  stopPolling: () => void
}

/** Hora de troca usada quando a loja não diz a sua — o valor de sempre. */
const HORA_TROCA_PADRAO = 16

export function getShiftNumber(horaTroca: number = HORA_TROCA_PADRAO): 1 | 2 {
  const hour = new Date().getHours()
  return hour < horaTroca ? 1 : 2
}

/**
 * Hora em que ESTA loja troca de turno (locations.shift_change_hour).
 *
 * Era 16 fixo aqui dentro, o que valia com uma loja só. A AçaiMix Barra troca
 * às 15h, e por isso um turno aberto à mão entre 15h e 16h lá nascia como
 * turno 1 quando já devia ser o 2.
 *
 * Qualquer falha cai em 16 — o comportamento anterior. Errar para o lado do
 * que já funcionava é melhor do que errar para um horário inventado.
 */
async function buscarHoraTroca(locationId: string): Promise<number> {
  try {
    const { data, error } = await supabase
      .from('locations')
      .select('shift_change_hour')
      .eq('id', locationId)
      .single()

    if (error) {
      console.warn('[Shift] Não consegui ler shift_change_hour, usando 16h:', error.message)
      return HORA_TROCA_PADRAO
    }

    const hora = (data as { shift_change_hour?: number } | null)?.shift_change_hour
    return typeof hora === 'number' && hora >= 0 && hora <= 23 ? hora : HORA_TROCA_PADRAO
  } catch {
    return HORA_TROCA_PADRAO
  }
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
            .order('opened_at', { ascending: false })
            .limit(1)
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
          const horaTroca = await buscarHoraTroca(locationId)
          const { data, error } = await supabase
            .from('shifts')
            .insert({
              location_id: locationId,
              shift_number: getShiftNumber(horaTroca),
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

      updateTotalsFromSplit: (amount, split) => {
        const { activeShift } = get()
        if (!activeShift) return
        const pix  = split.filter((s) => s.method === 'pix').reduce((a, s) => a + s.amount, 0)
        const card = split.filter((s) => s.method === 'credit' || s.method === 'debit').reduce((a, s) => a + s.amount, 0)
        const cash = split.filter((s) => s.method === 'cash').reduce((a, s) => a + s.amount, 0)
        set({
          activeShift: {
            ...activeShift,
            sale_count:  activeShift.sale_count + 1,
            total_sales: Math.round((activeShift.total_sales + amount) * 100) / 100,
            total_pix:   Math.round((activeShift.total_pix   + pix)    * 100) / 100,
            total_card:  Math.round((activeShift.total_card  + card)   * 100) / 100,
            total_cash:  Math.round((activeShift.total_cash  + cash)   * 100) / 100,
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
