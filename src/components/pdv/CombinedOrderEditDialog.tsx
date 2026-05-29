import { X } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useCombinedOrderStore } from '@/stores/combinedOrderStore'
import { formatCurrency } from '@/stores/saleStore'
import type { CombinedOrder, CombinedOrderItem } from '@/stores/combinedOrderStore'

interface Props {
  open: boolean
  order: CombinedOrder
  onClose: () => void
}

function describeItem(item: CombinedOrderItem): string {
  if (item.type === 'weight') {
    return `Açaí ${item.weight_grams}g${item.has_casquinha ? ' + casquinha' : ''}`
  }
  return `${item.product_name}${item.quantity > 1 ? ` × ${item.quantity}` : ''}`
}

export function CombinedOrderEditDialog({ open, order, onClose }: Props) {
  const removeItem = useCombinedOrderStore((s) => s.removeItem)

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="bg-[#1a0b2e] border-[#2d1550] text-white max-w-sm w-full">
        <DialogHeader>
          <DialogTitle className="text-white">Pedido: {order.name}</DialogTitle>
        </DialogHeader>

        {order.items.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-[#4a3570] text-sm">
            Nenhum item neste pedido.
          </div>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {order.items.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-[#0f0720] border border-[#2d1550]"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white font-medium truncate">
                    {describeItem(item)}
                  </p>
                  <p className="text-xs text-[#10b981] font-semibold mt-0.5">
                    {formatCurrency(item.amount)}
                  </p>
                </div>
                <button
                  onClick={() => removeItem(order.id, item.id)}
                  className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-[#9d7bc8] hover:bg-red-900/30 hover:text-red-400 transition-colors"
                  aria-label="Remover item"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between py-2 border-t border-[#2d1550]">
          <span className="text-sm text-[#9d7bc8]">
            {order.items.length} {order.items.length === 1 ? 'item' : 'itens'}
          </span>
          <span className="text-base font-bold text-[#10b981]">
            {formatCurrency(order.total)}
          </span>
        </div>

        <button
          onClick={onClose}
          className="w-full py-3 rounded-xl border border-[#2d1550] text-[#9d7bc8] text-sm hover:bg-[#2d1550] hover:text-white transition-colors"
        >
          Fechar
        </button>
      </DialogContent>
    </Dialog>
  )
}
