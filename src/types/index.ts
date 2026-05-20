export type PaymentMethod = 'pix' | 'credit' | 'debit' | 'cash'

export type UserRole = 'admin' | 'staff'

export type ShiftStatus = 'open' | 'closed' | 'provisional'

export type WeightSource = 'scale' | 'manual'

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
}
