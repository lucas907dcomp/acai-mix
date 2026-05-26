import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { useSyncStore } from '@/stores/syncStore'
import { db, type CachedProduct } from '@/providers/sync/DexieDatabase'

// EPIC-10 / Story 10.4 — TTL of the Dexie catalog cache.
// Five minutes balances catalog freshness with the offline-first
// requirement (AC9): the operator can keep the PDV open all day with
// the catalog still serving from IndexedDB if connectivity blips.
const CATALOG_TTL_MS = 5 * 60 * 1000

/**
 * EPIC-10 / Story 10.4 — PDV catalog hook.
 *
 * Lists unit-type products (`product_type = 'unit'`, `active = true`)
 * for the operator's location, ordered by `sort_order ASC, name ASC`.
 *
 * Online: fetches from Supabase via TanStack Query, mirrors the
 * result into Dexie `product_catalog` with `cached_at = Date.now()`.
 * The mirror is rebuilt per fetch (delete-then-bulkPut) to avoid
 * stale rows accumulating after admin deletions.
 *
 * Offline: when the network is down the queryFn falls back to Dexie
 * and returns the cached rows. We do NOT enforce the TTL when
 * offline — operators must keep working with whatever they have,
 * even on a long disconnect (AC6, T6 decision documented in the
 * story).
 *
 * Query key: `['products', 'pdv', locationId]` — invalidated by the
 * admin form on save so the operator sees changes within ~30s with
 * window focus refetch.
 */
export function useProductCatalogPDV() {
  const locationId = useAuthStore((s) => s.profile?.location_id)
  const isOnline = useSyncStore((s) => s.isOnline)

  const query = useQuery<CachedProduct[]>({
    queryKey: ['products', 'pdv', locationId],
    enabled: !!locationId,
    staleTime: CATALOG_TTL_MS,
    queryFn: async () => {
      if (!locationId) return []

      // Offline fast-path: serve from Dexie without touching network.
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        return readFromCache(locationId)
      }

      try {
        const { data, error } = await supabase
          .from('products')
          .select('id, location_id, name, unit_price, product_type, sort_order, active')
          .eq('location_id', locationId)
          .eq('product_type', 'unit')
          .eq('active', true)
          .order('sort_order', { ascending: true })
          .order('name', { ascending: true })

        if (error) throw error

        const rows = (data ?? []).filter(
          (p): p is CachedProduct & { unit_price: number } =>
            p.unit_price !== null && p.unit_price !== undefined
        )

        await writeToCache(locationId, rows)
        return rows
      } catch (err) {
        // Network failure: degrade to the Dexie mirror so the PDV
        // keeps working. Throw only if cache is also empty so the
        // UI can surface the error to the operator.
        const cached = await readFromCache(locationId)
        if (cached.length > 0) return cached
        throw err
      }
    },
  })

  // Refetch when the tab comes back online so the catalog warms up
  // before the operator opens the modal (AC10 edge case is handled
  // at click time, but a background refetch avoids a stale-by-the-
  // second window).
  useEffect(() => {
    if (isOnline) query.refetch()
    // We intentionally depend only on `isOnline` — refetch identity
    // is stable enough for this transition trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline])

  return query
}

async function readFromCache(locationId: string): Promise<CachedProduct[]> {
  const rows = await db.product_catalog
    .where('location_id')
    .equals(locationId)
    .filter((p) => p.product_type === 'unit' && p.active)
    .sortBy('sort_order')
  // Stable secondary order by name to match the Supabase query
  // ordering exactly — keeps the UI deterministic between
  // online/offline reads.
  return rows.sort((a, b) => {
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order
    return a.name.localeCompare(b.name, 'pt-BR')
  })
}

async function writeToCache(
  locationId: string,
  rows: Array<Omit<CachedProduct, 'cached_at'>>,
): Promise<void> {
  const cached_at = Date.now()
  // Rebuild the location's slice atomically. We do NOT clear other
  // locations to keep multi-tenant operators (e.g. franchise staff
  // who switch profiles) usable offline.
  await db.transaction('rw', db.product_catalog, async () => {
    await db.product_catalog.where('location_id').equals(locationId).delete()
    await db.product_catalog.bulkPut(
      rows.map((p) => ({ ...p, cached_at }) as CachedProduct),
    )
  })
}

export { CATALOG_TTL_MS }
