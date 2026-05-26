import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { periodToDates } from '@/hooks/useSalesForExport'
import type { DatePeriod } from '@/types/dashboard'
import type { ProductType } from '@/types'

export interface ProductSaleRow {
  product_id: string
  product_name: string
  product_type: ProductType
  total_sales: number
  total_quantity: number
  total_amount: number
  casquinha_count: number
}

export function useProductSalesSummary(period: DatePeriod) {
  const locationId = useAuthStore((s) => s.profile?.location_id)
  const { from, to } = periodToDates(period)

  return useQuery<ProductSaleRow[]>({
    queryKey: ['product-sales-summary', locationId, period],
    queryFn: async () => {
      if (!locationId) return []

      // LEFT JOIN so legacy rows without product_id don't get excluded.
      // status filter: include COMPLETED + NULL (rows predating the status column).
      const { data, error } = await supabase
        .from('sales')
        .select('amount, quantity, has_casquinha, products(id, name, product_type)')
        .eq('location_id', locationId)
        .or('status.eq.COMPLETED,status.is.null')
        .gte('created_at', from.toISOString())
        .lte('created_at', to.toISOString())

      if (error) throw error

      // Aggregate rows by product client-side.
      const map = new Map<string, ProductSaleRow>()
      for (const sale of data ?? []) {
        const prod = sale.products as { id: string; name: string; product_type: ProductType } | null
        if (!prod) continue
        const key = prod.id
        const qty = (sale.quantity as number | null) ?? 1
        const amt = Number(sale.amount)
        const hasCasq = (sale.has_casquinha as boolean | null) ?? false
        const existing = map.get(key)
        if (existing) {
          existing.total_sales += 1
          existing.total_quantity += qty
          existing.total_amount = Math.round((existing.total_amount + amt) * 100) / 100
          if (hasCasq) existing.casquinha_count += 1
        } else {
          map.set(key, {
            product_id: key,
            product_name: prod.name,
            product_type: prod.product_type,
            total_sales: 1,
            total_quantity: qty,
            total_amount: Math.round(amt * 100) / 100,
            casquinha_count: hasCasq ? 1 : 0,
          })
        }
      }

      return Array.from(map.values()).sort((a, b) => b.total_amount - a.total_amount)
    },
    enabled: !!locationId,
    staleTime: 30_000,
  })
}
