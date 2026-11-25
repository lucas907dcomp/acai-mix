// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { vendas, falha } = vi.hoisted(() => ({
  vendas: [] as Record<string, unknown>[],
  falha: { erro: null as { message: string } | null },
}))
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => ({
      insert: async (v: Record<string, unknown>) => {
        if (falha.erro) return { error: falha.erro }
        vendas.push(v)
        return { error: null }
      },
    }),
  },
}))
vi.mock('@/lib/queryClient', () => ({ queryClient: { invalidateQueries: () => {} } }))
vi.mock('sonner', () => ({ toast: { success: () => {}, error: () => {} } }))

import { separarItens, useCombinedOrderStore } from '../combinedOrderStore'
import { useShiftStore } from '../shiftStore'
import { useAuthStore } from '../authStore'

const store = () => useCombinedOrderStore.getState()
const mesa = () => store().orders[0]
const acai = (g: number, amount: number) =>
  store().addWeightItem({ type: 'weight', weight_grams: g, price_per_gram: 0.0499, has_casquinha: false, amount })

beforeEach(() => {
  localStorage.clear()
  vendas.length = 0
  falha.erro = null
  useCombinedOrderStore.setState({ orders: [], activeOrderId: null })
  useShiftStore.setState({ activeShift: { id: 's' } } as never)
  useAuthStore.setState({ profile: { location_id: 'l' } } as never)
  store().ensureTables(1)
  store().activateOrder(mesa().id)
})

describe('pagar por item', () => {
  it('três açaís em dois pagamentos: cada venda com o seu valor e a mesa fecha no último', async () => {
    acai(300, 14.97)
    acai(450, 22.46)
    acai(200, 9.98)
    const [a, b, c] = mesa().items.map((i) => i.id)

    expect(await store().confirmOrder(mesa().id, 'pix', null, null, { [a]: 1, [b]: 1 })).toBe(true)
    expect(mesa().items.map((i) => i.id)).toEqual([c])
    expect(mesa().total).toBe(9.98)
    expect(store().activeOrderId).toBe(mesa().id)

    await store().confirmOrder(mesa().id, 'cash', 20, null, { [c]: 1 })
    expect(mesa()).toMatchObject({ name: 'Mesa 1', items: [], total: 0 })
    expect(store().activeOrderId).toBeNull()

    expect(vendas.map((v) => [v.amount, v.payment_method, v.weight_grams, v.change_returned])).toEqual([
      [37.43, 'pix', 750, null],
      [9.98, 'cash', 200, 10.02],
    ])
    expect(new Set(vendas.map((v) => v.id)).size).toBe(2)
  })

  it('item com quantidade: paga 1 de 3 e sobram 2', async () => {
    store().addUnitItem({ type: 'unit', product_id: 'p', product_name: 'Água', quantity: 3, unit_price: 3.5, amount: 10.5 })
    await store().confirmOrder(mesa().id, 'pix', null, null, { [mesa().items[0].id]: 1 })
    expect(vendas[0].amount).toBe(3.5)
    expect(mesa().items[0]).toMatchObject({ quantity: 2, amount: 7 })
    expect(mesa().total).toBe(7)
  })

  it('o pago fica na conta com a forma, fora do total, e some quando a mesa fecha', async () => {
    acai(300, 14.97)
    acai(450, 22.46)
    const a = mesa().items[0].id
    await store().confirmOrder(mesa().id, 'pix', null, null, { [a]: 1 })
    expect(mesa().paidItems).toMatchObject([{ id: a, amount: 14.97, methods: ['pix'] }])
    expect(mesa().total).toBe(22.46)

    // Pagar o resto (sem escolha) cobra só o pendente e limpa a mesa.
    await store().confirmOrder(mesa().id, 'credit')
    expect(vendas.map((v) => v.amount)).toEqual([14.97, 22.46])
    expect(mesa().items).toEqual([])
    expect(mesa().paidItems).toBeUndefined()
  })

  it('pagamento dividido guarda as duas formas', async () => {
    acai(300, 14.97)
    acai(450, 22.46)
    const split = [{ method: 'pix' as const, amount: 10 }, { method: 'cash' as const, amount: 4.97 }]
    await store().confirmOrder(mesa().id, 'pix', 5, split, { [mesa().items[0].id]: 1 })
    expect(mesa().paidItems?.[0].methods).toEqual(['pix', 'cash'])
  })

  it('o próximo cliente não herda os pagos: limpar a mesa ou remover o último pendente', async () => {
    for (const limpar of [
      () => store().cancelOrder(mesa().id),
      () => store().removeItem(mesa().id, mesa().items[0].id),
    ]) {
      acai(300, 14.97)
      acai(450, 22.46)
      await store().confirmOrder(mesa().id, 'pix', null, null, { [mesa().items[0].id]: 1 })
      expect(mesa().paidItems).toHaveLength(1)
      limpar()
      expect(mesa()).toMatchObject({ items: [], total: 0 })
      expect(mesa().paidItems).toBeUndefined()
      store().activateOrder(mesa().id)
    }
  })

  it('erro ao gravar não tira nada da mesa', async () => {
    acai(300, 14.97)
    acai(450, 22.46)
    falha.erro = { message: 'permission denied' }
    expect(await store().confirmOrder(mesa().id, 'pix', null, null, { [mesa().items[0].id]: 1 })).toBe(false)
    expect(mesa().items).toHaveLength(2)
    expect(mesa().total).toBe(37.43)
  })

  it('nada marcado não vira venda; sem escolha paga tudo', async () => {
    acai(300, 14.97)
    acai(450, 22.46)
    expect(await store().confirmOrder(mesa().id, 'pix', null, null, {})).toBe(false)
    expect(vendas).toHaveLength(0)
    await store().confirmOrder(mesa().id, 'pix')
    expect(vendas[0].amount).toBe(37.43)
    expect(mesa().items).toEqual([])
  })

  it('pago + resto = valor do item, mesmo com preço quebrado', () => {
    const item = { id: 'x', type: 'unit' as const, product_id: 'p', product_name: 'y', quantity: 3, unit_price: 3.333, amount: 10 }
    const { pagos, restantes } = separarItens([item], { x: 2 })
    expect(Math.round((pagos[0].amount + restantes[0].amount) * 100)).toBe(1000)
  })
})
