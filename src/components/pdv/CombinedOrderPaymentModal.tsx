import { useState } from 'react'
import { QrCode, CreditCard, Landmark, Banknote, ShoppingBag, SplitSquareHorizontal, X } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/stores/saleStore'
import { useCombinedOrderStore } from '@/stores/combinedOrderStore'
import { getQuickValues } from '@/lib/quickValues'
import type { CombinedOrder } from '@/stores/combinedOrderStore'
import type { PaymentMethod, PaymentSplitItem } from '@/types'

interface Props {
  order: CombinedOrder
  open: boolean
  onClose: () => void
}

const METHODS_INFO: { method: PaymentMethod; label: string; Icon: React.ElementType }[] = [
  { method: 'pix',    label: 'PIX',      Icon: QrCode },
  { method: 'credit', label: 'Crédito',  Icon: CreditCard },
  { method: 'debit',  label: 'Débito',   Icon: Landmark },
  { method: 'cash',   label: 'Dinheiro', Icon: Banknote },
]

export function CombinedOrderPaymentModal({ order, open, onClose }: Props) {
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null)
  const [amountReceived, setAmountReceived] = useState<number | null>(null)
  // Split state
  const [secondMethod, setSecondMethod]   = useState<PaymentMethod | null>(null)
  const [secondAmount, setSecondAmount]   = useState<number | null>(null)
  const [secondAmountReceived, setSecondAmountReceived] = useState<number | null>(null)
  const [isConfirming, setIsConfirming] = useState(false)

  const confirmOrder = useCombinedOrderStore((s) => s.confirmOrder)

  const total = order.total
  const isSplit = secondMethod !== null && secondAmount !== null
  const firstPortion = isSplit ? total - secondAmount! : total
  const cashPortion = isSplit
    ? (paymentMethod === 'cash' ? firstPortion : secondMethod === 'cash' ? secondAmount : null)
    : (paymentMethod === 'cash' ? total : null)

  const change = cashPortion !== null && amountReceived !== null
    ? Math.round(amountReceived * 100 - cashPortion * 100) / 100
    : null
  const secondChange = isSplit && secondMethod === 'cash' && secondAmount !== null && secondAmountReceived !== null
    ? Math.round(secondAmountReceived * 100 - secondAmount * 100) / 100
    : null

  const isInsufficient = paymentMethod === 'cash' && cashPortion !== null && amountReceived !== null && amountReceived < cashPortion
  const secondInsufficient = isSplit && secondMethod === 'cash' && secondAmount !== null && secondAmountReceived !== null && secondAmountReceived < secondAmount

  const splitIncomplete = isSplit && (secondAmount === null || secondAmount <= 0 || secondAmount >= total)
  const canConfirm =
    paymentMethod !== null &&
    !splitIncomplete &&
    !isInsufficient &&
    !secondInsufficient &&
    (!isSplit || (secondAmount !== null && secondAmount > 0)) &&
    (paymentMethod !== 'cash' || !isSplit || amountReceived !== null) &&
    (paymentMethod !== 'cash' || isSplit || amountReceived !== null) &&
    (!(isSplit && secondMethod === 'cash') || secondAmountReceived !== null) &&
    !isConfirming

  function handleClose() {
    setPaymentMethod(null)
    setAmountReceived(null)
    setSecondMethod(null)
    setSecondAmount(null)
    setSecondAmountReceived(null)
    onClose()
  }

  async function handleConfirm() {
    if (!canConfirm || !paymentMethod) return
    setIsConfirming(true)
    try {
      const paymentSplit: PaymentSplitItem[] | null = isSplit
        ? [{ method: paymentMethod, amount: firstPortion }, { method: secondMethod!, amount: secondAmount! }]
        : null
      const cashReceived = cashPortion !== null ? amountReceived : isSplit && secondMethod === 'cash' ? secondAmountReceived : null
      await confirmOrder(order.id, paymentMethod, cashReceived, paymentSplit)
      handleClose()
    } finally {
      setIsConfirming(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose() }}>
      <DialogContent className="bg-[#1a0b2e] border-[#2d1550] text-white max-w-sm w-full">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-amber-400" />
            {order.name}
          </DialogTitle>
        </DialogHeader>

        {/* Items summary */}
        <div className="bg-[#0f0720] rounded-xl p-3 space-y-1.5 max-h-36 overflow-y-auto">
          {order.items.map((item) => (
            <div key={item.id} className="flex justify-between items-center text-sm">
              <span className="text-[#9d7bc8] truncate max-w-[60%]">
                {item.type === 'weight'
                  ? `Açaí ${item.weight_grams}g${item.has_casquinha ? ' + casquinha' : ''}`
                  : `${item.product_name} ×${item.quantity}`}
              </span>
              <span className="text-white font-medium">{formatCurrency(item.amount)}</span>
            </div>
          ))}
        </div>

        {/* Total */}
        <div className="flex items-baseline justify-between px-1">
          <span className="text-sm text-[#9d7bc8]">Total</span>
          <span className="text-3xl font-bold text-amber-400">{formatCurrency(total)}</span>
        </div>

        {/* Payment method */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-[#9d7bc8]">Forma de pagamento</p>
          <div className="grid grid-cols-2 gap-2">
            {METHODS_INFO.map(({ method, label, Icon }) => (
              <button
                key={method}
                onClick={() => {
                  if (method === secondMethod) { setSecondMethod(null); setSecondAmount(null); setSecondAmountReceived(null) }
                  setPaymentMethod(method)
                  if (method !== 'cash') setAmountReceived(null)
                }}
                aria-pressed={paymentMethod === method}
                className={cn(
                  'flex items-center gap-2 px-3 py-3 rounded-xl border font-medium text-sm transition-all',
                  paymentMethod === method
                    ? 'bg-amber-500/10 border-amber-500 text-amber-400'
                    : 'bg-[#0f0720] border-[#2d1550] text-[#9d7bc8] hover:border-[#4c1e8c] hover:text-white'
                )}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {label}
              </button>
            ))}
          </div>

          {/* Split toggle */}
          {paymentMethod && !secondMethod && (
            <button
              onClick={() => setSecondMethod(METHODS_INFO.find((m) => m.method !== paymentMethod)!.method)}
              className="flex items-center gap-1.5 text-xs text-[#9d7bc8] hover:text-white transition-colors"
            >
              <SplitSquareHorizontal className="w-3.5 h-3.5" />
              Dividir pagamento
            </button>
          )}

          {/* Split section */}
          {paymentMethod && secondMethod !== null && (
            <div className="rounded-xl border border-[#2d1550] p-3 space-y-3 bg-[#0f0720]/50">
              <div className="flex items-center justify-between">
                <p className="text-xs text-[#9d7bc8]">Dividir com</p>
                <button onClick={() => { setSecondMethod(null); setSecondAmount(null); setSecondAmountReceived(null) }} className="text-[#9d7bc8] hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {METHODS_INFO.filter((m) => m.method !== paymentMethod).map(({ method, label, Icon }) => (
                  <button
                    key={method}
                    onClick={() => { setSecondMethod(method); setSecondAmount(null); setSecondAmountReceived(null) }}
                    aria-pressed={secondMethod === method}
                    className={cn(
                      'flex items-center gap-2 px-3 py-2.5 rounded-xl border font-medium text-sm transition-all',
                      secondMethod === method
                        ? 'bg-amber-500/10 border-amber-500 text-amber-400'
                        : 'bg-[#0f0720] border-[#2d1550] text-[#9d7bc8] hover:border-[#4c1e8c] hover:text-white'
                    )}
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    {label}
                  </button>
                ))}
              </div>
              <div className="space-y-1">
                <label className="text-xs text-[#9d7bc8]">
                  Quanto vai no {METHODS_INFO.find((m) => m.method === secondMethod)?.label}?
                </label>
                <input
                  type="number" inputMode="decimal" step="0.01" min="0.01" max={total - 0.01}
                  value={secondAmount ?? ''}
                  onChange={(e) => {
                    if (e.target.value === '') { setSecondAmount(null); return }
                    const val = parseFloat(e.target.value)
                    if (!isNaN(val) && val > 0) setSecondAmount(val)
                  }}
                  placeholder="R$ 0,00"
                  className="w-full px-3 py-2 rounded-lg bg-[#0f0720] border border-[#2d1550] text-white placeholder-[#4a3570] focus:outline-none focus:ring-1 focus:ring-amber-500 text-sm"
                />
                {secondAmount !== null && secondAmount > 0 && (
                  <p className="text-xs text-[#9d7bc8]">
                    Restante no {METHODS_INFO.find((m) => m.method === paymentMethod)?.label}:{' '}
                    <span className="text-white font-medium">{formatCurrency(total - secondAmount)}</span>
                  </p>
                )}
              </div>
              {secondMethod === 'cash' && secondAmount !== null && secondAmount > 0 && (
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-1.5">
                    {getQuickValues(secondAmount).map((v) => (
                      <button key={v} onClick={() => setSecondAmountReceived(v)}
                        className={cn('px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors',
                          secondAmountReceived === v ? 'bg-amber-500/10 border-amber-500 text-amber-400' : 'bg-[#0f0720] border-[#2d1550] text-[#9d7bc8] hover:border-[#4c1e8c] hover:text-white'
                        )}>
                        {formatCurrency(v)}
                      </button>
                    ))}
                  </div>
                  <input type="number" inputMode="decimal" step="0.01" min={secondAmount}
                    value={secondAmountReceived ?? ''}
                    onChange={(e) => {
                      if (e.target.value === '') { setSecondAmountReceived(null); return }
                      const val = parseFloat(e.target.value)
                      if (!isNaN(val) && val >= 0) setSecondAmountReceived(val)
                    }}
                    placeholder={`Mín. ${formatCurrency(secondAmount)}`}
                    className={cn('w-full px-3 py-2 rounded-lg bg-[#0f0720] border text-white placeholder-[#4a3570] focus:outline-none focus:ring-1 focus:ring-amber-500',
                      secondInsufficient ? 'border-red-500' : 'border-[#2d1550]')}
                  />
                  {secondChange !== null && secondChange >= 0 && (
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs text-[#9d7bc8]">Troco</span>
                      <span className="text-2xl font-bold text-[#10b981]">{formatCurrency(secondChange)}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Cash flow — first method */}
        {paymentMethod === 'cash' && cashPortion !== null && (
          <div className="space-y-3">
            <p className="text-xs text-[#9d7bc8]">
              Valor recebido em dinheiro{isSplit ? ` (parcela: ${formatCurrency(cashPortion)})` : ''}
            </p>
            <div className="flex flex-wrap gap-2">
              {getQuickValues(cashPortion).map((v) => (
                <button key={v} onClick={() => setAmountReceived(v)}
                  className={cn('px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors',
                    amountReceived === v ? 'bg-amber-500/10 border-amber-500 text-amber-400' : 'bg-[#0f0720] border-[#2d1550] text-[#9d7bc8] hover:border-[#4c1e8c] hover:text-white'
                  )}>
                  {formatCurrency(v)}
                </button>
              ))}
            </div>
            <input type="number" inputMode="decimal" step="0.01" min={cashPortion}
              value={amountReceived ?? ''}
              onChange={(e) => {
                if (e.target.value === '') { setAmountReceived(null); return }
                const val = parseFloat(e.target.value)
                if (!isNaN(val) && val >= 0) setAmountReceived(val)
              }}
              placeholder={`Mín. ${formatCurrency(cashPortion)}`}
              className={cn('w-full px-3 py-2 rounded-lg bg-[#0f0720] border text-white placeholder-[#4a3570] focus:outline-none focus:ring-2 focus:ring-amber-500 text-lg',
                isInsufficient ? 'border-red-500' : 'border-[#2d1550]')}
            />
            {isInsufficient && <p className="text-red-400 text-xs">Valor insuficiente. Mínimo: {formatCurrency(cashPortion)}</p>}
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
            className="flex-1 py-3 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-sm transition-colors"
          >
            {isConfirming ? 'Confirmando...' : 'Confirmar Pedido'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
