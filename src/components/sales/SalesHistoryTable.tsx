import { useState } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'
import { useAuthStore } from '@/stores/authStore'
import { useCancelSale } from '@/hooks/useCancelSale'
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
  const [confirmSale, setConfirmSale] = useState<Sale | null>(null)
  const profile = useAuthStore((s) => s.profile)
  const { mutate: cancelSale, isPending } = useCancelSale()

  function handleConfirm() {
    if (!confirmSale || !profile) return
    cancelSale(
      { sale: confirmSale, cancelledBy: profile.id },
      { onSettled: () => setConfirmSale(null) }
    )
  }

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
    <>
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
                    {!isCancelled && (
                      <button
                        onClick={() => setConfirmSale(sale)}
                        className="text-xs text-red-400/70 hover:text-red-400 transition-colors"
                      >
                        Cancelar
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <Dialog open={!!confirmSale} onOpenChange={(open) => { if (!open) setConfirmSale(null) }}>
        <DialogContent className="bg-[#1a0b2e] border-[#2d1550] text-white max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-white">Cancelar venda</DialogTitle>
          </DialogHeader>
          {confirmSale && (
            <div className="space-y-3 py-1">
              <p className="text-sm text-[#9d7bc8]">
                Tem certeza que deseja cancelar esta venda?
              </p>
              <div className="rounded-lg bg-[#0f0720] border border-[#2d1550] p-3 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-[#9d7bc8]">Valor</span>
                  <span className="text-white font-medium">{fmt.format(confirmSale.amount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#9d7bc8]">Pagamento</span>
                  <span className="text-white">{PAYMENT_LABELS[confirmSale.payment_method]}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#9d7bc8]">Peso</span>
                  <span className="text-white">{confirmSale.weight_grams}g</span>
                </div>
              </div>
              <p className="text-xs text-red-400/80">Esta ação não pode ser desfeita.</p>
            </div>
          )}
          <DialogFooter className="gap-2">
            <DialogClose asChild>
              <button className="px-4 py-2 text-sm text-[#9d7bc8] hover:text-white rounded-lg hover:bg-[#2d1550] transition-colors">
                Voltar
              </button>
            </DialogClose>
            <button
              onClick={handleConfirm}
              disabled={isPending}
              className="px-4 py-2 text-sm bg-red-900/40 text-red-400 hover:bg-red-900/60 hover:text-red-300 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPending ? 'Cancelando...' : 'Confirmar cancelamento'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function TableHead({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-3 text-left text-xs font-medium text-[#9d7bc8] uppercase tracking-wider">
      {children}
    </th>
  )
}
