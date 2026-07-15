import { describe, it, expect } from 'vitest'
import { aggregateOwnerOverview } from '@/lib/ownerOverviewAggregate'
import type { DailySummaryRow } from '@/types/dashboard'

function makeRow(overrides: Partial<DailySummaryRow> = {}): DailySummaryRow {
  return {
    sale_date: '2026-07-15',
    location_id: 'loja-1',
    total_sales: 10,
    total_amount: 100,
    avg_ticket: 10,
    total_shifts: 1,
    total_pix: 40,
    total_card: 30,
    total_cash: 30,
    ...overrides,
  }
}

describe('aggregateOwnerOverview (mock de múltiplas lojas)', () => {
  const locations = [
    { id: 'loja-1', name: 'Loja 1' },
    { id: 'loja-2', name: 'Loja 2' },
  ]

  it('consolida o total somando todas as lojas', () => {
    const rowsByLocation = [
      [makeRow({ total_sales: 10, total_amount: 100 })],
      [makeRow({ total_sales: 5, total_amount: 50 })],
    ]
    const result = aggregateOwnerOverview(locations, rowsByLocation, [false, false])

    expect(result.consolidated.sales).toBe(15)
    expect(result.consolidated.amount).toBe(150)
  })

  it('retorna o breakdown por loja individualmente, sem misturar valores', () => {
    const rowsByLocation = [
      [makeRow({ total_sales: 10, total_amount: 100 })],
      [makeRow({ total_sales: 5, total_amount: 50 })],
    ]
    const result = aggregateOwnerOverview(locations, rowsByLocation, [false, false])

    expect(result.byLocation).toHaveLength(2)
    expect(result.byLocation[0]).toMatchObject({ location_id: 'loja-1', sales: 10, amount: 100 })
    expect(result.byLocation[1]).toMatchObject({ location_id: 'loja-2', sales: 5, amount: 50 })
  })

  it('soma múltiplos dias (período semana/mês) por loja', () => {
    const rowsByLocation = [
      [makeRow({ total_sales: 10, total_amount: 100 }), makeRow({ total_sales: 4, total_amount: 40 })],
      [],
    ]
    const result = aggregateOwnerOverview(locations, rowsByLocation, [false, false])

    expect(result.byLocation[0].sales).toBe(14)
    expect(result.byLocation[0].amount).toBe(140)
    expect(result.byLocation[1].sales).toBe(0)
  })

  it('isLoading consolidado é true se qualquer loja ainda está carregando', () => {
    const result = aggregateOwnerOverview(locations, [[], []], [false, true])
    expect(result.isLoading).toBe(true)
  })

  it('3ª loja fictícia aparece automaticamente quando presente em `locations` (sem deploy)', () => {
    const threeLocations = [...locations, { id: 'loja-3-fake', name: 'Loja 3 fictícia' }]
    const result = aggregateOwnerOverview(
      threeLocations,
      [[makeRow()], [], []],
      [false, false, false]
    )
    expect(result.byLocation).toHaveLength(3)
    expect(result.byLocation[2].location_id).toBe('loja-3-fake')
  })

  it('lida com zero lojas vinculadas sem lançar erro', () => {
    const result = aggregateOwnerOverview([], [], [])
    expect(result.consolidated).toEqual({ sales: 0, amount: 0, pix: 0, card: 0, cash: 0 })
    expect(result.byLocation).toEqual([])
    expect(result.isLoading).toBe(false)
  })
})
