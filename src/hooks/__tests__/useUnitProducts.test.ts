// Validates useUnitProducts query construction by spying on useQuery and
// inspecting the options it receives — then executing queryFn directly
// against a mocked Supabase client. This mirrors the project's testing
// pattern (see src/stores/__tests__/syncStore.test.ts) of asserting on
// builder calls instead of rendering React.
import { describe, it, expect, beforeEach, vi } from 'vitest'

const selectMock = vi.fn()
const eqMock = vi.fn()
const orderMock = vi.fn()
const fromMock = vi.fn()

function makeChain() {
  const chain = { select: selectMock, eq: eqMock, order: orderMock }
  selectMock.mockReturnValue(chain)
  eqMock.mockReturnValue(chain)
  orderMock.mockReturnValue(chain)
  fromMock.mockReturnValue(chain)
  return chain
}

vi.mock('@/lib/supabase', () => ({
  supabase: { from: (table: string) => fromMock(table) },
}))

vi.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (s: { profile: { location_id: string } }) => unknown) =>
    selector({ profile: { location_id: 'loc-123' } }),
}))

// Capture the options passed to useQuery so we can inspect queryKey + queryFn.
let capturedOptions: { queryKey: unknown[]; queryFn: () => Promise<unknown>; enabled?: boolean; staleTime?: number } | null = null

vi.mock('@tanstack/react-query', () => ({
  useQuery: (options: typeof capturedOptions) => {
    capturedOptions = options
    return { data: undefined, isLoading: true, error: null }
  },
}))

describe('useUnitProducts', () => {
  beforeEach(() => {
    selectMock.mockReset()
    eqMock.mockReset()
    orderMock.mockReset()
    fromMock.mockReset()
    capturedOptions = null
    makeChain()
  })

  it('uses query key ["products", "unit", locationId]', async () => {
    const { useUnitProducts } = await import('../useUnitProducts')
    useUnitProducts()
    expect(capturedOptions?.queryKey).toEqual(['products', 'unit', 'loc-123'])
  })

  it('queryFn filters by location_id + product_type=unit, orders by sort_order then name', async () => {
    const sample = [{ id: 'p1', name: 'Água', sort_order: 0, active: true }]
    // Second .order() is the awaited terminal.
    let orderCalls = 0
    orderMock.mockImplementation(() => {
      orderCalls += 1
      if (orderCalls === 2) {
        return Promise.resolve({ data: sample, error: null })
      }
      return { select: selectMock, eq: eqMock, order: orderMock }
    })

    const { useUnitProducts } = await import('../useUnitProducts')
    useUnitProducts()
    const result = await capturedOptions!.queryFn()

    expect(fromMock).toHaveBeenCalledWith('products')
    expect(eqMock).toHaveBeenCalledWith('location_id', 'loc-123')
    expect(eqMock).toHaveBeenCalledWith('product_type', 'unit')
    expect(orderMock).toHaveBeenNthCalledWith(1, 'sort_order', { ascending: true })
    expect(orderMock).toHaveBeenNthCalledWith(2, 'name', { ascending: true })
    expect(result).toEqual(sample)
  })

  it('queryFn throws when Supabase returns an error', async () => {
    let orderCalls = 0
    orderMock.mockImplementation(() => {
      orderCalls += 1
      if (orderCalls === 2) {
        return Promise.resolve({ data: null, error: new Error('boom') })
      }
      return { select: selectMock, eq: eqMock, order: orderMock }
    })

    const { useUnitProducts } = await import('../useUnitProducts')
    useUnitProducts()

    await expect(capturedOptions!.queryFn()).rejects.toThrow('boom')
  })
})
