import { useState } from 'react'
import { TrendingUp, ShoppingCart, Calculator } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { MetricCard } from '@/components/dashboard/MetricCard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useOwnerOverview } from '@/hooks/dashboard'
import type { DatePeriod } from '@/types/dashboard'

const fmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

const PERIODS: { value: DatePeriod; label: string }[] = [
  { value: 'today', label: 'Hoje' },
  { value: 'week', label: 'Semana' },
  { value: 'month', label: 'Mês' },
]

/**
 * Visão Geral (owner only) — EPIC-11 / Story 11.4. Consolidado +
 * breakdown por loja, reaproveitando `daily_summary` (mesma fonte do
 * Dashboard individual) via `useOwnerOverview`. Nenhuma lógica de
 * agregação nova no banco (AC5) — soma client-side dos resultados por
 * loja que a RLS aditiva (`shifts_select_owner`/`sales_select_owner`,
 * Story 11.2) já entrega corretamente.
 */
export default function OwnerOverview() {
  const [period, setPeriod] = useState<DatePeriod>('today')
  const profile = useAuthStore((s) => s.profile)
  const { consolidated, byLocation, isLoading } = useOwnerOverview(period)

  const avgTicket = consolidated.sales > 0 ? consolidated.amount / consolidated.sales : 0

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-white">Visão Geral</h1>
      </div>

      {/* Period selector */}
      <div className="flex gap-1 bg-[#1a0b2e] border border-[#2d1550] rounded-lg p-1 w-fit">
        {PERIODS.map((p) => (
          <button
            key={p.value}
            onClick={() => setPeriod(p.value)}
            className={`px-4 py-1.5 text-sm rounded-md transition-colors ${
              period === p.value
                ? 'bg-[#4c1e8c] text-white font-medium'
                : 'text-[#9d7bc8] hover:text-white hover:bg-[#2d1550]'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Consolidated totals */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <MetricCard
          title="Faturamento Consolidado"
          value={fmt.format(consolidated.amount)}
          subtitle={`${profile?.locations?.length ?? 0} loja(s)`}
          icon={<TrendingUp className="w-4 h-4" />}
          isLoading={isLoading}
        />
        <MetricCard
          title="Total de Vendas"
          value={consolidated.sales}
          subtitle="pedidos, todas as lojas"
          icon={<ShoppingCart className="w-4 h-4" />}
          isLoading={isLoading}
        />
        <MetricCard
          title="Ticket Médio"
          value={fmt.format(avgTicket)}
          subtitle="consolidado"
          icon={<Calculator className="w-4 h-4" />}
          isLoading={isLoading}
        />
      </div>

      {/* Breakdown por loja */}
      <Card className="bg-[#1a0b2e] border-[#2d1550]">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-[#9d7bc8]">Breakdown por Loja</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : byLocation.length === 0 ? (
            <p className="text-center text-[#9d7bc8] text-sm py-8">
              Nenhuma loja vinculada.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#2d1550]">
                    <th className="py-2 px-4 text-left text-xs text-[#9d7bc8] font-medium">Loja</th>
                    <th className="py-2 px-4 text-right text-xs text-[#9d7bc8] font-medium">Vendas</th>
                    <th className="py-2 px-4 text-right text-xs text-[#9d7bc8] font-medium">Faturamento</th>
                    <th className="py-2 px-4 text-right text-xs text-[#9d7bc8] font-medium">PIX</th>
                    <th className="py-2 px-4 text-right text-xs text-[#9d7bc8] font-medium">Cartão</th>
                    <th className="py-2 px-4 text-right text-xs text-[#9d7bc8] font-medium">Dinheiro</th>
                  </tr>
                </thead>
                <tbody>
                  {byLocation.map((loc) => (
                    <tr
                      key={loc.location_id}
                      className="border-b border-[#2d1550] hover:bg-[#2d1550]/30"
                    >
                      <td className="py-3 px-4 text-sm text-white font-medium">
                        {loc.location_name}
                      </td>
                      <td className="py-3 px-4 text-sm text-white text-right">{loc.sales}</td>
                      <td className="py-3 px-4 text-sm text-white text-right font-medium">
                        {fmt.format(loc.amount)}
                      </td>
                      <td className="py-3 px-4 text-sm text-[#9d7bc8] text-right">
                        {fmt.format(loc.pix)}
                      </td>
                      <td className="py-3 px-4 text-sm text-[#9d7bc8] text-right">
                        {fmt.format(loc.card)}
                      </td>
                      <td className="py-3 px-4 text-sm text-[#9d7bc8] text-right">
                        {fmt.format(loc.cash)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-[#4c1e8c]">
                    <td className="py-3 px-4 text-xs text-[#9d7bc8] font-medium">
                      Total ({byLocation.length} loja{byLocation.length !== 1 ? 's' : ''})
                    </td>
                    <td className="py-3 px-4 text-sm text-white text-right font-semibold">
                      {consolidated.sales}
                    </td>
                    <td className="py-3 px-4 text-sm text-white text-right font-semibold">
                      {fmt.format(consolidated.amount)}
                    </td>
                    <td className="py-3 px-4 text-sm text-white text-right font-semibold">
                      {fmt.format(consolidated.pix)}
                    </td>
                    <td className="py-3 px-4 text-sm text-white text-right font-semibold">
                      {fmt.format(consolidated.card)}
                    </td>
                    <td className="py-3 px-4 text-sm text-white text-right font-semibold">
                      {fmt.format(consolidated.cash)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
