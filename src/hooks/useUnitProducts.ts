import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import type { Product } from '@/types'

/**
 * Lists all unit-type products (product_type = 'unit') for the current location.
 * Includes inactive products — the admin needs to see everything to manage the catalog.
 *
 * Used by the admin "Produtos Avulsos" section in Settings (Story 10.3).
 * The PDV uses a separate query (['products', 'pdv', locationId]) that filters by
 * active = true.
 */
export function useUnitProducts() {
  const locationId = useAuthStore((s) => s.profile?.location_id)

  return useQuery<Product[]>({
    queryKey: ['products', 'unit', locationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select(
          'id, location_id, name, price_per_gram, active, updated_at, product_type, unit_price, sort_order, created_by, updated_by'
        )
        .eq('location_id', locationId!)
        .eq('product_type', 'unit')
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true })
      if (error) throw error
      return (data ?? []) as unknown as Product[]
    },
    enabled: !!locationId,
    staleTime: 30_000,
  })
}
