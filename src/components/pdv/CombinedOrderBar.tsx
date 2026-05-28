import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useCombinedOrderStore } from '@/stores/combinedOrderStore'
import { CombinedOrderCard } from './CombinedOrderCard'
import { CreateCombinedOrderDialog } from './CreateCombinedOrderDialog'
import { CombinedOrderPaymentModal } from './CombinedOrderPaymentModal'

export function CombinedOrderBar() {
  const orders = useCombinedOrderStore((s) => s.orders)
  const activeOrderId = useCombinedOrderStore((s) => s.activeOrderId)
  const [showCreate, setShowCreate] = useState(false)
  const [payingOrderId, setPayingOrderId] = useState<string | null>(null)

  const payingOrder = payingOrderId ? (orders.find((o) => o.id === payingOrderId) ?? null) : null

  return (
    <>
      <div className="flex items-center gap-2 overflow-x-auto pb-0.5 scrollbar-hide">
        {/* Create button — always visible, subtle */}
        <button
          onClick={() => setShowCreate(true)}
          className="flex-shrink-0 flex items-center gap-1 px-2 py-1.5 rounded-lg border border-dashed border-[#2d1550] text-[#9d7bc8] hover:text-white hover:border-[#4c1e8c] transition-colors text-xs whitespace-nowrap"
        >
          <Plus className="w-3 h-3" />
          Pedido Conjunto
        </button>

        {/* Standby orders */}
        {orders.map((order) => (
          <CombinedOrderCard
            key={order.id}
            order={order}
            isActive={order.id === activeOrderId}
            onConfirmRequest={(id) => setPayingOrderId(id)}
          />
        ))}
      </div>

      <CreateCombinedOrderDialog open={showCreate} onClose={() => setShowCreate(false)} />

      {payingOrder && (
        <CombinedOrderPaymentModal
          order={payingOrder}
          open={!!payingOrderId}
          onClose={() => setPayingOrderId(null)}
        />
      )}
    </>
  )
}
