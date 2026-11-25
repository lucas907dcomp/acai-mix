import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import type { Json } from '@/types/supabase'
import { queryClient } from '@/lib/queryClient'
import { useAuthStore } from '@/stores/authStore'
import { useShiftStore } from '@/stores/shiftStore'
import { useSyncStore } from '@/stores/syncStore'
import { formatCurrency } from '@/stores/saleStore'
import type { PaymentMethod, PaymentSplitItem, Sale } from '@/types'

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

/** Item já pago, mostrado na conta só para conferência: não entra em items nem no total. */
export type PaidItem = CombinedOrderItem & { methods: PaymentMethod[] }

export interface CombinedOrder {
  id: string
  name: string
  items: CombinedOrderItem[]
  total: number
  createdAt: string
  /** Mesa fixa da loja: ao pagar ou cancelar esvazia, nunca some. */
  isTable?: boolean
  /** Pagos por partes. Só existe enquanto ainda há item pendente. */
  paidItems?: PaidItem[]
}

/** Id do item → quantas unidades entram neste pagamento (item por peso: 1). */
export type EscolhaItens = Record<string, number>

const centavos = (v: number) => Math.round(v * 100) / 100
const somar = (items: CombinedOrderItem[]) => centavos(items.reduce((s, i) => s + i.amount, 0))

/** Separa o que entra no pagamento do que continua na mesa. */
export function separarItens(items: CombinedOrderItem[], escolha: EscolhaItens) {
  const pagos: CombinedOrderItem[] = []
  const restantes: CombinedOrderItem[] = []
  for (const item of items) {
    const existe = item.type === 'unit' ? item.quantity : 1
    const n = Math.min(existe, Math.max(0, Math.floor(escolha[item.id] ?? 0)))
    if (n === 0) restantes.push(item)
    else if (n === existe) pagos.push(item)
    else if (item.type === 'unit') {
      // O resto sai por diferença: as duas partes somam sempre o valor do item.
      const pago = centavos(item.unit_price * n)
      pagos.push({ ...item, quantity: n, amount: pago })
      restantes.push({ ...item, quantity: existe - n, amount: centavos(item.amount - pago) })
    }
  }
  return { pagos, restantes }
}

interface CombinedOrderState {
  orders: CombinedOrder[]
  activeOrderId: string | null
  createOrder: (name: string) => void
  ensureTables: (count: number) => void
  openExtraTable: () => void
  activateOrder: (id: string | null) => void
  addWeightItem: (item: Omit<CombinedOrderWeightItem, 'id'>) => void
  addUnitItem: (item: Omit<CombinedOrderUnitItem, 'id'>) => void
  removeItem: (orderId: string, itemId: string) => void
  cancelOrder: (id: string) => void
  confirmOrder: (
    orderId: string,
    paymentMethod: PaymentMethod,
    amountReceived?: number | null,
    paymentSplit?: PaymentSplitItem[] | null,
    /** Pagamento por partes: quanto pagar de cada item. Sem isso, paga tudo. */
    escolha?: EscolhaItens
  ) => Promise<boolean>
}

/**
 * Pedidos conjuntos ficam abertos enquanto o cliente ainda está montando o
 * pedido — às vezes por vários minutos. Antes eles viviam só em memória, e um
 * F5 (ou um refresh acidental) apagava tudo com o cliente na frente do balcão.
 *
 * Guardados em localStorage e não sessionStorage: sessionStorage sobrevive ao
 * F5 mas morre se o navegador fechar ou o PC reiniciar no meio do expediente —
 * justamente quando perder o pedido dói mais.
 *
 * Como localStorage não expira sozinho, pedidos de dias anteriores são
 * descartados ao carregar. Sem isso, um pedido esquecido de ontem apareceria
 * em standby hoje de manhã.
 */
const MESMO_DIA = (iso: string): boolean => {
  const d = new Date(iso)
  const hoje = new Date()
  return (
    d.getFullYear() === hoje.getFullYear() &&
    d.getMonth() === hoje.getMonth() &&
    d.getDate() === hoje.getDate()
  )
}

/** Tira o pedido da lista; mesa fica, vazia, pronta para a próxima venda. */
const encerrar = (orders: CombinedOrder[], id: string): CombinedOrder[] =>
  orders.flatMap((o) => {
    if (o.id !== id) return [o]
    return o.isTable ? [{ ...o, items: [], paidItems: undefined, total: 0, createdAt: new Date().toISOString() }] : []
  })

