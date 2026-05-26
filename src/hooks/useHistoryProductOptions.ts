import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

export interface ProductOption {
  id: string
  name: string
  active: boolean
}

export function useHistoryProductOptions() {
  const locationId = useAuthStore((s) => s.profile?.location_id)

  return useQuery<ProductOption[]>({
    queryKey: ['history-product-options', locationId],
    queryFn: async () => {
      if (!locationId) return []
      const { data, error } = await supabase
        .from('products')
        .select('id, name, active')
        .eq('location_id', locationId)
        .order('name', { ascending: true })
      if (error) throw error
      return (data ?? []) as ProductOption[]
    },
    enabled: !!locationId,
    staleTime: 5 * 60 * 1000,
  })
}
