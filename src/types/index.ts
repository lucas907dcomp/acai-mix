export type PaymentMethod = 'pix' | 'credit' | 'debit' | 'cash'

export type UserRole = 'admin' | 'staff'

export type ShiftStatus = 'open' | 'closed' | 'provisional'

export type WeightSource = 'scale' | 'manual'

// EPIC-10 / Story 10.2 — multi-product catalog
export type ProductType = 'weight' | 'unit'

export interface Location {
  id: string
  name: string
  created_at: string
}

export interface UserProfile {
  id: string
  location_id: string
  role: UserRole
  display_name: string
  created_at: string
}

export interface Product {
  id: string
  location_id: string
  name: string
  price_per_gram: number
  active: boolean
  updated_at: string
  // Added in EPIC-10 / Story 10.2.
  // Existing rows are migrated to product_type='weight' and
  // unit_price=NULL by migration 010, so non-optional fields here
  // are safe.
  product_type: ProductType
  unit_price: number | null
  sort_order: number
  created_by?: string | null
  updated_by?: string | null
}

export interface Shift {
  id: string
  location_id: string
  shift_number: number
  opened_at: string
  opened_by: string
  closed_at: string | null
  closed_by: string | null
  status: ShiftStatus
  total_sales: number
  total_pix: number
  total_card: number
  total_cash: number
  sale_count: number
}

export type SaleStatus = 'COMPLETED' | 'CANCELLED'

export interface Sale {
  id: string
  shift_id: string
  location_id: string
  weight_grams: number
  weight_source: WeightSource
  price_per_gram: number
  amount: number
  payment_method: PaymentMethod
  amount_received: number | null
  change_returned: number | null
  sync_reconciled: boolean
  synced_at: string | null
  created_offline: boolean
  created_at: string
  // Added in Fase 2 — optional: DB DEFAULT 'COMPLETED', not sent on INSERT
  status?: SaleStatus
  cancelled_at?: string | null
  cancelled_by?: string | null
  // Added in EPIC-10 / Story 10.2 — all optional to preserve
  // backward compat with legacy clients that omit them. The edge
  // function `sync-sales` applies server-side defaults
  // (has_casquinha=false, product_id=resolved-açaí, quantity=1).
  has_casquinha?: boolean
  product_id?: string | null
  quantity?: number
  // Pedidos Conjuntos — all optional, only present on combined sales
  is_combined?: boolean
  combined_order_name?: string | null
  combined_items?: CombinedItemRecord[] | null
}

export type CombinedItemRecord =
  | {
      type: 'weight'
      weight_grams: number
      price_per_gram: number
      has_casquinha: boolean
      product_id: string | null
      amount: number
    }
  | {
      type: 'unit'
      product_id: string
      product_name: string
      quantity: number
      unit_price: number
      amount: number
    }

export interface EmployeeConsumption {
  id: string
  user_id: string
  location_id: string
  amount: number
  description: string | null
  consumed_at: string
  created_by: string
  created_at: string
}

// Extends Sale with the joined products row returned by Supabase when
// using `.select('*, products(name, product_type)')`. The field is
// optional/nullable because legacy rows may predate the product join.
export interface SaleWithProduct extends Sale {
  products?: {
    name: string
    product_type: ProductType
  } | null
}
