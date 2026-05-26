import { useQuery } from '@tanstack/react-query'
import { startOfDay, endOfDay, subDays } from 'date-fns'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import type { SaleWithProduct } from '@/types'
import type { DatePeriod } from '@/types/dashboard'

export function periodToDates(period: DatePeriod): { from: Date; to: Date } {
  const now = new Date()
  switch (period) {
    case 'today':
      return { from: startOfDay(now), to: endOfDay(now) }
    case 'week':
      return { from: startOfDay(subDays(now, 6)), to: endOfDay(now) }
    case 'month':
      return { from: startOfDay(subDays(now, 29)), to: endOfDay(now) }
  }
}

export function useSalesForExport(period: DatePeriod) {
  const locationId = useAuthStore((s) => s.profile?.location_id)
  const { from, to } = periodToDates(period)

  const query = useQuery({
    queryKey: ['sales-export', locationId, period],
    queryFn: async () => {
      if (!locationId) return [] as SaleWithProduct[]
      const { data, error } = await supabase
        .from('sales')
        .select('*, products(name, product_type)')
        .eq('location_id', locationId)
        .gte('created_at', from.toISOString())
        .lte('created_at', to.toISOString())
        .order('created_at', { ascending: true })
      if (error) throw error
      return (data ?? []) as SaleWithProduct[]
    },
    enabled: !!locationId,
    staleTime: 30_000,
  })

  return { ...query, from, to, count: query.data?.length ?? 0 }
}
