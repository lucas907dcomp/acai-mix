import { Package } from 'lucide-react'
import { useProductSalesSummary } from '@/hooks/useProductSalesSummary'
import { Skeleton } from '@/components/ui/skeleton'
import { CASQUINHA_PRICE } from '@/constants/pricing'
import type { DatePeriod } from '@/types/dashboard'

const fmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

interface Props {
  period: DatePeriod
}

export function ProductSalesBreakdown({ period }: Props) {
  const { data, isLoading, error } = useProductSalesSummary(period)

  const totalAmount = (data ?? []).reduce((s, r) => s + r.total_amount, 0)
  const totalCasquinha = (data ?? []).reduce((s, r) => s + r.casquinha_count, 0)

  if (isLoading) {
    return (
      <div className="rounded-xl border border-[#2d1550] bg-[#1a0b2e] p-4 space-y-3">
        <p className="text-sm font-medium text-[#9d7bc8] flex items-center gap-2">
          <Package className="w-4 h-4" />
          Vendas por produto
        </p>
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-full bg-[#2d1550]" />
        ))}
      </div>
    )
  }

  if (error || !data || data.length === 0) {
    return (
      <div className="rounded-xl border border-[#2d1550] bg-[#1a0b2e] p-4">
        <p className="text-sm font-medium text-[#9d7bc8] flex items-center gap-2 mb-2">
          <Package className="w-4 h-4" />
          Vendas por produto
        </p>
        <p className="text-xs text-[#4a3570] italic">Nenhuma venda no período selecionado.</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-[#2d1550] bg-[#1a0b2e] overflow-hidden">
      <div className="px-4 py-3 border-b border-[#2d1550]">
        <p className="text-sm font-medium text-[#9d7bc8] flex items-center gap-2">
          <Package className="w-4 h-4" />
          Vendas por produto
        </p>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[#2d1550]">
            <Th>Produto</Th>
            <Th right>Qtd</Th>
            <Th right>Receita</Th>
            <Th right>% Total</Th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => {
            const pct = totalAmount > 0 ? (row.total_amount / totalAmount) * 100 : 0
            return (
              <tr key={row.product_id} className="border-b border-[#2d1550] last:border-0">
                <td className="px-4 py-3">
                  <span className="text-white">{row.product_name}</span>
                  <span className="ml-1.5 text-[10px] text-[#4a3570]">
                    {row.product_type === 'weight' ? 'por peso' : 'unidade'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-[#9d7bc8]">{row.total_quantity}</td>
                <td className="px-4 py-3 text-right text-white font-medium">{fmt.format(row.total_amount)}</td>
                <td className="px-4 py-3 text-right text-[#9d7bc8]">{pct.toFixed(1)}%</td>
              </tr>
            )
          })}

          {totalCasquinha > 0 && (
            <tr className="border-t border-[#2d1550] bg-[#0f0720]">
              <td className="px-4 py-3 text-[#9d7bc8] italic text-xs">+ Casquinha (add-on)</td>
              <td className="px-4 py-3 text-right text-[#9d7bc8] text-xs">{totalCasquinha}</td>
              <td className="px-4 py-3 text-right text-[#10b981] font-medium text-xs">
                {fmt.format(totalCasquinha * CASQUINHA_PRICE)}
              </td>
              <td className="px-4 py-3 text-right text-[#9d7bc8] text-xs">—</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th
      className={`px-4 py-2 text-xs font-medium text-[#9d7bc8] uppercase tracking-wider ${right ? 'text-right' : 'text-left'}`}
    >
      {children}
    </th>
  )
}
