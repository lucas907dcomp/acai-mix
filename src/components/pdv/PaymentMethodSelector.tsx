import { QrCode, CreditCard, Landmark, Banknote } from 'lucide-react'
import { useSaleStore } from '@/stores/saleStore'
import type { PaymentMethod } from '@/types'
import { cn } from '@/lib/utils'

const METHODS: { method: PaymentMethod; label: string; Icon: React.ElementType }[] = [
  { method: 'pix', label: 'PIX', Icon: QrCode },
  { method: 'credit', label: 'Crédito', Icon: CreditCard },
  { method: 'debit', label: 'Débito', Icon: Landmark },
  { method: 'cash', label: 'Dinheiro', Icon: Banknote },
]

export function PaymentMethodSelector() {
  const paymentMethod = useSaleStore((s) => s.paymentMethod)
  const amount = useSaleStore((s) => s.amount)
  const setPaymentMethod = useSaleStore((s) => s.setPaymentMethod)

  const disabled = amount === null

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-[#9d7bc8]">Forma de pagamento</p>
      <div
        className="grid grid-cols-2 gap-2"
        role="group"
        aria-label="Selecionar forma de pagamento"
      >
        {METHODS.map(({ method, label, Icon }) => {
          const selected = paymentMethod === method
          return (
            <button
              key={method}
              onClick={() => setPaymentMethod(method)}
              disabled={disabled}
              aria-pressed={selected}
              className={cn(
                'flex items-center gap-2 px-3 py-3 rounded-xl border font-medium text-sm transition-all',
                disabled && 'opacity-40 cursor-not-allowed',
                selected
                  ? 'bg-[#10b981]/10 border-[#10b981] text-[#10b981]'
                  : 'bg-[#1a0b2e] border-[#2d1550] text-[#9d7bc8] hover:border-[#4c1e8c] hover:text-white'
              )}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
