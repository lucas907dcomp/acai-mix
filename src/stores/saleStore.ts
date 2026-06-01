import { create } from 'zustand'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import type { Json } from '@/types/supabase'
import { queryClient } from '@/lib/queryClient'
import { useAuthStore } from '@/stores/authStore'
import { useScaleStore } from '@/stores/scaleStore'
import { useShiftStore } from '@/stores/shiftStore'
import { useSyncStore } from '@/stores/syncStore'
import { calcSaleAmount } from '@/constants/pricing'
import type { PaymentMethod, PaymentSplitItem, Sale } from '@/types'

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
  // Split payment state
  secondMethod: PaymentMethod | null
  secondAmount: number | null
  secondAmountReceived: number | null
  secondChange: number | null
  isConfirming: boolean
  captureWeight: (grams: number, pricePerGram: number) => void
  captureAmount: (amount: number, pricePerGram: number) => void
  toggleCasquinha: () => void
  setPaymentMethod: (method: PaymentMethod) => void
  setAmountReceived: (value: number | null) => void
  setSecondMethod: (method: PaymentMethod | null) => void
  setSecondAmount: (amount: number | null) => void
  setSecondAmountReceived: (value: number | null) => void
  clearSplit: () => void
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
  secondMethod: null,
  secondAmount: null,
  secondAmountReceived: null,
  secondChange: null,
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
    const { secondMethod } = get()
    // Clear split if new first method equals the current second method
    if (method === secondMethod) {
      set({ paymentMethod: method, secondMethod: null, secondAmount: null, secondAmountReceived: null, secondChange: null, amountReceived: null, change: null })
    } else {
      set({ paymentMethod: method })
      if (method !== 'cash') {
        set({ amountReceived: null, change: null })
      }
    }
  },

  setAmountReceived: (value) => {
    if (value === null) {
      set({ amountReceived: null, change: null })
      return
    }
    const { amount, secondMethod, secondAmount } = get()
    // In split with first=cash, collect only the first portion
    const cashPortion =
      amount !== null && secondMethod !== null && secondAmount !== null
        ? amount - secondAmount
        : amount
    const change = cashPortion !== null ? Math.round(value * 100 - cashPortion * 100) / 100 : null
    set({ amountReceived: value, change })
  },

  setSecondMethod: (method) => {
    if (method === null) {
      set({ secondMethod: null, secondAmount: null, secondAmountReceived: null, secondChange: null })
    } else {
      set({ secondMethod: method, secondAmount: null, secondAmountReceived: null, secondChange: null })
    }
  },

  setSecondAmount: (amount) => {
    if (amount === null) {
      set({ secondAmount: null, secondAmountReceived: null, secondChange: null })
      return
    }
    // Recompute first-cash change with the updated first portion
    const { amount: total, paymentMethod, amountReceived } = get()
    let change = get().change
    if (paymentMethod === 'cash' && amountReceived !== null && total !== null) {
      const firstPortion = total - amount
      change = Math.round(amountReceived * 100 - firstPortion * 100) / 100
    }
    set({ secondAmount: amount, change, secondAmountReceived: null, secondChange: null })
  },

  setSecondAmountReceived: (value) => {
    if (value === null) {
      set({ secondAmountReceived: null, secondChange: null })
      return
    }
    const { secondAmount } = get()
    const secondChange =
      secondAmount !== null ? Math.round(value * 100 - secondAmount * 100) / 100 : null
    set({ secondAmountReceived: value, secondChange })
  },

  clearSplit: () => {
    set({ secondMethod: null, secondAmount: null, secondAmountReceived: null, secondChange: null })
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

    const isSplit = state.secondMethod !== null && state.secondAmount !== null
    const paymentSplit: PaymentSplitItem[] | null = isSplit
      ? [
          { method: state.paymentMethod, amount: state.amount - state.secondAmount! },
          { method: state.secondMethod!, amount: state.secondAmount! },
        ]
      : null

    const cashMethod = isSplit
      ? (state.paymentMethod === 'cash' ? 'first' : state.secondMethod === 'cash' ? 'second' : null)
      : (state.paymentMethod === 'cash' ? 'first' : null)

    const sale: Sale = {
      id: crypto.randomUUID(),
      shift_id: activeShift.id,
      location_id: profile.location_id,
      weight_grams: state.capturedWeightGrams,
      weight_source: providerType === 'manual' ? 'manual' : 'scale',
      price_per_gram: state.pricePerGram!,
      amount: state.amount,
      payment_method: state.paymentMethod,
      amount_received: cashMethod === 'first' ? state.amountReceived : cashMethod === 'second' ? state.secondAmountReceived : null,
      change_returned: cashMethod === 'first' ? state.change : cashMethod === 'second' ? state.secondChange : null,
      sync_reconciled: false,
      synced_at: null,
      created_offline: false,
      created_at: new Date().toISOString(),
      has_casquinha: state.hasCasquinha,
      payment_split: paymentSplit,
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { status: _s, cancelled_at: _ca, cancelled_by: _cb, payment_split: _ps, ...saleInsertBase } = sale
    const saleInsert = { ...saleInsertBase, payment_split: sale.payment_split as unknown as Json | null }

    try {
      const { error } = await supabase.from('sales').insert(saleInsert)
      if (error) throw error

      if (sale.payment_split) {
        useShiftStore.getState().updateTotalsFromSplit(sale.amount, sale.payment_split)
      } else {
        useShiftStore.getState().updateTotals(sale.amount, sale.payment_method)
      }
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
        if (sale.payment_split) {
          useShiftStore.getState().updateTotalsFromSplit(sale.amount, sale.payment_split)
        } else {
          useShiftStore.getState().updateTotals(sale.amount, sale.payment_method)
        }
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
      secondMethod: null,
      secondAmount: null,
      secondAmountReceived: null,
      secondChange: null,
    }),
}))
