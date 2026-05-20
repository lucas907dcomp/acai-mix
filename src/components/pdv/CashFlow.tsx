import { useSaleStore, formatCurrency } from '@/stores/saleStore'

function getQuickValues(amount: number): number[] {
  const next5 = Math.ceil(amount / 5) * 5
  const next10 = Math.ceil(amount / 10) * 10
  const next20 = Math.ceil(amount / 20) * 20
  const candidates = [next5, next10, next20, 50, 100]
  return Array.from(new Set(candidates.filter((v) => v >= amount)))
    .sort((a, b) => a - b)
    .slice(0, 5)
}

export function CashFlow() {
  const amount = useSaleStore((s) => s.amount)
  const amountReceived = useSaleStore((s) => s.amountReceived)
  const change = useSaleStore((s) => s.change)
  const setAmountReceived = useSaleStore((s) => s.setAmountReceived)

  if (amount === null) return null

  const quickValues = getQuickValues(amount)
  const isInsufficient = amountReceived !== null && amountReceived < amount

  return (
    <div className="rounded-xl bg-[#1a0b2e] border border-[#2d1550] p-4 space-y-4">
      <p className="text-sm font-medium text-[#9d7bc8]">Valor recebido em dinheiro</p>

      {/* Quick value buttons */}
      <div className="flex flex-wrap gap-2">
        {quickValues.map((v) => (
          <button
            key={v}
            onClick={() => setAmountReceived(v)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
              amountReceived === v
                ? 'bg-[#10b981]/10 border-[#10b981] text-[#10b981]'
                : 'bg-[#0f0720] border-[#2d1550] text-[#9d7bc8] hover:border-[#4c1e8c] hover:text-white'
            }`}
          >
            {formatCurrency(v)}
          </button>
        ))}
      </div>

      {/* Manual input */}
      <div>
        <label htmlFor="amount-received" className="sr-only">
          Valor recebido
        </label>
        <input
          id="amount-received"
          type="number"
          inputMode="decimal"
          step="0.01"
          min={amount}
          value={amountReceived ?? ''}
          onChange={(e) => {
            const val = parseFloat(e.target.value)
            if (!isNaN(val) && val >= 0) setAmountReceived(val)
          }}
          placeholder={`Mín. ${formatCurrency(amount)}`}
          className={`w-full px-3 py-2 rounded-lg bg-[#0f0720] border text-white placeholder-[#4a3570] focus:outline-none focus:ring-2 focus:ring-[#4c1e8c] text-lg ${
            isInsufficient ? 'border-red-500' : 'border-[#2d1550]'
          }`}
        />
        {isInsufficient && (
          <p className="text-red-400 text-xs mt-1">
            Valor insuficiente. Mínimo: {formatCurrency(amount)}
          </p>
        )}
      </div>

      {/* Troco */}
      {change !== null && change >= 0 && (
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-[#9d7bc8]">Troco</span>
          <span className="text-4xl font-bold text-[#10b981]">{formatCurrency(change)}</span>
        </div>
      )}
    </div>
  )
}

export { getQuickValues }
