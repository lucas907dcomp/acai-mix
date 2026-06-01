import { QrCode, CreditCard, Landmark, Banknote, SplitSquareHorizontal, X } from 'lucide-react'
import { useSaleStore, formatCurrency } from '@/stores/saleStore'
import { getQuickValues } from '@/lib/quickValues'
import type { PaymentMethod } from '@/types'
import { cn } from '@/lib/utils'

const METHODS: { method: PaymentMethod; label: string; Icon: React.ElementType; key: string }[] = [
  { method: 'pix',    label: 'PIX',      Icon: QrCode,    key: '1' },
  { method: 'credit', label: 'Crédito',  Icon: CreditCard, key: '2' },
  { method: 'debit',  label: 'Débito',   Icon: Landmark,  key: '3' },
  { method: 'cash',   label: 'Dinheiro', Icon: Banknote,  key: '4' },
]

function methodLabel(method: PaymentMethod) {
  return METHODS.find((m) => m.method === method)?.label ?? method
}

export function PaymentMethodSelector() {
  const amount          = useSaleStore((s) => s.amount)
  const paymentMethod   = useSaleStore((s) => s.paymentMethod)
  const secondMethod    = useSaleStore((s) => s.secondMethod)
  const secondAmount    = useSaleStore((s) => s.secondAmount)
  const secondAmountReceived = useSaleStore((s) => s.secondAmountReceived)
  const secondChange    = useSaleStore((s) => s.secondChange)

  const setPaymentMethod        = useSaleStore((s) => s.setPaymentMethod)
  const setSecondMethod         = useSaleStore((s) => s.setSecondMethod)
  const setSecondAmount         = useSaleStore((s) => s.setSecondAmount)
  const setSecondAmountReceived = useSaleStore((s) => s.setSecondAmountReceived)
  const clearSplit              = useSaleStore((s) => s.clearSplit)

  const disabled = amount === null

  const firstAmount = amount !== null && secondAmount !== null ? amount - secondAmount : null
  const secondCashInsufficient =
    secondMethod === 'cash' && secondAmount !== null &&
    secondAmountReceived !== null && secondAmountReceived < secondAmount

  return (
    <div className="space-y-3">
      {/* ── First method ── */}
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
                selected ? 'border-[#10b981]/40 text-[#10b981]/70' : 'border-[#3d1f70] text-[#7c5faa]'
              )}>
                {key}
              </kbd>
            </button>
          )
        })}
      </div>

      {/* ── Split toggle ── */}
      {paymentMethod && !disabled && !secondMethod && (
        <button
          onClick={() => setSecondMethod(METHODS.find((m) => m.method !== paymentMethod)!.method)}
          className="flex items-center gap-1.5 text-xs text-[#9d7bc8] hover:text-white transition-colors"
        >
          <SplitSquareHorizontal className="w-3.5 h-3.5" />
          Dividir pagamento
        </button>
      )}

      {/* ── Split section ── */}
      {paymentMethod && secondMethod !== null && (
        <div className="rounded-xl border border-[#2d1550] p-3 space-y-3 bg-[#0f0720]/50">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-[#9d7bc8]">Dividir com</p>
            <button
              onClick={clearSplit}
              className="text-[#9d7bc8] hover:text-white transition-colors"
              aria-label="Cancelar divisão"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Second method selector */}
          <div className="grid grid-cols-2 gap-2">
            {METHODS.filter((m) => m.method !== paymentMethod).map(({ method, label, Icon }) => (
              <button
                key={method}
                onClick={() => setSecondMethod(method)}
                aria-pressed={secondMethod === method}
                className={cn(
                  'flex items-center gap-2 px-3 py-2.5 rounded-xl border font-medium text-sm transition-all',
                  secondMethod === method
                    ? 'bg-[#10b981]/10 border-[#10b981] text-[#10b981]'
                    : 'bg-[#1a0b2e] border-[#2d1550] text-[#9d7bc8] hover:border-[#4c1e8c] hover:text-white'
                )}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span className="text-left">{label}</span>
              </button>
            ))}
          </div>

          {/* Second amount input */}
          <div className="space-y-1.5">
            <label className="text-xs text-[#9d7bc8]">
              Quanto vai no {methodLabel(secondMethod)}?
            </label>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0.01"
              max={amount !== null ? amount - 0.01 : undefined}
              value={secondAmount ?? ''}
              onChange={(e) => {
                if (e.target.value === '') { setSecondAmount(null); return }
                const val = parseFloat(e.target.value)
                if (!isNaN(val) && val > 0) setSecondAmount(val)
              }}
              placeholder="R$ 0,00"
              className="w-full px-3 py-2 rounded-lg bg-[#0f0720] border border-[#2d1550] text-white placeholder-[#4a3570] focus:outline-none focus:ring-1 focus:ring-[#4c1e8c] text-sm"
            />
            {firstAmount !== null && firstAmount > 0 && (
              <p className="text-xs text-[#9d7bc8]">
                Restante no {methodLabel(paymentMethod)}:{' '}
                <span className="text-white font-medium">{formatCurrency(firstAmount)}</span>
              </p>
            )}
          </div>

          {/* Cash flow for second method if cash */}
          {secondMethod === 'cash' && secondAmount !== null && secondAmount > 0 && (
            <div className="space-y-2 pt-1">
              <p className="text-xs text-[#9d7bc8]">Valor recebido em dinheiro</p>
              <div className="flex flex-wrap gap-1.5">
                {getQuickValues(secondAmount).map((v) => (
                  <button
                    key={v}
                    onClick={() => setSecondAmountReceived(v)}
                    className={cn(
                      'px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors',
                      secondAmountReceived === v
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
                min={secondAmount}
                value={secondAmountReceived ?? ''}
                onChange={(e) => {
                  if (e.target.value === '') { setSecondAmountReceived(null); return }
                  const val = parseFloat(e.target.value)
                  if (!isNaN(val) && val >= 0) setSecondAmountReceived(val)
                }}
                placeholder={`Mín. ${formatCurrency(secondAmount)}`}
                className={cn(
                  'w-full px-3 py-2 rounded-lg bg-[#0f0720] border text-white placeholder-[#4a3570] focus:outline-none focus:ring-1 focus:ring-[#4c1e8c]',
                  secondCashInsufficient ? 'border-red-500' : 'border-[#2d1550]'
                )}
              />
              {secondCashInsufficient && (
                <p className="text-red-400 text-xs">
                  Valor insuficiente. Mínimo: {formatCurrency(secondAmount)}
                </p>
              )}
              {secondChange !== null && secondChange >= 0 && (
                <div className="flex items-baseline justify-between">
                  <span className="text-xs text-[#9d7bc8]">Troco</span>
                  <span className="text-2xl font-bold text-[#10b981]">
                    {formatCurrency(secondChange)}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
