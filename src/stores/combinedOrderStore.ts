import { create } from 'zustand'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { queryClient } from '@/lib/queryClient'
import { useAuthStore } from '@/stores/authStore'
import { useShiftStore } from '@/stores/shiftStore'
import { useSyncStore } from '@/stores/syncStore'
import { formatCurrency } from '@/stores/saleStore'
import type { PaymentMethod, Sale } from '@/types'

export interface CombinedOrderWeightItem {
  id: string
  type: 'weight'
  weight_grams: number
  price_per_gram: number
  has_casquinha: boolean
  product_id?: string
  amount: number
}

export interface CombinedOrderUnitItem {
  id: string
  type: 'unit'
  product_id: string
  product_name: string
  quantity: number
  unit_price: number
  amount: number
}

export type CombinedOrderItem = CombinedOrderWeightItem | CombinedOrderUnitItem

export interface CombinedOrder {
  id: string
  name: string
  items: CombinedOrderItem[]
  total: number
  createdAt: string
}

interface CombinedOrderState {
  orders: CombinedOrder[]
  activeOrderId: string | null
  createOrder: (name: string) => void
  activateOrder: (id: string | null) => void
  addWeightItem: (item: Omit<CombinedOrderWeightItem, 'id'>) => void
  addUnitItem: (item: Omit<CombinedOrderUnitItem, 'id'>) => void
  removeItem: (orderId: string, itemId: string) => void
  cancelOrder: (id: string) => void
  confirmOrder: (
    orderId: string,
    paymentMethod: PaymentMethod,
    amountReceived?: number | null
  ) => Promise<void>
}

export const useCombinedOrderStore = create<CombinedOrderState>((set, get) => ({
  orders: [],
  activeOrderId: null,

  createOrder: (name) => {
    const order: CombinedOrder = {
      id: crypto.randomUUID(),
      name,
      items: [],
      total: 0,
      createdAt: new Date().toISOString(),
    }
    set((s) => ({ orders: [...s.orders, order] }))
  },

  activateOrder: (id) => set({ activeOrderId: id }),

  addWeightItem: (item) => {
    const { activeOrderId, orders } = get()
    if (!activeOrderId) return
    const newItem: CombinedOrderWeightItem = { ...item, id: crypto.randomUUID() }
    set({
      orders: orders.map((o) =>
        o.id === activeOrderId
          ? { ...o, items: [...o.items, newItem], total: Math.round((o.total + item.amount) * 100) / 100 }
          : o
      ),
    })
  },

  addUnitItem: (item) => {
    const { activeOrderId, orders } = get()
    if (!activeOrderId) return
    const newItem: CombinedOrderUnitItem = { ...item, id: crypto.randomUUID() }
    set({
      orders: orders.map((o) =>
        o.id === activeOrderId
          ? { ...o, items: [...o.items, newItem], total: Math.round((o.total + item.amount) * 100) / 100 }
          : o
      ),
    })
  },

  removeItem: (orderId, itemId) => {
    const { orders } = get()
    set({
      orders: orders.map((o) => {
        if (o.id !== orderId) return o
        const item = o.items.find((i) => i.id === itemId)
        const amount = item?.amount ?? 0
        return {
          ...o,
          items: o.items.filter((i) => i.id !== itemId),
          total: Math.max(0, Math.round((o.total - amount) * 100) / 100),
        }
      }),
    })
  },

  cancelOrder: (id) => {
    const { activeOrderId } = get()
    set((s) => ({
      orders: s.orders.filter((o) => o.id !== id),
      activeOrderId: activeOrderId === id ? null : activeOrderId,
    }))
  },

  confirmOrder: async (orderId, paymentMethod, amountReceived) => {
    const { orders, activeOrderId } = get()
    const order = orders.find((o) => o.id === orderId)
    if (!order || order.items.length === 0) return

    const { activeShift } = useShiftStore.getState()
    if (!activeShift) {
      toast.error('Nenhum turno ativo.')
      return
    }

    const { profile } = useAuthStore.getState()
    if (!profile) return

    const total = order.items.reduce((sum, i) => sum + i.amount, 0)
    const totalWeightGrams = order.items
      .filter((i): i is CombinedOrderWeightItem => i.type === 'weight')
      .reduce((sum, i) => sum + i.weight_grams, 0)

    const change =
      paymentMethod === 'cash' && amountReceived != null
        ? Math.round(amountReceived * 100 - total * 100) / 100
        : null

    const combinedItems = order.items.map((i) => {
      if (i.type === 'weight') {
        return {
          type: 'weight' as const,
          weight_grams: i.weight_grams,
          price_per_gram: i.price_per_gram,
          has_casquinha: i.has_casquinha,
          product_id: i.product_id ?? null,
          amount: i.amount,
        }
      }
      return {
        type: 'unit' as const,
        product_id: i.product_id,
        product_name: i.product_name,
        quantity: i.quantity,
        unit_price: i.unit_price,
        amount: i.amount,
      }
    })

    const sale: Sale = {
      id: crypto.randomUUID(),
      shift_id: activeShift.id,
      location_id: profile.location_id,
      weight_grams: totalWeightGrams,
      weight_source: 'manual',
      price_per_gram: 0,
      amount: Math.round(total * 100) / 100,
      payment_method: paymentMethod,
      amount_received: paymentMethod === 'cash' ? (amountReceived ?? null) : null,
      change_returned: paymentMethod === 'cash' ? change : null,
      sync_reconciled: false,
      synced_at: null,
      created_offline: false,
      created_at: new Date().toISOString(),
      has_casquinha: false,
      is_combined: true,
      combined_order_name: order.name,
      combined_items: combinedItems,
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { status: _s, cancelled_at: _ca, cancelled_by: _cb, ...saleInsert } = sale

    const removeOrder = () =>
      set((s) => ({
        orders: s.orders.filter((o) => o.id !== orderId),
        activeOrderId: activeOrderId === orderId ? null : s.activeOrderId,
      }))

    try {
      const { error } = await supabase.from('sales').insert(saleInsert)
      if (error) throw error

      useShiftStore.getState().updateTotals(sale.amount, sale.payment_method)
      queryClient.invalidateQueries({ queryKey: ['shift-sales'] })
      toast.success(`Pedido "${order.name}" confirmado! ${formatCurrency(sale.amount)}`)
      removeOrder()
    } catch (err) {
      const isNetworkError = !navigator.onLine || err instanceof TypeError
      if (isNetworkError) {
        await useSyncStore.getState().addPending({ ...sale, created_offline: true })
        useShiftStore.getState().updateTotals(sale.amount, sale.payment_method)
        toast.error('Sem conexão. Pedido salvo offline.')
        removeOrder()
      } else {
        const msg =
          err instanceof Error
            ? err.message
            : typeof err === 'object' && err !== null && 'message' in err
              ? String((err as { message: unknown }).message)
              : 'Erro desconhecido'
        toast.error(`Erro ao confirmar pedido: ${msg}`)
      }
    }
  },
}))
