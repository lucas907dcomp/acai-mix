import { useState } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { BarChart2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useShiftHistory } from '@/hooks/dashboard/useShiftHistory'
import { useDailySummary } from '@/hooks/dashboard/useDailySummary'
import type { DatePeriod } from '@/types/dashboard'

const fmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ value: number; payload: { count?: number } }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#1a0b2e] border border-[#2d1550] rounded-lg p-3 text-sm">
      <p className="text-[#9d7bc8] mb-1">{label}</p>
      <p className="text-white font-semibold">{fmt.format(payload[0].value)}</p>
      {payload[0].payload.count != null && (
        <p className="text-[#9d7bc8] text-xs">{payload[0].payload.count} venda(s)</p>
      )}
    </div>
  )
}

interface SalesChartProps {
  locationId: string
  period: DatePeriod
}

export function SalesChart({ locationId, period }: SalesChartProps) {
  const [mode, setMode] = useState<'by-shift' | 'by-day'>('by-day')

  const shiftQuery = useShiftHistory(locationId, 14)
  const dailyQuery = useDailySummary(locationId, period)

  const isLoading = mode === 'by-shift' ? shiftQuery.isLoading : dailyQuery.isLoading

  const data =
    mode === 'by-shift'
      ? (shiftQuery.data ?? [])
          .filter((s) => s.status !== 'provisional')
          .slice(0, 10)
          .reverse()
          .map((s) => ({
            name: `T${s.shift_number} ${format(new Date(s.opened_at), 'dd/MM')}`,
            value: Number(s.total_amount),
            count: Number(s.total_sales),
          }))
      : (dailyQuery.data ?? []).map((d) => ({
          name: format(new Date(d.sale_date + 'T12:00:00'), 'dd/MM', { locale: ptBR }),
          value: Number(d.total_amount),
          count: Number(d.total_sales),
        }))

  return (
    <Card className="bg-[#1a0b2e] border-[#2d1550]">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-[#9d7bc8] flex items-center gap-2">
          <BarChart2 className="w-4 h-4" />
          Evolução de Vendas
        </CardTitle>
        <div className="flex gap-1">
          {(['by-day', 'by-shift'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`text-xs px-2 py-1 rounded transition-colors ${
                mode === m
                  ? 'bg-[#4c1e8c] text-white'
                  : 'text-[#9d7bc8] hover:bg-[#2d1550] hover:text-white'
              }`}
            >
              {m === 'by-day' ? 'Por Dia' : 'Por Turno'}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-[300px] w-full" />
        ) : data.length === 0 ? (
          <div className="h-[300px] flex flex-col items-center justify-center text-[#9d7bc8]">
            <BarChart2 className="w-10 h-10 mb-2 opacity-30" />
            <p className="text-sm">Nenhuma venda registrada neste período</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2d1550" vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fill: '#9d7bc8', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
                tick={{ fill: '#9d7bc8', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={50}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: '#2d1550' }} />
              <Bar dataKey="value" fill="#5B2D8E" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}
