import { Check } from 'lucide-react'
import { formatCurrency } from '@/stores/saleStore'
import { descreverItem } from '@/lib/imprimirConta'
import type { PaidItem } from '@/stores/combinedOrderStore'
import type { PaymentMethod } from '@/types'

const FORMA: Record<PaymentMethod, string> = { pix: 'Pix', credit: 'Crédito', debit: 'Débito', cash: 'Dinheiro' }

/** Itens da conta que já foram pagos: só conferência, nada aqui é clicável. */
export function PaidItems({ items }: { items?: PaidItem[] }) {
  return (
    <>
      {items?.map((i, n) => (
        <div
          key={`${i.id}:${n}`}
          className="flex items-center gap-2 px-2 py-2 rounded-lg text-sm bg-[#10b981]/10"
          data-pago
        >
          <Check className="w-4 h-4 shrink-0 text-[#10b981]" strokeWidth={3} />
          <span className="flex-1 truncate text-[#9d7bc8]">{descreverItem(i)}</span>
          <span className="text-xs font-semibold text-[#10b981] whitespace-nowrap">
            Pago · {i.methods.map((m) => FORMA[m]).join(' + ')}
          </span>
          <span className="text-[#9d7bc8] whitespace-nowrap">{formatCurrency(i.amount)}</span>
        </div>
      ))}
    </>
  )
}
