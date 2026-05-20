import { create } from 'zustand'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { queryClient } from '@/lib/queryClient'
import { useAuthStore } from '@/stores/authStore'
import { useScaleStore } from '@/stores/scaleStore'
import { useShiftStore } from '@/stores/shiftStore'
import { useSyncStore } from '@/stores/syncStore'
import type { PaymentMethod, Sale } from '@/types'

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

interface SaleState {
  capturedWeightGrams: number | null
  pricePerGram: number | null
  amount: number | null
  paymentMethod: PaymentMethod | null
  amountReceived: number | null
  change: number | null
  isConfirming: boolean
  captureWeight: (grams: number, pricePerGram: number) => void
  setPaymentMethod: (method: PaymentMethod) => void
  setAmountReceived: (value: number) => void
  confirmSale: () => Promise<void>
  reset: () => void
}

export const useSaleStore = create<SaleState>((set, get) => ({
  capturedWeightGrams: null,
  pricePerGram: null,
  amount: null,
  paymentMethod: null,
  amountReceived: null,
  change: null,
  isConfirming: false,

  captureWeight: (grams, pricePerGram) => {
    const pricePerKgCents = Math.round(pricePerGram * 100_000)
    const amountCents = Math.round((grams * pricePerKgCents) / 1_000)
    const amount = amountCents / 100
    set({ capturedWeightGrams: grams, pricePerGram, amount })
  },

  setPaymentMethod: (method) => {
    set({ paymentMethod: method })
    if (method !== 'cash') {
      set({ amountReceived: null, change: null })
    }
  },

  setAmountReceived: (value) => {
    const { amount } = get()
    const change = amount !== null ? Math.round((value - amount) * 100) / 100 : null
    set({ amountReceived: value, change })
  },

  confirmSale: async () => {
    const state = get()
    if (!state.capturedWeightGrams || !state.amount || !state.paymentMethod) return

    const { activeShift } = useShiftStore.getState()
    if (!activeShift) {
      toast.error('Nenhum turno ativo. Abra um turno antes de vender.')
      return
    }

    const { profile } = useAuthStore.getState()
    if (!profile) return

    const { providerType } = useScaleStore.getState()

    set({ isConfirming: true })

    const sale: Sale = {
      id: crypto.randomUUID(),
      shift_id: activeShift.id,
      location_id: profile.location_id,
      weight_grams: state.capturedWeightGrams,
      weight_source: providerType === 'manual' ? 'manual' : 'scale',
      price_per_gram: state.pricePerGram!,
      amount: state.amount,
      payment_method: state.paymentMethod,
      amount_received: state.paymentMethod === 'cash' ? state.amountReceived : null,
      change_returned: state.paymentMethod === 'cash' ? state.change : null,
      sync_reconciled: false,
      synced_at: null,
      created_offline: false,
      created_at: new Date().toISOString(),
    }

    try {
      const { error } = await supabase.from('sales').insert(sale)
      if (error) throw error

      useShiftStore.getState().updateTotals(sale.amount, sale.payment_method)
      queryClient.invalidateQueries({ queryKey: ['shift-sales'] })
      toast.success(`Venda confirmada! ${formatCurrency(sale.amount)}`)
      get().reset()
    } catch {
      await useSyncStore.getState().addPending({ ...sale, created_offline: true })
      useShiftStore.getState().updateTotals(sale.amount, sale.payment_method)
      toast.error('Sem conexão. Venda salva offline.')
      get().reset()
    } finally {
      set({ isConfirming: false })
    }
  },

  reset: () =>
    set({
      capturedWeightGrams: null,
      pricePerGram: null,
      amount: null,
      paymentMethod: null,
      amountReceived: null,
      change: null,
    }),
}))
