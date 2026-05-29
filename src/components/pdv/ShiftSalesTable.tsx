import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { PenLine, WifiOff } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useShiftStore } from '@/stores/shiftStore'
import { useSyncStore } from '@/stores/syncStore'
import { formatCurrency } from '@/stores/saleStore'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'
import type { Sale } from '@/types'
import type { PendingSale } from '@/providers/sync/DexieDatabase'

async function fetchShiftSales(shiftId: string): Promise<Sale[]> {
  const { data, error } = await supabase
    .from('sales')
    .select('*')
    .eq('shift_id', shiftId)
    .eq('status', 'COMPLETED')
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) throw error
  return data as Sale[]
}

const METHOD_LABEL: Record<string, string> = {
  pix: 'PIX',
  credit: 'Crédito',
  debit: 'Débito',
  cash: 'Dinheiro',
}

const fmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

function OfflinePendingRow({
  sale,
  onCancel,
}: {
  sale: PendingSale
  onCancel: (sale: PendingSale) => void
}) {
  return (
    <tr className="border-t border-[#0f0720] bg-yellow-900/10">
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
      <td className="px-3 py-2 text-right text-yellow-400 font-medium tabular-nums">
        {formatCurrency(sale.amount)}
      </td>
      <td className="px-3 py-2 text-[#9d7bc8] text-xs">
        {METHOD_LABEL[sale.payment_method] ?? sale.payment_method}
      </td>
      <td className="px-3 py-2 text-right">
        <button
          onClick={() => onCancel(sale)}
          className="text-xs text-red-400/70 hover:text-red-400 transition-colors"
        >
          ×
        </button>
      </td>
    </tr>
  )
}

export function ShiftSalesContent() {
  const activeShift = useShiftStore((s) => s.activeShift)
  const pendingSales = useSyncStore((s) => s.pendingSales)
  const cancelPending = useSyncStore((s) => s.cancelPending)
  const [confirmOffline, setConfirmOffline] = useState<PendingSale | null>(null)
  const [isCancelling, setIsCancelling] = useState(false)

  const { data: syncedSales = [], isLoading } = useQuery({
    queryKey: ['shift-sales', activeShift?.id],
    queryFn: () => fetchShiftSales(activeShift!.id),
    enabled: !!activeShift && activeShift.status !== 'provisional',
    refetchInterval: 10_000,
  })

  const shiftPending = pendingSales.filter((s) => s.shift_id === activeShift?.id)

  const allSales = [...syncedSales]
  const syncedTotal = syncedSales.reduce((sum, s) => sum + s.amount, 0)
  const pendingTotal = shiftPending.reduce((sum, s) => sum + s.amount, 0)
  const combinedTotal = syncedTotal + pendingTotal
  const combinedCount = allSales.length + shiftPending.length

  async function handleCancelOffline() {
    if (!confirmOffline) return
    setIsCancelling(true)
    await cancelPending(confirmOffline.id)
    setIsCancelling(false)
    setConfirmOffline(null)
  }

  return (
    <>
      <div className="flex-1 overflow-y-auto min-h-0">
        {isLoading && shiftPending.length === 0 ? (
          <div className="flex items-center justify-center h-24 text-[#9d7bc8] text-sm">
            Carregando...
          </div>
        ) : combinedCount === 0 ? (
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
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {shiftPending.length > 0 && (
                <>
                  <tr>
                    <td
                      colSpan={5}
                      className="px-3 py-1 bg-yellow-900/20 border-t border-[#0f0720]"
                    >
                      <span className="flex items-center gap-1 text-xs text-yellow-400/80">
                        <WifiOff className="w-3 h-3" />
                        Pendente offline
                      </span>
                    </td>
                  </tr>
                  {shiftPending.map((s) => (
                    <OfflinePendingRow key={s.id} sale={s} onCancel={setConfirmOffline} />
                  ))}
                </>
              )}
              {syncedSales.map((sale) => (
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
                  <td className="px-3 py-2" />
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {combinedCount > 0 && (
        <div className="px-4 py-3 border-t border-[#2d1550] flex items-center justify-between shrink-0">
          <span className="text-xs text-[#9d7bc8]">{combinedCount} venda{combinedCount !== 1 ? 's' : ''}</span>
          <span className="text-sm font-semibold text-[#10b981]">{fmt.format(combinedTotal)}</span>
        </div>
      )}

      <Dialog
        open={!!confirmOffline}
        onOpenChange={(open) => { if (!open) setConfirmOffline(null) }}
      >
        <DialogContent className="bg-[#1a0b2e] border-[#2d1550] text-white max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-white">Remover venda offline</DialogTitle>
          </DialogHeader>
          {confirmOffline && (
            <div className="space-y-3 py-1">
              <p className="text-sm text-[#9d7bc8]">
                Remover esta venda ainda não sincronizada?
              </p>
              <div className="rounded-lg bg-[#0f0720] border border-[#2d1550] p-3 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-[#9d7bc8]">Valor</span>
                  <span className="text-white font-medium">{fmt.format(confirmOffline.amount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#9d7bc8]">Pagamento</span>
                  <span className="text-white">{METHOD_LABEL[confirmOffline.payment_method]}</span>
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <DialogClose asChild>
              <button className="px-4 py-2 text-sm text-[#9d7bc8] hover:text-white rounded-lg hover:bg-[#2d1550] transition-colors">
                Voltar
              </button>
            </DialogClose>
            <button
              onClick={handleCancelOffline}
              disabled={isCancelling}
              className="px-4 py-2 text-sm bg-red-900/40 text-red-400 hover:bg-red-900/60 hover:text-red-300 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCancelling ? 'Removendo...' : 'Confirmar remoção'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

export function ShiftSalesTable() {
  return (
    <div className="flex flex-col h-full rounded-xl bg-[#1a0b2e] border border-[#2d1550] overflow-hidden">
      <div className="px-4 py-3 border-b border-[#2d1550]">
        <h3 className="text-sm font-semibold text-white">Vendas do turno</h3>
      </div>
      <ShiftSalesContent />
    </div>
  )
}
