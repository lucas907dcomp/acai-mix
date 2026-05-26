import Dexie, { type Table } from 'dexie'
import type { ProductType, Sale } from '@/types'

export interface PendingSale extends Sale {
  local_id?: number
  synced: boolean
  sync_attempts: number
  last_sync_error?: string
}

export interface ProvisionalShift {
  local_id: string
  location_id: string
  shift_number: number
  opened_at: string
  opened_by: string
  status: 'provisional' | 'synced'
  remote_id?: string
}

// EPIC-10 / Story 10.2 — cached product catalog for offline-first
// product picker. The PWA needs to render the catalog instantly
// when the operator opens the PDV, even without connectivity, so we
// mirror the active subset of `products` into IndexedDB.
//
// `cached_at` is a millisecond epoch timestamp used by the
// catalog-sync layer to enforce a TTL and trigger background
// refresh. The actual TTL value is owned by the sync layer, not
// this storage definition.
export interface CachedProduct {
  id: string
  location_id: string
  name: string
  unit_price: number
  product_type: ProductType
  sort_order: number
  active: boolean
  cached_at: number
}

class AcaiMixDatabase extends Dexie {
  pending_sales!: Table<PendingSale, number>
  provisional_shifts!: Table<ProvisionalShift, string>
  product_catalog!: Table<CachedProduct, string>

  constructor() {
    super('acaimix')
    this.version(2).stores({
      pending_sales: '++local_id, id, shift_id, created_at, payment_method, synced',
    })
    this.version(3).stores({
      pending_sales: '++local_id, id, shift_id, created_at, payment_method, synced',
      provisional_shifts: 'local_id, status, location_id',
    })
    // EPIC-10 / Story 10.2 — adds product_catalog for offline-first
    // catalog rendering. No data migration step is needed because
    // the catalog is rebuilt from Supabase on first online sync.
    this.version(4).stores({
      pending_sales: '++local_id, id, shift_id, created_at, payment_method, synced',
      provisional_shifts: 'local_id, status, location_id',
      product_catalog: 'id, location_id, product_type, active',
    })
  }
}

export const db = new AcaiMixDatabase()
