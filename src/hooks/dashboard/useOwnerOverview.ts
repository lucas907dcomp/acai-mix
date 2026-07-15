import { useQueries } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/authStore'
import { fetchDailySummaryRange } from './useDailySummary'
import { aggregateOwnerOverview } from '@/lib/ownerOverviewAggregate'
import type { OwnerOverviewResult } from '@/lib/ownerOverviewAggregate'
import type { DatePeriod } from '@/types/dashboard'

export type {
  OwnerOverviewTotals,
  OwnerOverviewLocation,
  OwnerOverviewResult,
} from '@/lib/ownerOverviewAggregate'

/**
 * Consolida `daily_summary` de todas as lojas vinculadas ao owner
 * (EPIC-11 / Story 11.4). Reaproveita `fetchDailySummaryRange` —
 * mesma query/view do Dashboard individual (`useDailySummary`), sem
 * lógica de agregação nova no banco (AC2/AC5). Usa `useQueries` (não
 * `useDailySummary` em loop) porque o número de lojas é dinâmico —
 * chamar hooks em quantidade variável violaria as Rules of Hooks.
 * A mesma `queryKey` (`['daily-summary', locationId, period]`)
 * garante cache compartilhado com qualquer outro componente
 * (ex.: `SalesChart`) que já busque a mesma loja/período.
 */
export function useOwnerOverview(period: DatePeriod): OwnerOverviewResult {
  const locations = useAuthStore((s) => s.profile?.locations) ?? []

  const results = useQueries({
    queries: locations.map((loc) => ({
      queryKey: ['daily-summary', loc.id, period],
      queryFn: () => fetchDailySummaryRange(loc.id, period),
      enabled: !!loc.id,
      staleTime: 30_000,
      refetchInterval: 45_000,
    })),
  })

  return aggregateOwnerOverview(
    locations,
    results.map((r) => r.data ?? []),
    results.map((r) => r.isLoading)
  )
}