export const useCombinedOrderStore = create<CombinedOrderState>()(
  persist(
    (set, get) => ({
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

  ensureTables: (count) => {
    const { orders } = get()
    const novas: CombinedOrder[] = Array.from({ length: count }, (_, i) => `Mesa ${i + 1}`)
      .filter((name) => !orders.some((o) => o.isTable && o.name === name))
      .map((name) => ({
        id: crypto.randomUUID(),
        name,
        items: [],
        total: 0,
        createdAt: new Date().toISOString(),
        isTable: true,
      }))
    if (novas.length > 0) set({ orders: [...novas, ...orders] })
  },

  // Mesa fora é pedido comum com nome automático: ao pagar ou fechar, some e o
  // número volta a ficar livre.
  openExtraTable: () => {
    const { orders } = get()
    let n = 1
    while (orders.some((o) => o.name === `Mesa Fora ${n}`)) n++
    const order: CombinedOrder = {
      id: crypto.randomUUID(),
      name: `Mesa Fora ${n}`,
      items: [],
      total: 0,
      createdAt: new Date().toISOString(),
    }
    set({ orders: [...orders, order], activeOrderId: order.id })
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
        const items = o.items.filter((i) => i.id !== itemId)
        return {
          ...o,
          items,
          // Sem pendente a conta acabou: o próximo cliente não pode herdar os pagos.
          paidItems: items.length > 0 ? o.paidItems : undefined,
          total: Math.max(0, Math.round((o.total - amount) * 100) / 100),
        }
      }),
    })
  },

  cancelOrder: (id) => {
    const { activeOrderId } = get()
    set((s) => ({
      orders: encerrar(s.orders, id),
      activeOrderId: activeOrderId === id ? null : activeOrderId,
    }))
  },

  confirmOrder: async (orderId, paymentMethod, amountReceived, paymentSplit, escolha) => {
    const { orders, activeOrderId } = get()
    const order = orders.find((o) => o.id === orderId)
    const itens = order && escolha ? separarItens(order.items, escolha).pagos : order?.items
    if (!order || !itens?.length) return false

    const { activeShift } = useShiftStore.getState()
    if (!activeShift) {
      toast.error('Nenhum turno ativo.')
      return false
    }

    const { profile } = useAuthStore.getState()
    if (!profile) return false

    const total = itens.reduce((sum, i) => sum + i.amount, 0)
    const totalWeightGrams = itens
      .filter((i): i is CombinedOrderWeightItem => i.type === 'weight')
      .reduce((sum, i) => sum + i.weight_grams, 0)

    const cashPortion = paymentSplit
      ? (paymentSplit.find((s) => s.method === 'cash')?.amount ?? null)
      : (paymentMethod === 'cash' ? total : null)

    const change =
      cashPortion !== null && amountReceived != null
        ? Math.round(amountReceived * 100 - cashPortion * 100) / 100
        : null

    const combinedItems = itens.map((i) => {
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
      amount_received: cashPortion !== null ? (amountReceived ?? null) : null,
      change_returned: cashPortion !== null ? change : null,
      payment_split: paymentSplit ?? null,
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
    const { status: _s, cancelled_at: _ca, cancelled_by: _cb, payment_split: _ps, ...saleInsertBase } = sale
    const saleInsert = { ...saleInsertBase, payment_split: sale.payment_split as unknown as Json | null }

    const removeOrder = () =>
      set((s) => {
        const atual = s.orders.find((o) => o.id === orderId)
        const restantes = atual && escolha ? separarItens(atual.items, escolha).restantes : []
        if (restantes.length > 0) {
          const methods = paymentSplit ? paymentSplit.map((p) => p.method) : [paymentMethod]
          const pagos: PaidItem[] = itens.map((i) => ({ ...i, methods }))
          return {
            orders: s.orders.map((o) =>
              o.id === orderId
                ? { ...o, items: restantes, total: somar(restantes), paidItems: [...(o.paidItems ?? []), ...pagos] }
                : o
            ),
          }
        }
        return {
          orders: encerrar(s.orders, orderId),
          activeOrderId: activeOrderId === orderId ? null : s.activeOrderId,
        }
      })

    try {
      const { error } = await supabase.from('sales').insert(saleInsert)
      if (error) throw error

      if (sale.payment_split) {
        useShiftStore.getState().updateTotalsFromSplit(sale.amount, sale.payment_split)
      } else {
        useShiftStore.getState().updateTotals(sale.amount, sale.payment_method)
      }
      queryClient.invalidateQueries({ queryKey: ['shift-sales'] })
      toast.success(`Pedido "${order.name}" confirmado! ${formatCurrency(sale.amount)}`)
      removeOrder()
      return true
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : typeof err === 'object' && err !== null && 'message' in err
            ? String((err as { message: unknown }).message)
            : 'Erro desconhecido'
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
        toast.error('Sem conexão. Pedido salvo offline.')
        removeOrder()
        return true
      }
      toast.error(`Erro ao confirmar pedido: ${msg}`)
      return false
    }
  },
    }),
    {
      name: 'acaimix-combined-orders',
      // Só o que precisa sobreviver ao reload — as ações são recriadas.
      partialize: (state) => ({
        orders: state.orders,
        activeOrderId: state.activeOrderId,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return
        // Mesa não expira: conta aberta que virou o dia não pode sumir sozinha.
        const doHoje = state.orders.filter((o) => o.isTable || MESMO_DIA(o.createdAt))
        if (doHoje.length !== state.orders.length) {
          state.orders = doHoje
        }
        // O pedido ativo pode ter sido descartado junto — não deixar a tela
        // apontando para um pedido que não existe mais.
        if (state.activeOrderId && !doHoje.some((o) => o.id === state.activeOrderId)) {
          state.activeOrderId = null
        }
      },
    },
  ),
)
