export type PaymentMethod = 'pix' | 'card' | 'cash'

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
  name: string
  price_per_gram: number
  active: boolean
  created_at: string
}

export interface Shift {
  id: string
  location_id: string
  opened_by: string
  opened_at: string
  closed_at: string | null
  status: ShiftStatus
  total_sales: number
  total_amount: number
}

export interface Sale {
  id: string
  shift_id: string
  location_id: string
  weight_grams: number
  weight_source: WeightSource
  price_per_gram: number
  total_amount: number
  payment_method: PaymentMethod
  sync_reconciled: boolean
  created_offline: boolean
  created_at: string
}
