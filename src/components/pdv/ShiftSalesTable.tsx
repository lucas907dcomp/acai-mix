import { useQuery } from '@tanstack/react-query'
import { PenLine } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useShiftStore } from '@/stores/shiftStore'
import { formatCurrency } from '@/stores/saleStore'
import type { Sale } from '@/types'

async function fetchShiftSales(shiftId: string): Promise<Sale[]> {
  const { data, error } = await supabase
    .from('sales')
    .select('*')
    .eq('shift_id', shiftId)
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) throw error
  return data as Sale[]
}

const METHOD_LABEL: Record<string, string> = {
  pix: 'PIX',
  card: 'Cartão',
  cash: 'Dinheiro',
}

export function ShiftSalesTable() {
  const activeShift = useShiftStore((s) => s.activeShift)

  const { data: sales = [], isLoading } = useQuery({
    queryKey: ['shift-sales', activeShift?.id],
    queryFn: () => fetchShiftSales(activeShift!.id),
    enabled: !!activeShift,
    refetchInterval: 10_000,
  })

  const total = sales.reduce((sum, s) => sum + s.amount, 0)

  return (
    <div className="flex flex-col h-full rounded-xl bg-[#1a0b2e] border border-[#2d1550] overflow-hidden">
      <div className="px-4 py-3 border-b border-[#2d1550]">
        <h3 className="text-sm font-semibold text-white">Vendas do turno</h3>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-24 text-[#9d7bc8] text-sm">
            Carregando...
          </div>
        ) : sales.length === 0 ? (
          <div className="flex items-center justify-center h-24 text-[#4a3570] text-sm">
            Nenhuma venda neste turno
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-[#1a0b2e]">
              <tr className="text-[#9d7bc8] text-xs">
                <th className="px-3 py-2 text-left font-medium">Hora</th>
                <th className="px-3 py-2 text-right font-medium">Peso</th>
                <th className="px-3 py-2 text-right font-medium">Valor</th>
                <th className="px-3 py-2 text-left font-medium">Pag.</th>
              </tr>
            </thead>
            <tbody>
              {sales.map((sale) => (
                <tr
                  key={sale.id}
                  className="border-t border-[#0f0720] hover:bg-[#0f0720]/50 transition-colors"
                >
                  <td className="px-3 py-2 text-[#9d7bc8] tabular-nums">
                    {new Date(sale.created_at).toLocaleTimeString('pt-BR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                  <td className="px-3 py-2 text-right text-white tabular-nums">
                    <span>{sale.weight_grams}g</span>
                    {sale.weight_source === 'manual' && (
                      <PenLine
                        className="inline-block w-3 h-3 ml-1 text-yellow-400"
                        aria-label="Peso digitado manualmente"
                      />
                    )}
                  </td>
                  <td className="px-3 py-2 text-right text-[#10b981] font-medium tabular-nums">
                    {formatCurrency(sale.amount)}
                  </td>
                  <td className="px-3 py-2 text-[#9d7bc8] text-xs">
                    {METHOD_LABEL[sale.payment_method] ?? sale.payment_method}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Footer total */}
      {sales.length > 0 && (
        <div className="px-4 py-3 border-t border-[#2d1550] flex items-center justify-between">
          <span className="text-xs text-[#9d7bc8]">{sales.length} vendas</span>
          <span className="text-sm font-semibold text-[#10b981]">{formatCurrency(total)}</span>
        </div>
      )}
    </div>
  )
}
