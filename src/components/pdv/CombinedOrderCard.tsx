import { useState } from 'react'
import { X, ShoppingBag } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/stores/saleStore'
import { useCombinedOrderStore } from '@/stores/combinedOrderStore'
import type { CombinedOrder } from '@/stores/combinedOrderStore'

interface Props {
  order: CombinedOrder
  isActive: boolean
  onConfirmRequest: (orderId: string) => void
}

export function CombinedOrderCard({ order, isActive, onConfirmRequest }: Props) {
  const activateOrder = useCombinedOrderStore((s) => s.activateOrder)
  const cancelOrder = useCombinedOrderStore((s) => s.cancelOrder)
  const [confirmingCancel, setConfirmingCancel] = useState(false)

  function handleCardClick() {
    activateOrder(isActive ? null : order.id)
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur()
    }
  }

  function handleCancelClick(e: React.MouseEvent) {
    e.stopPropagation()
    if (confirmingCancel) {
      cancelOrder(order.id)
    } else {
      setConfirmingCancel(true)
      setTimeout(() => setConfirmingCancel(false), 2500)
    }
  }

  return (
    <div
      onClick={handleCardClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && handleCardClick()}
      className={cn(
        'relative flex-shrink-0 cursor-pointer rounded-xl border px-3 py-2 transition-all min-w-[120px] max-w-[160px]',
        isActive
          ? 'border-amber-500 bg-amber-500/10'
          : 'border-[#2d1550] bg-[#1a0b2e] hover:border-[#4c1e8c]'
      )}
    >
      {/* Cancel button */}
      <button
        onClick={handleCancelClick}
        className={cn(
          'absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center transition-colors z-10',
          confirmingCancel
            ? 'bg-red-500 text-white'
            : 'bg-[#2d1550] text-[#9d7bc8] hover:bg-red-500/80 hover:text-white'
        )}
        title={confirmingCancel ? 'Clique novamente para cancelar' : 'Cancelar pedido'}
        aria-label="Cancelar pedido"
      >
        <X className="w-3 h-3" />
      </button>

      {/* Name */}
      <p className={cn('text-xs font-semibold truncate pr-1', isActive ? 'text-amber-400' : 'text-white')}>
        {order.name}
      </p>

      {/* Total */}
      <p className={cn('text-sm font-bold mt-0.5', isActive ? 'text-amber-300' : 'text-[#10b981]')}>
        {formatCurrency(order.total)}
      </p>

      {/* Item count + pay button */}
      <div className="flex items-center justify-between mt-1">
        <span className="flex items-center gap-0.5 text-[10px] text-[#9d7bc8]">
          <ShoppingBag className="w-2.5 h-2.5" />
          {order.items.length} {order.items.length === 1 ? 'item' : 'itens'}
        </span>
        {order.items.length > 0 && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onConfirmRequest(order.id)
            }}
            className="text-[10px] text-amber-400 hover:text-amber-300 font-medium transition-colors"
            aria-label={`Pagar pedido ${order.name}`}
          >
            Pagar →
          </button>
        )}
      </div>
    </div>
  )
}
