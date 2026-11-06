// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  supabase: { from: () => ({ insert: async () => ({ error: null }) }) },
}))
vi.mock('@/lib/queryClient', () => ({ queryClient: { invalidateQueries: () => {} } }))
vi.mock('sonner', () => ({ toast: { success: () => {}, error: () => {} } }))

import { useCombinedOrderStore } from '../combinedOrderStore'
import { useShiftStore } from '../shiftStore'
import { useAuthStore } from '../authStore'

const store = () => useCombinedOrderStore.getState()
const mesa1 = () => store().orders.find((o) => o.name === 'Mesa 1')!

function lancarNaMesa1() {
  store().activateOrder(mesa1().id)
  store().addUnitItem({
    type: 'unit', product_id: 'p', product_name: 'Água', quantity: 1, unit_price: 3, amount: 3,
  })
}

beforeEach(() => {
  localStorage.clear()
  useCombinedOrderStore.setState({ orders: [], activeOrderId: null })
  useShiftStore.setState({ activeShift: { id: 's' } } as never)
  useAuthStore.setState({ profile: { location_id: 'l' } } as never)
})

describe('mesas fixas', () => {
  it('cria as mesas uma vez só e na ordem', () => {
    store().ensureTables(5)
    store().ensureTables(5)
    expect(store().orders.map((o) => o.name)).toEqual(['Mesa 1', 'Mesa 2', 'Mesa 3', 'Mesa 4', 'Mesa 5'])
  })

  it('depois de pagar, a mesa continua, vazia e sem seleção', async () => {
    store().ensureTables(5)
    lancarNaMesa1()
    expect(mesa1().total).toBe(3)
    await store().confirmOrder(mesa1().id, 'pix')
    expect(store().orders).toHaveLength(5)
    expect(mesa1()).toMatchObject({ items: [], total: 0 })
    expect(store().activeOrderId).toBeNull()
  })

  it('cancelar esvazia a mesa, mas pedido conjunto comum some', () => {
    store().ensureTables(1)
    store().createOrder('Avulso')
    lancarNaMesa1()
    store().cancelOrder(mesa1().id)
    store().cancelOrder(store().orders.find((o) => o.name === 'Avulso')!.id)
    expect(store().orders.map((o) => o.name)).toEqual(['Mesa 1'])
    expect(mesa1().total).toBe(0)
  })

  it('mesa de ontem com conta aberta não se perde ao recarregar', async () => {
    const ontem = new Date(Date.now() - 2 * 86_400_000).toISOString()
    localStorage.setItem(
      'acaimix-combined-orders',
      JSON.stringify({
        state: {
          orders: [
            { id: 'm', name: 'Mesa 1', isTable: true, items: [], total: 9, createdAt: ontem },
            { id: 'v', name: 'Velho', items: [], total: 0, createdAt: ontem },
          ],
          activeOrderId: null,
        },
        version: 0,
      })
    )
    await useCombinedOrderStore.persist.rehydrate()
    expect(store().orders.map((o) => o.id)).toEqual(['m'])
  })
})

describe('mesa fora', () => {
  const nomes = () => store().orders.map((o) => o.name)

  it('numera sozinha, seleciona e reaproveita o número livre', () => {
    store().openExtraTable()
    store().openExtraTable()
    expect(nomes()).toEqual(['Mesa Fora 1', 'Mesa Fora 2'])
    expect(store().activeOrderId).toBe(store().orders[1].id)
    store().cancelOrder(store().orders[0].id)
    store().openExtraTable()
    expect(nomes()).toEqual(['Mesa Fora 2', 'Mesa Fora 1'])
  })

  it('some depois de paga', async () => {
    store().openExtraTable()
    store().addUnitItem({ type: 'unit', product_id: 'p', product_name: 'Água', quantity: 1, unit_price: 3, amount: 3 })
    await store().confirmOrder(store().orders[0].id, 'pix')
    expect(store().orders).toEqual([])
  })
})
