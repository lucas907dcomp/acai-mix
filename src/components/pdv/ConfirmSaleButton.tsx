import { Loader2 } from 'lucide-react'
import { useSaleStore } from '@/stores/saleStore'
import { useCombinedOrderStore } from '@/stores/combinedOrderStore'
import { cn } from '@/lib/utils'

export function ConfirmSaleButton() {
  const amount = useSaleStore((s) => s.amount)
  const capturedWeightGrams = useSaleStore((s) => s.capturedWeightGrams)
  const pricePerGram = useSaleStore((s) => s.pricePerGram)
  const hasCasquinha = useSaleStore((s) => s.hasCasquinha)
  const paymentMethod = useSaleStore((s) => s.paymentMethod)
  const amountReceived = useSaleStore((s) => s.amountReceived)
  const isConfirming = useSaleStore((s) => s.isConfirming)
  const confirmSale = useSaleStore((s) => s.confirmSale)
  const reset = useSaleStore((s) => s.reset)

  const activeOrderId = useCombinedOrderStore((s) => s.activeOrderId)
  const orders = useCombinedOrderStore((s) => s.orders)
  const addWeightItem = useCombinedOrderStore((s) => s.addWeightItem)

  const activeOrder = activeOrderId ? orders.find((o) => o.id === activeOrderId) : null

  // Combined order mode: intercept weight capture
  if (activeOrder) {
    const hasWeight = capturedWeightGrams !== null && amount !== null

    function handleAddToOrder() {
      if (!hasWeight || !activeOrderId) return
      addWeightItem({
        type: 'weight',
        weight_grams: capturedWeightGrams!,
        price_per_gram: pricePerGram ?? 0,
        has_casquinha: hasCasquinha,
        amount: amount!,
      })
      reset()
    }

    return (
      <button
        onClick={handleAddToOrder}
        disabled={!hasWeight}
        className={cn(
          'w-full py-4 rounded-xl font-bold text-xl transition-colors flex items-center justify-center gap-2',
          hasWeight
            ? 'bg-amber-600 hover:bg-amber-500 text-white'
            : 'bg-amber-600/20 text-amber-600/60 cursor-not-allowed'
        )}
        aria-label={`Adicionar peso ao pedido ${activeOrder.name}`}
      >
        {hasWeight ? (
        <>
          {`Adicionar a "${activeOrder.name}"`}
          <kbd className="text-[11px] px-1.5 py-0.5 rounded border border-white/20 font-mono leading-none opacity-60">
            ↵
          </kbd>
        </>
      ) : (
        `Aguardando peso para "${activeOrder.name}"...`
      )}
      </button>
    )
  }

  // Normal mode — original behavior
  const cashInsufficient =
    paymentMethod === 'cash' && (amountReceived === null || amountReceived < (amount ?? 0))

  const disabled = !amount || !paymentMethod || cashInsufficient || isConfirming

  return (
    <button
      onClick={confirmSale}
      disabled={disabled}
      className="w-full py-4 rounded-xl bg-[#10b981] hover:bg-[#059669] disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xl transition-colors flex items-center justify-center gap-2"
      aria-label="Confirmar venda"
    >
      {isConfirming ? (
        <>
          <Loader2 className="w-5 h-5 animate-spin" />
          Confirmando...
        </>
      ) : (
        <>
          Confirmar Venda
          <kbd className="text-[11px] px-1.5 py-0.5 rounded border border-white/20 font-mono leading-none opacity-60">
            ↵
          </kbd>
        </>
      )}
    </button>
  )
}
