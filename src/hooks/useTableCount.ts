import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

/**
 * Quantas mesas fixas a loja tem. Qualquer falha vira 0: o PDV fica como sempre
 * foi. `undefined` = ainda carregando.
 */
export function useTableCount(): number | undefined {
  const locationId = useAuthStore((s) => s.profile?.location_id)
  const { data } = useQuery<number>({
    queryKey: ['table-count', locationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('locations')
        .select('table_count')
        .eq('id', locationId!)
        .single()
      return error ? 0 : (data?.table_count ?? 0)
    },
    enabled: !!locationId,
    staleTime: 10 * 60_000,
  })
  return data
}
