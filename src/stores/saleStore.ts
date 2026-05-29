import { create } from 'zustand'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { queryClient } from '@/lib/queryClient'
import { useAuthStore } from '@/stores/authStore'
import { useScaleStore } from '@/stores/scaleStore'
import { useShiftStore } from '@/stores/shiftStore'
import { useSyncStore } from '@/stores/syncStore'
import { calcSaleAmount } from '@/constants/pricing'
import type { PaymentMethod, Sale } from '@/types'

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

function playSaleSound() {
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = 880
    gain.gain.setValueAtTime(0.18, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.15)
    osc.onended = () => ctx.close()
  } catch {
    // silently ignore — AudioContext not available
  }
}

interface SaleState {
  capturedWeightGrams: number | null
  pricePerGram: number | null
  amount: number | null
  hasCasquinha: boolean
  paymentMethod: PaymentMethod | null
  amountReceived: number | null
  change: number | null
  isConfirming: boolean
  captureWeight: (grams: number, pricePerGram: number) => void
  captureAmount: (amount: number, pricePerGram: number) => void
  toggleCasquinha: () => void
  setPaymentMethod: (method: PaymentMethod) => void
  setAmountReceived: (value: number | null) => void
  confirmSale: () => Promise<void>
  reset: () => void
}

export const useSaleStore = create<SaleState>((set, get) => ({
  capturedWeightGrams: null,
  pricePerGram: null,
  amount: null,
  hasCasquinha: false,
  paymentMethod: null,
  amountReceived: null,
  change: null,
  isConfirming: false,

  captureWeight: (grams, pricePerGram) => {
    const { hasCasquinha } = get()
    const amount = calcSaleAmount(grams, pricePerGram, hasCasquinha)
    set({ capturedWeightGrams: grams, pricePerGram, amount })
  },

  captureAmount: (amount, pricePerGram) => {
    const grams = pricePerGram > 0 ? Math.round(amount / pricePerGram) : 0
    set({ capturedWeightGrams: grams, pricePerGram, amount })
  },

  toggleCasquinha: () => {
    const { hasCasquinha, capturedWeightGrams, pricePerGram } = get()
    const next = !hasCasquinha
    // Recompute amount in lock-step with the toggle when a weight
    // is already captured (AC3 — real-time recalculation).
    if (capturedWeightGrams !== null && pricePerGram !== null) {
      const amount = calcSaleAmount(capturedWeightGrams, pricePerGram, next)
      // Also reset cash change to avoid showing stale troco against
      // the previous amount (the cashier would notice, but better to
      // be explicit).
      set({ hasCasquinha: next, amount, amountReceived: null, change: null })
    } else {
      set({ hasCasquinha: next })
    }
  },

  setPaymentMethod: (method) => {
    set({ paymentMethod: method })
    if (method !== 'cash') {
      set({ amountReceived: null, change: null })
    }
  },

  setAmountReceived: (value) => {
    if (value === null) {
      set({ amountReceived: null, change: null })
      return
    }
    const { amount } = get()
    const change =
      amount !== null
        ? Math.round(value * 100 - amount * 100) / 100
        : null
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
      // EPIC-10 / Story 10.1 — casquinha add-on flag.
      // The R$ 1,00 is already included in `amount` via calcSaleAmount.
      has_casquinha: state.hasCasquinha,
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { status: _s, cancelled_at: _ca, cancelled_by: _cb, ...saleInsert } = sale

    try {
      const { error } = await supabase.from('sales').insert(saleInsert)
      if (error) throw error

      useShiftStore.getState().updateTotals(sale.amount, sale.payment_method)
      queryClient.invalidateQueries({ queryKey: ['shift-sales'] })
      playSaleSound()
      toast.success(`Venda confirmada! ${formatCurrency(sale.amount)}`)
      get().reset()
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : typeof err === 'object' && err !== null && 'message' in err
            ? String((err as { message: unknown }).message)
            : 'Erro desconhecido'
      // Supabase re-lança TypeError de rede como PostgrestError — checar a mensagem também
      const isNetworkError =
        !navigator.onLine ||
        err instanceof TypeError ||
        /failed to fetch|network error|fetch error/i.test(msg)
      if (isNetworkError) {
        await useSyncStore.getState().addPending({ ...sale, created_offline: true })
        useShiftStore.getState().updateTotals(sale.amount, sale.payment_method)
        toast.error('Sem conexão. Venda salva offline.')
        get().reset()
      } else {
        toast.error(`Erro ao confirmar venda: ${msg}`)
      }
    } finally {
      set({ isConfirming: false })
    }
  },

  reset: () =>
    set({
      capturedWeightGrams: null,
      pricePerGram: null,
      amount: null,
      hasCasquinha: false,
      paymentMethod: null,
      amountReceived: null,
      change: null,
    }),
}))
