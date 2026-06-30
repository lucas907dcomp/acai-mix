import { useState } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useShiftHistory } from '@/hooks/dashboard/useShiftHistory'
import type { ShiftSummaryRow } from '@/types/dashboard'

const fmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

function formatTime(iso: string) {
  return format(new Date(iso), 'HH:mm', { locale: ptBR })
}

function ShiftRow({ shift }: { shift: ShiftSummaryRow }) {
  const [expanded, setExpanded] = useState(false)
  const isOpen = shift.status === 'open'

  return (
    <>
      <tr
        className="border-b border-[#2d1550] hover:bg-[#2d1550]/30 cursor-pointer transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        <td className="py-3 px-4 text-sm">
          <div className="flex items-center gap-2">
            {expanded ? (
              <ChevronDown className="w-3.5 h-3.5 text-[#9d7bc8] flex-shrink-0" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-[#9d7bc8] flex-shrink-0" />
            )}
            <span className="text-white font-medium">Turno {shift.shift_number}</span>
            {isOpen && (
              <Badge className="bg-green-900/40 text-green-400 border-green-800 text-xs py-0">
                Em andamento
              </Badge>
            )}
          </div>
        </td>
        <td className="py-3 px-4 text-sm text-[#9d7bc8]">
          {formatTime(shift.opened_at)}
          {' — '}
          {shift.closed_at ? formatTime(shift.closed_at) : 'agora'}
        </td>
        <td className="py-3 px-4 text-sm text-white text-right">{shift.total_sales}</td>
        <td className="py-3 px-4 text-sm text-white text-right font-medium">
          {fmt.format(Number(shift.total_amount))}
        </td>
        <td className="py-3 px-4 text-sm text-[#9d7bc8] text-right">
          {fmt.format(Number(shift.avg_ticket))}
        </td>
      </tr>
      {expanded && (
        <tr className="border-b border-[#2d1550] bg-[#150926]">
          <td colSpan={5} className="px-8 py-3">
            <div className="flex gap-6 text-sm">
              <span className="text-[#9d7bc8]">
                PIX: <span className="text-white">{fmt.format(Number(shift.total_pix))}</span>
              </span>
              <span className="text-[#9d7bc8]">
                Cartão: <span className="text-white">{fmt.format(Number(shift.total_card))}</span>
              </span>
              <span className="text-[#9d7bc8]">
                Dinheiro: <span className="text-white">{fmt.format(Number(shift.total_cash))}</span>
              </span>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

interface ShiftBreakdownProps {
  locationId: string
}

export function ShiftBreakdown({ locationId }: ShiftBreakdownProps) {
  const { data, isLoading } = useShiftHistory(locationId, 10)

  const openShifts = data?.filter((s) => s.status === 'open') ?? []
  const closedShifts = data?.filter((s) => s.status !== 'open') ?? []
  const sorted = [...openShifts, ...closedShifts]

  const totals = sorted.reduce(
    (acc, s) => ({
      sales: acc.sales + Number(s.total_sales),
      amount: acc.amount + Number(s.total_amount),
    }),
    { sales: 0, amount: 0 }
  )

  return (
    <Card className="bg-[#1a0b2e] border-[#2d1550]">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-[#9d7bc8]">
          Histórico de Turnos
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <p className="text-center text-[#9d7bc8] text-sm py-8">Nenhum turno registrado.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#2d1550]">
                  <th className="py-2 px-4 text-left text-xs text-[#9d7bc8] font-medium">Turno</th>
                  <th className="py-2 px-4 text-left text-xs text-[#9d7bc8] font-medium">Horário</th>
                  <th className="py-2 px-4 text-right text-xs text-[#9d7bc8] font-medium">Vendas</th>
                  <th className="py-2 px-4 text-right text-xs text-[#9d7bc8] font-medium">Faturamento</th>
                  <th className="py-2 px-4 text-right text-xs text-[#9d7bc8] font-medium">Ticket Médio</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((shift) => (
                  <ShiftRow key={shift.id} shift={shift} />
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-[#4c1e8c]">
                  <td colSpan={2} className="py-3 px-4 text-xs text-[#9d7bc8] font-medium">
                    Total ({sorted.length} turno{sorted.length !== 1 ? 's' : ''})
                  </td>
                  <td className="py-3 px-4 text-sm text-white text-right font-semibold">
                    {totals.sales}
                  </td>
                  <td className="py-3 px-4 text-sm text-white text-right font-semibold">
                    {fmt.format(totals.amount)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
