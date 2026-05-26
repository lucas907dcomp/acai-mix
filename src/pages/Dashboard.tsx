import { useState } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Download, RefreshCw, TrendingUp, ShoppingCart, Calculator, BarChart2 } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/authStore'
import { MetricCard } from '@/components/dashboard/MetricCard'
import { SalesChart } from '@/components/dashboard/SalesChart'
import { ShiftBreakdown } from '@/components/dashboard/ShiftBreakdown'
import { PaymentBreakdown } from '@/components/dashboard/PaymentBreakdown'
import { ProductSalesBreakdown } from '@/components/dashboard/ProductSalesBreakdown'
import { useTodayAndYesterday, useDailySummary } from '@/hooks/dashboard'
import { useSalesForExport } from '@/hooks/useSalesForExport'
import { generateSalesCsv } from '@/utils/csv'
import type { DatePeriod } from '@/types/dashboard'

const fmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

const PERIODS: { value: DatePeriod; label: string }[] = [
  { value: 'today', label: 'Hoje' },
  { value: 'week', label: 'Semana' },
  { value: 'month', label: 'Mês' },
]

function calcTrend(today: number, yesterday: number) {
  if (!yesterday) return undefined
  const pct = ((today - yesterday) / yesterday) * 100
  return {
    value: Math.abs(pct),
    direction: pct > 0 ? ('up' as const) : pct < 0 ? ('down' as const) : ('neutral' as const),
  }
}

export default function Dashboard() {
  const [period, setPeriod] = useState<DatePeriod>('today')
  const [lastRefreshed, setLastRefreshed] = useState(new Date())
  const queryClient = useQueryClient()
  const exportQuery = useSalesForExport(period)

  const profile = useAuthStore((s) => s.profile)
  const locationId = profile?.location_id ?? ''

  const trendQuery = useTodayAndYesterday(locationId)
  const periodQuery = useDailySummary(locationId, period)

  const todayRow = trendQuery.data?.today
  const yesterdayRow = trendQuery.data?.yesterday

  const periodTotals = (periodQuery.data ?? []).reduce(
    (acc, d) => ({
      sales: acc.sales + Number(d.total_sales),
      amount: acc.amount + Number(d.total_amount),
      pix: acc.pix + Number(d.total_pix),
      card: acc.card + Number(d.total_card),
      cash: acc.cash + Number(d.total_cash),
    }),
    { sales: 0, amount: 0, pix: 0, card: 0, cash: 0 }
  )

  const paymentTotals =
    period === 'today'
      ? {
          pix: Number(todayRow?.total_pix ?? 0),
          card: Number(todayRow?.total_card ?? 0),
          cash: Number(todayRow?.total_cash ?? 0),
          total: Number(todayRow?.total_amount ?? 0),
        }
      : {
          pix: periodTotals.pix,
          card: periodTotals.card,
          cash: periodTotals.cash,
          total: periodTotals.amount,
        }

  const periodAvgTicket =
    periodTotals.sales > 0 ? periodTotals.amount / periodTotals.sales : 0

  const isLoading = trendQuery.isLoading || periodQuery.isLoading

  function handleRefresh() {
    queryClient.invalidateQueries({ queryKey: ['shift-history', locationId] })
    queryClient.invalidateQueries({ queryKey: ['daily-summary', locationId] })
    queryClient.invalidateQueries({ queryKey: ['daily-summary-trend', locationId] })
    setLastRefreshed(new Date())
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-white">Dashboard</h1>
        <div className="flex items-center gap-3">
          <span className="text-xs text-[#9d7bc8]">
            Atualizado às {format(lastRefreshed, 'HH:mm', { locale: ptBR })}
          </span>
          <button
            onClick={() => {
              if (exportQuery.data && exportQuery.data.length > 0) {
                generateSalesCsv(exportQuery.data, exportQuery.from, exportQuery.to)
              }
            }}
            disabled={!exportQuery.data || exportQuery.data.length === 0 || exportQuery.isLoading}
            className="flex items-center gap-1.5 text-xs text-[#9d7bc8] hover:text-white transition-colors px-2 py-1 rounded hover:bg-[#2d1550] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Download className="w-3.5 h-3.5" />
            Exportar CSV
          </button>
          <button
            onClick={handleRefresh}
            className="flex items-center gap-1.5 text-xs text-[#9d7bc8] hover:text-white transition-colors px-2 py-1 rounded hover:bg-[#2d1550]"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Atualizar
          </button>
        </div>
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

      {/* Metric cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Faturamento"
          value={fmt.format(period === 'today' ? Number(todayRow?.total_amount ?? 0) : periodTotals.amount)}
          subtitle={period === 'today' ? 'hoje' : period === 'week' ? 'últimos 7 dias' : 'últimos 30 dias'}
          icon={<TrendingUp className="w-4 h-4" />}
          trend={
            period === 'today'
              ? calcTrend(Number(todayRow?.total_amount ?? 0), Number(yesterdayRow?.total_amount ?? 0))
              : undefined
          }
          isLoading={isLoading}
        />
        <MetricCard
          title="Total de Vendas"
          value={period === 'today' ? Number(todayRow?.total_sales ?? 0) : periodTotals.sales}
          subtitle="pedidos"
          icon={<ShoppingCart className="w-4 h-4" />}
          trend={
            period === 'today'
              ? calcTrend(Number(todayRow?.total_sales ?? 0), Number(yesterdayRow?.total_sales ?? 0))
              : undefined
          }
          isLoading={isLoading}
        />
        <MetricCard
          title="Ticket Médio"
          value={fmt.format(
            period === 'today' ? Number(todayRow?.avg_ticket ?? 0) : periodAvgTicket
          )}
          subtitle="por pedido"
          icon={<Calculator className="w-4 h-4" />}
          trend={
            period === 'today'
              ? calcTrend(Number(todayRow?.avg_ticket ?? 0), Number(yesterdayRow?.avg_ticket ?? 0))
              : undefined
          }
          isLoading={isLoading}
        />
        <MetricCard
          title="Turnos no Período"
          value={
            period === 'today'
              ? Number(todayRow?.total_shifts ?? 0)
              : (periodQuery.data ?? []).reduce((a, d) => a + Number(d.total_shifts), 0)
          }
          subtitle="turnos"
          icon={<BarChart2 className="w-4 h-4" />}
          isLoading={isLoading}
        />
      </div>

      {/* Payment breakdown */}
      <PaymentBreakdown
        pix={paymentTotals.pix}
        card={paymentTotals.card}
        cash={paymentTotals.cash}
        total={paymentTotals.total}
        isLoading={isLoading}
      />

      {/* Sales chart */}
      <SalesChart locationId={locationId} period={period} />

      {/* Shift breakdown */}
      <ShiftBreakdown locationId={locationId} />

      {/* Product breakdown */}
      <ProductSalesBreakdown period={period} />
    </div>
  )
}
