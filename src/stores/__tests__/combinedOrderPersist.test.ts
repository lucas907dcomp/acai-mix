// @vitest-environment jsdom
//
// Precisa de DOM porque o store passou a usar localStorage. Um stub manual não
// serve: o persist do zustand lê o storage na criação do módulo, antes de
// qualquer linha do teste rodar.
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase', () => ({ supabase: { from: () => ({}) } }))
vi.mock('@/lib/queryClient', () => ({ queryClient: { invalidateQueries: () => {} } }))
vi.mock('sonner', () => ({ toast: { success: () => {}, error: () => {} } }))

import { useCombinedOrderStore } from '../combinedOrderStore'

// Pedidos conjuntos ficam abertos com o cliente montando o pedido. Antes
// viviam só em memória e um F5 apagava tudo. Agora vão para o localStorage —
// o que traz o risco oposto: pedido de ontem ressuscitar hoje de manhã.

const CHAVE = 'acaimix-combined-orders'

function pedido(id: string, createdAt: string) {
  return { id, name: `Pedido ${id}`, items: [], total: 0, createdAt }
}

function gravar(orders: unknown[], activeOrderId: string | null) {
  localStorage.setItem(
    CHAVE,
    JSON.stringify({ state: { orders, activeOrderId }, version: 0 }),
  )
}

beforeEach(() => {
  localStorage.clear()
  useCombinedOrderStore.setState({ orders: [], activeOrderId: null })
})

describe('pedido conjunto sobrevive ao reload', () => {
  it('mantém pedido criado hoje', async () => {
    gravar([pedido('a', new Date().toISOString())], 'a')
    await useCombinedOrderStore.persist.rehydrate()

    const { orders, activeOrderId } = useCombinedOrderStore.getState()
    expect(orders.map((o) => o.id)).toEqual(['a'])
    expect(activeOrderId).toBe('a')
  })

  it('descarta pedido de ontem', async () => {
    const ontem = new Date()
    ontem.setDate(ontem.getDate() - 1)
    gravar([pedido('velho', ontem.toISOString())], null)
    await useCombinedOrderStore.persist.rehydrate()

    expect(useCombinedOrderStore.getState().orders).toEqual([])
  })

  it('mantém só os de hoje quando há mistura', async () => {
    const ontem = new Date()
    ontem.setDate(ontem.getDate() - 1)
    gravar(
      [pedido('velho', ontem.toISOString()), pedido('novo', new Date().toISOString())],
      'novo',
    )
    await useCombinedOrderStore.persist.rehydrate()

    const { orders, activeOrderId } = useCombinedOrderStore.getState()
    expect(orders.map((o) => o.id)).toEqual(['novo'])
    expect(activeOrderId).toBe('novo')
  })

  it('não deixa a tela apontando para pedido descartado', async () => {
    const ontem = new Date()
    ontem.setDate(ontem.getDate() - 1)
    gravar([pedido('velho', ontem.toISOString())], 'velho')
    await useCombinedOrderStore.persist.rehydrate()

    expect(useCombinedOrderStore.getState().activeOrderId).toBeNull()
  })

  it('aguenta storage vazio', async () => {
    await useCombinedOrderStore.persist.rehydrate()
    expect(useCombinedOrderStore.getState().orders).toEqual([])
  })
})
