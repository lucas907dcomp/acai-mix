import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import type { Shift, Sale } from '@/types'

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })

function elapsed(openedAt: string, closedAt: string | null): string {
  const end = closedAt ? new Date(closedAt) : new Date()
  const mins = Math.round((end.getTime() - new Date(openedAt).getTime()) / 60000)
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return h > 0 ? `${h}h ${m}min` : `${m}min`
}

const PAYMENT_LABELS: Record<string, string> = {
  pix: 'PIX',
  credit: 'Crédito',
  debit: 'Débito',
  cash: 'Dinheiro',
}

const PAYMENT_COLORS: Record<string, string> = {
  pix: '#10b981',
  credit: '#3b82f6',
  debit: '#6366f1',
  cash: '#f59e0b',
}

interface PaymentRow {
  method: string
  label: string
  total: number
  count: number
  color: string
}

export default function ShiftReport() {
  const [params] = useSearchParams()
  const shiftId = params.get('shiftId')

  const [shift, setShift] = useState<Shift | null>(null)
  const [sales, setSales] = useState<Sale[]>([])
  const [loading, setLoading] = useState(!!shiftId)
  const [fetchError, setFetchError] = useState<string | null>(null)

  useEffect(() => {
    if (!shiftId) return

    async function load() {
      const [{ data: shiftData, error: shiftErr }, { data: salesData, error: salesErr }] =
        await Promise.all([
          supabase.from('shifts').select('*').eq('id', shiftId!).single(),
          supabase
            .from('sales')
            .select('*')
            .eq('shift_id', shiftId!)
            .is('status', null)
            .order('created_at'),
        ])

      if (shiftErr || salesErr) {
        setFetchError(shiftErr?.message ?? salesErr?.message ?? 'Erro ao carregar dados.')
        setLoading(false)
        return
      }

      setShift(shiftData as Shift)
      setSales((salesData as Sale[]) ?? [])
      setLoading(false)
    }

    load()
  }, [shiftId])

  // Auto-print once data is ready
  useEffect(() => {
    if (!loading && shift && !fetchError) {
      const t = setTimeout(() => window.print(), 400)
      return () => clearTimeout(t)
    }
  }, [loading, shift, fetchError])

  const errorMsg = !shiftId
    ? 'ID do turno não informado.'
    : fetchError

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50 text-gray-500">
        Carregando relatório...
      </div>
    )
  }

  if (errorMsg || !shift) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50 text-red-500">
        {errorMsg ?? 'Turno não encontrado.'}
      </div>
    )
  }

  const activeSales = sales.filter((s) => s.status !== 'CANCELLED')

  const paymentRows: PaymentRow[] = ['pix', 'credit', 'debit', 'cash'].map((method) => {
    const methodSales = activeSales.filter((s) => s.payment_method === method)
    return {
      method,
      label: PAYMENT_LABELS[method],
      total: methodSales.reduce((sum, s) => sum + s.amount, 0),
      count: methodSales.length,
      color: PAYMENT_COLORS[method],
    }
  })

  const grandTotal = activeSales.reduce((sum, s) => sum + s.amount, 0)

  return (
    <>
      <style>{`
        @media print {
          @page { margin: 12mm 14mm; size: A4; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
        }
        body { background: #f3f4f6; margin: 0; font-family: 'Inter', system-ui, sans-serif; }
      `}</style>

      {/* Print button — hidden when printing */}
      <div className="no-print flex justify-center pt-6 pb-2 gap-3">
        <button
          onClick={() => window.print()}
          className="px-5 py-2 bg-purple-700 hover:bg-purple-600 text-white rounded-lg text-sm font-medium"
        >
          Imprimir / Salvar PDF
        </button>
        <button
          onClick={() => window.close()}
          className="px-5 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg text-sm font-medium"
        >
          Fechar
        </button>
      </div>

      {/* Report card */}
      <div className="max-w-2xl mx-auto my-4 bg-white rounded-2xl shadow-lg overflow-hidden">

        {/* Header */}
        <div style={{ background: 'linear-gradient(135deg, #3b0764 0%, #4c1e8c 60%, #6d28d9 100%)' }}
          className="px-8 py-6 text-white">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-3xl">🍇</span>
                <span className="text-2xl font-bold tracking-tight">Açaí Mix</span>
              </div>
              <p className="text-purple-200 text-sm font-medium">Relatório de Turno</p>
            </div>
            <div className="text-right">
              <p className="text-white font-semibold text-lg">
                {fmtDate(shift.opened_at)}
              </p>
              <p className="text-purple-200 text-sm">
                Gerado em {fmtTime(new Date().toISOString())}
              </p>
            </div>
          </div>
        </div>

        {/* Shift info strip */}
        <div className="bg-purple-50 border-b border-purple-100 px-8 py-4">
          <div className="flex flex-wrap gap-6 text-sm">
            <div>
              <span className="text-purple-400 font-medium uppercase text-xs tracking-wider">Turno</span>
              <p className="text-purple-900 font-bold text-xl mt-0.5">
                Turno {shift.shift_number}
              </p>
            </div>
            <div>
              <span className="text-purple-400 font-medium uppercase text-xs tracking-wider">Abertura</span>
              <p className="text-gray-800 font-semibold text-base mt-0.5">{fmtTime(shift.opened_at)}</p>
            </div>
            <div>
              <span className="text-purple-400 font-medium uppercase text-xs tracking-wider">Fechamento</span>
              <p className="text-gray-800 font-semibold text-base mt-0.5">
                {shift.closed_at ? fmtTime(shift.closed_at) : '—'}
              </p>
            </div>
            <div>
              <span className="text-purple-400 font-medium uppercase text-xs tracking-wider">Duração</span>
              <p className="text-gray-800 font-semibold text-base mt-0.5">
                {elapsed(shift.opened_at, shift.closed_at)}
              </p>
            </div>
            <div>
              <span className="text-purple-400 font-medium uppercase text-xs tracking-wider">Vendas</span>
              <p className="text-gray-800 font-semibold text-base mt-0.5">
                {activeSales.length}
              </p>
            </div>
          </div>
        </div>

        {/* Financial summary */}
        <div className="px-8 py-6 border-b border-gray-100">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">
            Resumo Financeiro
          </h2>

          {/* Total highlight */}
          <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-xl px-5 py-4 mb-4">
            <span className="text-emerald-700 font-semibold text-base">Total do Turno</span>
            <span className="text-emerald-700 font-bold text-2xl">{fmt(grandTotal)}</span>
          </div>

          {/* Payment breakdown */}
          <div className="space-y-3">
            {paymentRows.map((row) => {
              const pct = grandTotal > 0 ? (row.total / grandTotal) * 100 : 0
              return (
                <div key={row.method}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ background: row.color }}
                      />
                      <span className="text-gray-700 text-sm font-medium">{row.label}</span>
                      <span className="text-gray-400 text-xs">({row.count} venda{row.count !== 1 ? 's' : ''})</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-gray-400 text-xs w-8 text-right">
                        {pct.toFixed(0)}%
                      </span>
                      <span className="text-gray-800 font-semibold text-sm w-24 text-right">
                        {fmt(row.total)}
                      </span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, background: row.color }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Sales list */}
        <div className="px-8 py-6">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">
            Vendas Detalhadas
          </h2>

          {activeSales.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-6">Nenhuma venda registrada.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left text-xs text-gray-400 font-medium pb-2 pr-3">Horário</th>
                  <th className="text-left text-xs text-gray-400 font-medium pb-2 pr-3">Produto</th>
                  <th className="text-right text-xs text-gray-400 font-medium pb-2 pr-3">Peso/Qtd</th>
                  <th className="text-right text-xs text-gray-400 font-medium pb-2 pr-3">Valor</th>
                  <th className="text-left text-xs text-gray-400 font-medium pb-2">Pagamento</th>
                </tr>
              </thead>
              <tbody>
                {activeSales.map((sale, i) => {
                  const isWeight = sale.weight_grams > 0
                  const isCombined = sale.is_combined
                  const color = PAYMENT_COLORS[sale.payment_method]
                  return (
                    <tr
                      key={sale.id}
                      className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                    >
                      <td className="py-2 pr-3 text-gray-500 tabular-nums">
                        {fmtTime(sale.created_at)}
                      </td>
                      <td className="py-2 pr-3 text-gray-800">
                        {isCombined ? (
                          <span>
                            <span className="text-amber-600 font-medium">Pedido: </span>
                            {sale.combined_order_name ?? 'Conjunto'}
                          </span>
                        ) : isWeight ? (
                          <span>
                            Açaí{sale.has_casquinha ? ' + Casquinha' : ''}
                          </span>
                        ) : (
                          <span>Produto avulso</span>
                        )}
                      </td>
                      <td className="py-2 pr-3 text-right text-gray-500 tabular-nums">
                        {isWeight && !isCombined
                          ? `${sale.weight_grams}g`
                          : sale.quantity
                            ? `${sale.quantity}x`
                            : '—'}
                      </td>
                      <td className="py-2 pr-3 text-right text-gray-800 font-medium tabular-nums">
                        {fmt(sale.amount)}
                      </td>
                      <td className="py-2">
                        <span
                          className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full"
                          style={{ background: color + '18', color }}
                        >
                          {PAYMENT_LABELS[sale.payment_method]}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-200">
                  <td colSpan={3} className="pt-3 text-gray-500 text-xs">
                    {activeSales.length} venda{activeSales.length !== 1 ? 's' : ''}
                  </td>
                  <td className="pt-3 text-right font-bold text-gray-900 tabular-nums text-base">
                    {fmt(grandTotal)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-8 py-4 border-t border-gray-100">
          <p className="text-center text-gray-400 text-xs">
            Açaí Mix · Turno {shift.shift_number} · {fmtDate(shift.opened_at)}
          </p>
        </div>
      </div>

      <div className="no-print pb-8" />
    </>
  )
}
