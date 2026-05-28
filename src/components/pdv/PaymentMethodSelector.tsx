import { QrCode, CreditCard, Landmark, Banknote } from 'lucide-react'
import { useSaleStore } from '@/stores/saleStore'
import type { PaymentMethod } from '@/types'
import { cn } from '@/lib/utils'

const METHODS: { method: PaymentMethod; label: string; Icon: React.ElementType; key: string }[] = [
  { method: 'pix', label: 'PIX', Icon: QrCode, key: '1' },
  { method: 'credit', label: 'Crédito', Icon: CreditCard, key: '2' },
  { method: 'debit', label: 'Débito', Icon: Landmark, key: '3' },
  { method: 'cash', label: 'Dinheiro', Icon: Banknote, key: '4' },
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
        {METHODS.map(({ method, label, Icon, key }) => {
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
              <span className="flex-1 text-left">{label}</span>
              <kbd className={cn(
                'text-[10px] px-1 py-0.5 rounded border font-mono leading-none',
                selected
                  ? 'border-[#10b981]/40 text-[#10b981]/70'
                  : 'border-[#3d1f70] text-[#7c5faa]'
              )}>
                {key}
              </kbd>
            </button>
          )
        })}
      </div>
    </div>
  )
}
