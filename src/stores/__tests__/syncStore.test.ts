// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { useSyncStore } from '../syncStore'
import { useShiftStore } from '../shiftStore'
import { db } from '@/providers/sync/DexieDatabase'
import type { Sale } from '@/types'

// Mock Supabase
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: 'remote-shift-id' }, error: null }),
        }),
      }),
    }),
    functions: {
      invoke: vi.fn().mockResolvedValue({
        data: { synced: 1, reconciled: 0, errors: [] },
        error: null,
      }),
    },
  },
}))

const makeSale = (overrides: Partial<Sale> = {}): Sale => ({
  id: crypto.randomUUID(),
  shift_id: 'shift-001',
  location_id: 'loc-001',
  weight_grams: 300,
  weight_source: 'scale',
  price_per_gram: 0.065,
  amount: 19.5,
  payment_method: 'pix',
  amount_received: null,
  change_returned: null,
  sync_reconciled: false,
  synced_at: null,
  created_offline: false,
  created_at: new Date().toISOString(),
  ...overrides,
})

beforeEach(async () => {
  await db.pending_sales.clear()
  await db.provisional_shifts.clear()
  useSyncStore.setState({
    isOnline: false,
    pendingCount: 0,
    isSyncing: false,
    lastSoftCloseAt: null,
  })
  vi.clearAllMocks()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('syncStore — addPending', () => {
  it('salva venda no Dexie com synced: false', async () => {
    const sale = makeSale()
    await useSyncStore.getState().addPending(sale)
    const records = await db.pending_sales.toArray()
    expect(records).toHaveLength(1)
    expect(records[0].synced).toBe(false)
    expect(records[0].sync_attempts).toBe(0)
    expect(records[0].created_offline).toBe(true)
  })

  it('atualiza pendingCount após adicionar', async () => {
    await useSyncStore.getState().addPending(makeSale())
    await useSyncStore.getState().addPending(makeSale())
    expect(useSyncStore.getState().pendingCount).toBe(2)
  })
})

describe('syncStore — refreshPendingCount', () => {
  it('reflete estado real do Dexie', async () => {
    await db.pending_sales.add({
      ...makeSale({ id: 'sale-1' }),
      synced: false,
      sync_attempts: 0,
    })
    await db.pending_sales.add({
      ...makeSale({ id: 'sale-2' }),
      synced: true,
      sync_attempts: 0,
    })
    await useSyncStore.getState().refreshPendingCount()
    expect(useSyncStore.getState().pendingCount).toBe(1)
  })
})

describe('syncStore — drain', () => {
  it('não drena se offline', async () => {
    useSyncStore.setState({ isOnline: false })
    await useSyncStore.getState().addPending(makeSale())
    await useSyncStore.getState().drain()

    const records = await db.pending_sales.toArray()
    expect(records[0].synced).toBe(false)
  })

  it('drena vendas pendentes quando online', async () => {
    useSyncStore.setState({ isOnline: true })
    const sale = makeSale()
    await useSyncStore.getState().addPending(sale)

    await useSyncStore.getState().drain()

    const { supabase } = await import('@/lib/supabase')
    expect(supabase.functions.invoke).toHaveBeenCalledWith('sync-sales', {
      body: expect.objectContaining({ sales: expect.any(Array) }),
    })

    const records = await db.pending_sales.toArray()
    expect(records[0].synced).toBe(true)
  })

  it('pendingCount zera após drain bem-sucedido', async () => {
    useSyncStore.setState({ isOnline: true })
    await useSyncStore.getState().addPending(makeSale())
    await useSyncStore.getState().drain()
    expect(useSyncStore.getState().pendingCount).toBe(0)
  })

  it('não executa drain duplo simultâneo', async () => {
    useSyncStore.setState({ isOnline: true })
    await useSyncStore.getState().addPending(makeSale())

    const { supabase } = await import('@/lib/supabase')
    // Trigger two drains simultaneously
    await Promise.all([
      useSyncStore.getState().drain(),
      useSyncStore.getState().drain(),
    ])

    // Should only invoke once (second call is no-op due to isSyncing guard)
    expect(supabase.functions.invoke).toHaveBeenCalledTimes(1)
  })

  it('incrementa sync_attempts em caso de erro', async () => {
    useSyncStore.setState({ isOnline: true })
    const sale = makeSale({ id: 'fail-sale' })
    await useSyncStore.getState().addPending(sale)

    const { supabase } = await import('@/lib/supabase')
    vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
      data: { synced: 0, reconciled: 0, errors: [{ id: sale.id, error: 'Network error' }] },
      error: null,
    })

    await useSyncStore.getState().drain()

    const records = await db.pending_sales.toArray()
    expect(records[0].sync_attempts).toBe(1)
    expect(records[0].last_sync_error).toBe('Network error')
    expect(records[0].synced).toBe(false)
    expect(useSyncStore.getState().pendingCount).toBe(1)
  })
})

describe('syncStore — provisional shift drain', () => {
  it('drena turno provisório antes das vendas', async () => {
    useSyncStore.setState({ isOnline: true })
    const local_id = crypto.randomUUID()

    await db.provisional_shifts.add({
      local_id,
      location_id: 'loc-001',
      shift_number: 2,
      opened_at: new Date().toISOString(),
      opened_by: 'user-001',
      status: 'provisional',
    })

    await db.pending_sales.add({
      ...makeSale({ id: 'sale-prov', shift_id: local_id }),
      synced: false,
      sync_attempts: 0,
    })

    // Mock shiftStore to have the provisional shift active
    useShiftStore.setState({
      activeShift: {
        id: local_id,
        location_id: 'loc-001',
        shift_number: 2,
        opened_at: new Date().toISOString(),
        opened_by: 'user-001',
        closed_at: null,
        closed_by: null,
        status: 'provisional',
        total_sales: 0,
        total_pix: 0,
        total_card: 0,
        total_cash: 0,
        sale_count: 0,
      },
    })

    await useSyncStore.getState().drain()

    // Provisional shift should be synced with remote_id
    const pShift = await db.provisional_shifts.get(local_id)
    expect(pShift?.status).toBe('synced')
    expect(pShift?.remote_id).toBe('remote-shift-id')

    // Pending sale should have updated shift_id
    const sales = await db.pending_sales.toArray()
    expect(sales[0].shift_id).toBe('remote-shift-id')
  })
})
