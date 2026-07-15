import type { DailySummaryRow } from '@/types/dashboard'

export interface OwnerOverviewTotals {
  sales: number
  amount: number
  pix: number
  card: number
  cash: number
}

export interface OwnerOverviewLocation extends OwnerOverviewTotals {
  location_id: string
  location_name: string
  isLoading: boolean
}

export interface OwnerOverviewResult {
  consolidated: OwnerOverviewTotals
  byLocation: OwnerOverviewLocation[]
  isLoading: boolean
}

const EMPTY_TOTALS: OwnerOverviewTotals = { sales: 0, amount: 0, pix: 0, card: 0, cash: 0 }

function sumTotals(a: OwnerOverviewTotals, b: OwnerOverviewTotals): OwnerOverviewTotals {
  return {
    sales: a.sales + b.sales,
    amount: a.amount + b.amount,
    pix: a.pix + b.pix,
    card: a.card + b.card,
    cash: a.cash + b.cash,
  }
}

/**
 * Agregação pura (EPIC-11 / Story 11.4) — recebe as linhas de
 * `daily_summary` já buscadas por loja e consolida. Sem dependências
 * (nem React Query, nem stores) de propósito, para ser testável sem
 * puxar a cadeia de imports pesados (Supabase client) — mesmo padrão
 * de `src/lib/syncGuard.ts` (Story 11.3).
 */
export function aggregateOwnerOverview(
  locations: { id: string; name: string }[],
  rowsByLocation: DailySummaryRow[][],
  loadingByLocation: boolean[]
): OwnerOverviewResult {
  const byLocation: OwnerOverviewLocation[] = locations.map((loc, i) => {
    const rows = rowsByLocation[i] ?? []
    const totals = rows.reduce<OwnerOverviewTotals>(
      (acc, d) =>
        sumTotals(acc, {
          sales: Number(d.total_sales),
          amount: Number(d.total_amount),
          pix: Number(d.total_pix),
          card: Number(d.total_card),
          cash: Number(d.total_cash),
        }),
      EMPTY_TOTALS
    )
    return {
      location_id: loc.id,
      location_name: loc.name,
      ...totals,
      isLoading: loadingByLocation[i] ?? false,
    }
  })

  const consolidated = byLocation.reduce((acc, l) => sumTotals(acc, l), EMPTY_TOTALS)

  return {
    consolidated,
    byLocation,
    isLoading: loadingByLocation.some(Boolean),
  }
}
