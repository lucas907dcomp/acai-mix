import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

export function usePricePerGram() {
  const locationId = useAuthStore((s) => s.profile?.location_id)

  return useQuery({
    queryKey: ['price-per-gram', locationId],
    queryFn: async () => {
      if (!locationId) throw new Error('No location')
      const { data, error } = await supabase
        .from('products')
        .select('price_per_gram')
        .eq('active', true)
        .eq('location_id', locationId)
        .eq('product_type', 'weight')
        .order('updated_at', { ascending: false })
        .limit(1)
        .single()

      if (error) throw error
      return data.price_per_gram as number
    },
    enabled: !!locationId,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  })
}
