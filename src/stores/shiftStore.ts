import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { supabase } from '@/lib/supabase'
import type { Shift } from '@/types'

interface ShiftState {
  activeShift: Shift | null
  isLoading: boolean
  error: string | null
  loadActiveShift: (locationId: string) => Promise<void>
  openShift: (locationId: string, openedBy: string) => Promise<void>
  closeShift: (closedBy: string) => Promise<void>
  updateTotals: (amount: number, paymentMethod: 'pix' | 'card' | 'cash') => void
  clearShift: () => void
}

function getShiftNumber(): 1 | 2 {
  const hour = new Date().getHours()
  return hour < 16 ? 1 : 2
}

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

        set({
          activeShift: {
            ...activeShift,
            sale_count: activeShift.sale_count + 1,
            total_sales: Math.round((activeShift.total_sales + amount) * 100) / 100,
            total_pix:
              paymentMethod === 'pix'
                ? Math.round((activeShift.total_pix + amount) * 100) / 100
                : activeShift.total_pix,
            total_card:
              paymentMethod === 'card'
                ? Math.round((activeShift.total_card + amount) * 100) / 100
                : activeShift.total_card,
            total_cash:
              paymentMethod === 'cash'
                ? Math.round((activeShift.total_cash + amount) * 100) / 100
                : activeShift.total_cash,
          },
        })
      },

      clearShift: () => set({ activeShift: null }),
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
