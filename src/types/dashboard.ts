export type DatePeriod = 'today' | 'week' | 'month'

export interface ShiftSummaryRow {
  id: string
  location_id: string
  shift_number: number
  opened_at: string
  closed_at: string | null
  status: 'open' | 'closed' | 'provisional'
  opened_by: string
  total_sales: number
  total_amount: number
  avg_ticket: number
  total_pix: number
  total_card: number
  total_cash: number
  duration_minutes: number
}

export interface DailySummaryRow {
  sale_date: string
  location_id: string
  total_sales: number
  total_amount: number
  avg_ticket: number
  total_shifts: number
  total_pix: number
  total_card: number
  total_cash: number
}
