import { useQuery } from '@tanstack/react-query'
import { subDays, format } from 'date-fns'
import { supabase } from '@/lib/supabase'
import type { DailySummaryRow, DatePeriod } from '@/types/dashboard'

function getDateRange(period: DatePeriod): { from: string; to: string } {
  const today = new Date()
  const todayStr = format(today, 'yyyy-MM-dd')

  if (period === 'today') {
    return { from: todayStr, to: todayStr }
  }
  if (period === 'week') {
    return { from: format(subDays(today, 6), 'yyyy-MM-dd'), to: todayStr }
  }
  // month
  return { from: format(subDays(today, 29), 'yyyy-MM-dd'), to: todayStr }
}

// Extraído de useDailySummary para reuso em useOwnerOverview (EPIC-11 /
// Story 11.4) — mesma query, mesma view (daily_summary), sem duplicar
// lógica de agregação. useDailySummary continua com o mesmo
// comportamento/assinatura de sempre, só delega para esta função.
export async function fetchDailySummaryRange(
  locationId: string,
  period: DatePeriod
): Promise<DailySummaryRow[]> {
  const { from, to } = getDateRange(period)
  const { data, error } = await supabase
    .from('daily_summary')
    .select('*')
    .eq('location_id', locationId)
    .gte('sale_date', from)
    .lte('sale_date', to)
    .order('sale_date', { ascending: true })
  if (error) throw error
  return (data ?? []) as DailySummaryRow[]
}

export function useDailySummary(locationId: string, period: DatePeriod) {
  return useQuery<DailySummaryRow[]>({
    queryKey: ['daily-summary', locationId, period],
    queryFn: () => fetchDailySummaryRange(locationId, period),
    refetchInterval: 45_000,
    staleTime: 30_000,
    enabled: !!locationId,
  })
}

export function useTodayAndYesterday(locationId: string) {
  const today = format(new Date(), 'yyyy-MM-dd')
  const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd')

  return useQuery<{ today: DailySummaryRow | null; yesterday: DailySummaryRow | null }>({
    queryKey: ['daily-summary-trend', locationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('daily_summary')
        .select('*')
        .eq('location_id', locationId)
        .in('sale_date', [today, yesterday])
      if (error) throw error
      const rows = (data ?? []) as DailySummaryRow[]
      return {
        today: rows.find((r) => r.sale_date === today) ?? null,
        yesterday: rows.find((r) => r.sale_date === yesterday) ?? null,
      }
    },
    refetchInterval: 45_000,
    staleTime: 30_000,
    enabled: !!locationId,
  })
}
