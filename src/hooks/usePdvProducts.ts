import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { db } from '@/providers/sync/DexieDatabase'
import type { Product } from '@/types'

const CATALOG_TTL_MS = 5 * 60 * 1000 // 5 minutes

/**
 * Returns active unit-type products for the current location, for use in the PDV
 * product picker (Story 10.4).
 *
 * Online:  Fetches from Supabase, writes result to Dexie product_catalog.
 * Offline: Falls back to Dexie cache if within TTL.
 *
 * Query key: ['products', 'pdv', locationId]
 * staleTime: 5 min — catalog changes rarely, and invalidation is pushed by
 * useProductMutations (Story 10.3) whenever admin edits a product.
 */
export function usePdvProducts() {
  const locationId = useAuthStore((s) => s.profile?.location_id)

  return useQuery<Product[]>({
    queryKey: ['products', 'pdv', locationId],
    queryFn: async () => {
      if (!locationId) return []

      // Try Supabase first
      if (navigator.onLine) {
        const { data, error } = await supabase
          .from('products')
          .select(
            'id, location_id, name, price_per_gram, unit_price, product_type, sort_order, active, updated_at, created_by, updated_by'
          )
          .eq('location_id', locationId)
          .eq('product_type', 'unit')
          .eq('active', true)
          .order('sort_order', { ascending: true })
          .order('name', { ascending: true })

        if (error) throw error

        const products = (data ?? []) as unknown as Product[]

        // Persist to Dexie for offline fallback
        await db.product_catalog.where('location_id').equals(locationId).delete()
        if (products.length > 0) {
          await db.product_catalog.bulkPut(
            products.map((p) => ({
              id: p.id,
              location_id: p.location_id,
              name: p.name,
              unit_price: p.unit_price ?? 0,
              product_type: p.product_type ?? 'unit',
              sort_order: p.sort_order ?? 0,
              active: p.active,
              cached_at: Date.now(),
            }))
          )
        }

        return products
      }

      // Offline fallback — serve from Dexie within TTL
      const now = Date.now()
      const cached = await db.product_catalog
        .where('location_id')
        .equals(locationId)
        .filter((p) => p.active && now - p.cached_at < CATALOG_TTL_MS)
        .sortBy('sort_order')

      return cached.map((p) => ({
        id: p.id,
        location_id: p.location_id,
        name: p.name,
        price_per_gram: 0,
        unit_price: p.unit_price,
        product_type: p.product_type,
        sort_order: p.sort_order,
        active: p.active,
        updated_at: new Date(p.cached_at).toISOString(),
      })) as Product[]
    },
    enabled: !!locationId,
    staleTime: CATALOG_TTL_MS,
    retry: (count) => navigator.onLine && count < 2,
  })
}
