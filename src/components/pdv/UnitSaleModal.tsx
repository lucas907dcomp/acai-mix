import { useState } from 'react'
import { Minus, Plus, QrCode, CreditCard, Landmark, Banknote } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { supabase } from '@/lib/supabase'
import { queryClient } from '@/lib/queryClient'
import { useAuthStore } from '@/stores/authStore'
import { useShiftStore } from '@/stores/shiftStore'
import { useSyncStore } from '@/stores/syncStore'
import { formatCurrency } from '@/stores/saleStore'
import { getQuickValues } from '@/lib/quickValues'
import { cn } from '@/lib/utils'
import type { PaymentMethod, Product, Sale } from '@/types'

interface Props {
  product: Product
  open: boolean
  onClose: () => void
}

const PAYMENT_METHODS: { method: PaymentMethod; label: string; Icon: React.ElementType }[] = [
  { method: 'pix', label: 'PIX', Icon: QrCode },
  { method: 'credit', label: 'Crédito', Icon: CreditCard },
  { method: 'debit', label: 'Débito', Icon: Landmark },
  { method: 'cash', label: 'Dinheiro', Icon: Banknote },
]

export function UnitSaleModal({ product, open, onClose }: Props) {
  const [qty, setQty] = useState(1)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null)
  const [amountReceived, setAmountReceived] = useState<number | null>(null)
  const [isConfirming, setIsConfirming] = useState(false)

  const profile = useAuthStore((s) => s.profile)
  const activeShift = useShiftStore((s) => s.activeShift)

  const unitPrice = product.unit_price ?? 0
  const total = Math.round(unitPrice * qty * 100) / 100
  const change =
    paymentMethod === 'cash' && amountReceived !== null
      ? Math.round((amountReceived - total) * 100) / 100
      : null
  const isInsufficient = paymentMethod === 'cash' && amountReceived !== null && amountReceived < total
  const canConfirm =
    paymentMethod !== null &&
    (paymentMethod !== 'cash' || (amountReceived !== null && amountReceived >= total)) &&
    !isConfirming

  function handleClose() {
    setQty(1)
    setPaymentMethod(null)
    setAmountReceived(null)
    onClose()
  }

  async function handleConfirm() {
    if (!canConfirm || !activeShift || !profile) return
    setIsConfirming(true)

    const sale: Sale = {
      id: crypto.randomUUID(),
      shift_id: activeShift.id,
      location_id: profile.location_id,
      weight_grams: 0,
      weight_source: 'manual',
      price_per_gram: 0,
      amount: total,
      payment_method: paymentMethod!,
      amount_received: paymentMethod === 'cash' ? amountReceived : null,
      change_returned: paymentMethod === 'cash' ? change : null,
      sync_reconciled: false,
      synced_at: null,
      created_offline: false,
      created_at: new Date().toISOString(),
      has_casquinha: false,
      product_id: product.id,
      quantity: qty,
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { status: _s, cancelled_at: _ca, cancelled_by: _cb, ...saleInsert } = sale

    try {
      const { error } = await supabase.from('sales').insert(saleInsert)
      if (error) throw error

      useShiftStore.getState().updateTotals(sale.amount, sale.payment_method)
      queryClient.invalidateQueries({ queryKey: ['shift-sales'] })
      toast.success(`Venda confirmada! ${formatCurrency(total)}`)
      handleClose()
    } catch (err) {
      const isNetworkError = !navigator.onLine || err instanceof TypeError
      if (isNetworkError) {
        await useSyncStore.getState().addPending({ ...sale, created_offline: true })
        useShiftStore.getState().updateTotals(sale.amount, sale.payment_method)
        toast.error('Sem conexão. Venda salva offline.')
        handleClose()
      } else {
        const msg = err instanceof Error ? err.message : 'Erro desconhecido'
        toast.error(`Erro ao confirmar venda: ${msg}`)
      }
    } finally {
      setIsConfirming(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose() }}>
      <DialogContent className="bg-[#1a0b2e] border-[#2d1550] text-white max-w-sm w-full">
        <DialogHeader>
          <DialogTitle className="text-white text-lg">{product.name}</DialogTitle>
          <p className="text-[#9d7bc8] text-sm">{formatCurrency(unitPrice)} por unidade</p>
        </DialogHeader>

        {/* Quantity selector */}
        <div className="flex items-center justify-between gap-4 bg-[#0f0720] rounded-xl p-4">
          <button
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            disabled={qty <= 1}
            className="w-10 h-10 rounded-full bg-[#2d1550] text-white flex items-center justify-center hover:bg-[#4c1e8c] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Minus className="w-4 h-4" />
          </button>
          <div className="text-center">
            <span className="text-4xl font-bold text-white">{qty}</span>
            <p className="text-xs text-[#9d7bc8] mt-0.5">unidade{qty !== 1 ? 's' : ''}</p>
          </div>
          <button
            onClick={() => setQty((q) => Math.min(99, q + 1))}
            disabled={qty >= 99}
            className="w-10 h-10 rounded-full bg-[#2d1550] text-white flex items-center justify-center hover:bg-[#4c1e8c] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Total */}
        <div className="flex items-baseline justify-between px-1">
          <span className="text-sm text-[#9d7bc8]">Total</span>
          <span className="text-3xl font-bold text-white">{formatCurrency(total)}</span>
        </div>

        {/* Payment method */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-[#9d7bc8]">Forma de pagamento</p>
          <div className="grid grid-cols-2 gap-2">
            {PAYMENT_METHODS.map(({ method, label, Icon }) => (
              <button
                key={method}
                onClick={() => {
                  setPaymentMethod(method)
                  if (method !== 'cash') setAmountReceived(null)
                }}
                aria-pressed={paymentMethod === method}
                className={cn(
                  'flex items-center gap-2 px-3 py-3 rounded-xl border font-medium text-sm transition-all',
                  paymentMethod === method
                    ? 'bg-[#10b981]/10 border-[#10b981] text-[#10b981]'
                    : 'bg-[#0f0720] border-[#2d1550] text-[#9d7bc8] hover:border-[#4c1e8c] hover:text-white'
                )}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Cash flow */}
        {paymentMethod === 'cash' && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {getQuickValues(total).map((v) => (
                <button
                  key={v}
                  onClick={() => setAmountReceived(v)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors',
                    amountReceived === v
                      ? 'bg-[#10b981]/10 border-[#10b981] text-[#10b981]'
                      : 'bg-[#0f0720] border-[#2d1550] text-[#9d7bc8] hover:border-[#4c1e8c] hover:text-white'
                  )}
                >
                  {formatCurrency(v)}
                </button>
              ))}
            </div>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              min={total}
              value={amountReceived ?? ''}
              onChange={(e) => {
                const val = parseFloat(e.target.value)
                if (!isNaN(val) && val >= 0) setAmountReceived(val)
              }}
              placeholder={`Mín. ${formatCurrency(total)}`}
              className={cn(
                'w-full px-3 py-2 rounded-lg bg-[#0f0720] border text-white placeholder-[#4a3570] focus:outline-none focus:ring-2 focus:ring-[#4c1e8c] text-lg',
                isInsufficient ? 'border-red-500' : 'border-[#2d1550]'
              )}
            />
            {isInsufficient && (
              <p className="text-red-400 text-xs">Valor insuficiente. Mínimo: {formatCurrency(total)}</p>
            )}
            {change !== null && change >= 0 && (
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-[#9d7bc8]">Troco</span>
                <span className="text-3xl font-bold text-[#10b981]">{formatCurrency(change)}</span>
              </div>
            )}
          </div>
        )}

        {/* Confirm / Cancel */}
        <div className="flex gap-2 pt-1">
          <button
            onClick={handleClose}
            className="flex-1 py-3 rounded-xl border border-[#2d1550] text-[#9d7bc8] text-sm hover:bg-[#2d1550] hover:text-white transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={!canConfirm}
            className="flex-1 py-3 rounded-xl bg-[#4c1e8c] text-white text-sm font-semibold hover:bg-[#5B2D8E] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {isConfirming ? 'Confirmando...' : 'Confirmar venda'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
