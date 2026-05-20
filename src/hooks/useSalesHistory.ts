import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import type { Sale, PaymentMethod, SaleStatus } from '@/types'

const PAGE_SIZE = 50

interface UseSalesHistoryParams {
  from: Date
  to: Date
  paymentMethods: PaymentMethod[]
  statuses: SaleStatus[]
  page: number
}

export function useSalesHistory({ from, to, paymentMethods, statuses, page }: UseSalesHistoryParams) {
  const locationId = useAuthStore((s) => s.profile?.location_id)

  return useQuery({
    queryKey: ['sales-history', locationId, from.toISOString(), to.toISOString(), paymentMethods, statuses, page],
    queryFn: async () => {
      if (!locationId) return { data: [] as Sale[], count: 0, totalPages: 0 }

      let query = supabase
        .from('sales')
        .select('*', { count: 'exact' })
        .eq('location_id', locationId)
        .gte('created_at', from.toISOString())
        .lte('created_at', to.toISOString())
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1)

      if (paymentMethods.length > 0) {
        query = query.in('payment_method', paymentMethods)
      }
      if (statuses.length > 0) {
        query = query.in('status', statuses)
      }

      const { data, error, count } = await query
      if (error) throw error

      const total = count ?? 0
      return {
        data: (data ?? []) as Sale[],
        count: total,
        totalPages: Math.ceil(total / PAGE_SIZE),
      }
    },
    enabled: !!locationId,
    staleTime: 15_000,
    placeholderData: (prev) => prev,
  })
}

export { PAGE_SIZE }
