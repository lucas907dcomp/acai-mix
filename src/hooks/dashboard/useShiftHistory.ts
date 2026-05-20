import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { ShiftSummaryRow } from '@/types/dashboard'

export function useShiftHistory(locationId: string, limit = 10) {
  return useQuery<ShiftSummaryRow[]>({
    queryKey: ['shift-history', locationId, limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shift_summary')
        .select('*')
        .eq('location_id', locationId)
        .order('opened_at', { ascending: false })
        .limit(limit)
      if (error) throw error
      return (data ?? []) as ShiftSummaryRow[]
    },
    refetchInterval: 45_000,
    staleTime: 30_000,
    enabled: !!locationId,
  })
}
