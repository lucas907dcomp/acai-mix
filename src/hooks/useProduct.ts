import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

export interface ProductData {
  id: string
  price_per_gram: number
}

export function useProduct() {
  const locationId = useAuthStore((s) => s.profile?.location_id)

  return useQuery<ProductData>({
    queryKey: ['product', locationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('id, price_per_gram')
        .eq('active', true)
        .eq('location_id', locationId!)
        .eq('product_type', 'weight')
        .order('updated_at', { ascending: false })
        .limit(1)
        .single()
      if (error) throw error
      return { id: data.id, price_per_gram: Number(data.price_per_gram) }
    },
    enabled: !!locationId,
    staleTime: 5 * 60_000,
  })
}
