import { Loader2 } from 'lucide-react'
import { useSaleStore } from '@/stores/saleStore'

export function ConfirmSaleButton() {
  const amount = useSaleStore((s) => s.amount)
  const paymentMethod = useSaleStore((s) => s.paymentMethod)
  const amountReceived = useSaleStore((s) => s.amountReceived)
  const isConfirming = useSaleStore((s) => s.isConfirming)
  const confirmSale = useSaleStore((s) => s.confirmSale)

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
        'Confirmar Venda'
      )}
    </button>
  )
}
