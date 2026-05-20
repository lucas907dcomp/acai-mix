import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import type { Sale } from '@/types'

const PAYMENT_LABELS: Record<string, string> = {
  pix: 'PIX',
  credit: 'Crédito',
  debit: 'Débito',
  cash: 'Dinheiro',
}

const fmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

interface SalesHistoryTableProps {
  sales: Sale[]
  isLoading: boolean
}

export function SalesHistoryTable({ sales, isLoading }: SalesHistoryTableProps) {
  if (isLoading) {
    return (
      <div className="rounded-xl border border-[#2d1550] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#2d1550] bg-[#1a0b2e]">
              <TableHead>Data/Hora</TableHead>
              <TableHead>Peso</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Pagamento</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Ações</TableHead>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 3 }).map((_, i) => (
              <tr key={i} className="border-b border-[#2d1550]">
                {Array.from({ length: 6 }).map((_, j) => (
                  <td key={j} className="px-4 py-3">
                    <Skeleton className="h-4 w-full" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  if (sales.length === 0) {
    return (
      <div className="rounded-xl border border-[#2d1550] bg-[#1a0b2e] p-12 text-center">
        <p className="text-[#9d7bc8] text-sm">Nenhuma venda encontrada com os filtros selecionados.</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-[#2d1550] overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[#2d1550] bg-[#1a0b2e]">
            <TableHead>Data/Hora</TableHead>
            <TableHead>Peso</TableHead>
            <TableHead>Valor</TableHead>
            <TableHead>Pagamento</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Ações</TableHead>
          </tr>
        </thead>
        <tbody>
          {sales.map((sale) => {
            const isCancelled = (sale.status ?? 'COMPLETED') === 'CANCELLED'
            return (
              <tr
                key={sale.id}
                className={`border-b border-[#2d1550] last:border-0 ${isCancelled ? 'opacity-50' : ''}`}
              >
                <td className="px-4 py-3 text-[#9d7bc8] whitespace-nowrap">
                  {format(new Date(sale.created_at), 'dd/MM/yy HH:mm', { locale: ptBR })}
                </td>
                <td className="px-4 py-3 text-white">{sale.weight_grams}g</td>
                <td className="px-4 py-3 text-white">
                  <span className={isCancelled ? 'line-through' : ''}>
                    {fmt.format(sale.amount)}
                  </span>
                </td>
                <td className="px-4 py-3 text-[#9d7bc8]">
                  {PAYMENT_LABELS[sale.payment_method] ?? sale.payment_method}
                </td>
                <td className="px-4 py-3">
                  {isCancelled ? (
                    <Badge variant="outline" className="text-[#9d7bc8] border-[#2d1550] text-xs">
                      Cancelada
                    </Badge>
                  ) : null}
                </td>
                <td className="px-4 py-3">
                  <button
                    disabled
                    title="Cancelamento disponível em breve"
                    className="text-xs text-red-400/40 disabled:cursor-not-allowed"
                  >
                    Cancelar
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function TableHead({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-3 text-left text-xs font-medium text-[#9d7bc8] uppercase tracking-wider">
      {children}
    </th>
  )
}
