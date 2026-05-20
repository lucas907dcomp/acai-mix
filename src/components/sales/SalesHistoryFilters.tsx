import type { PaymentMethod, SaleStatus } from '@/types'

const PAYMENT_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: 'pix', label: 'PIX' },
  { value: 'credit', label: 'Crédito' },
  { value: 'debit', label: 'Débito' },
  { value: 'cash', label: 'Dinheiro' },
]

const STATUS_OPTIONS: { value: SaleStatus; label: string }[] = [
  { value: 'COMPLETED', label: 'Ativa' },
  { value: 'CANCELLED', label: 'Cancelada' },
]

interface SalesHistoryFiltersProps {
  from: Date
  to: Date
  paymentMethods: PaymentMethod[]
  statuses: SaleStatus[]
  page: number
  totalPages: number
  onFromChange: (d: Date) => void
  onToChange: (d: Date) => void
  onPaymentMethodsChange: (v: PaymentMethod[]) => void
  onStatusesChange: (v: SaleStatus[]) => void
  onPageChange: (p: number) => void
  onClearFilters: () => void
}

function toInputValue(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function fromInputValue(s: string): Date {
  return new Date(s + 'T00:00:00')
}

export function SalesHistoryFilters({
  from, to, paymentMethods, statuses, page, totalPages,
  onFromChange, onToChange, onPaymentMethodsChange, onStatusesChange,
  onPageChange, onClearFilters,
}: SalesHistoryFiltersProps) {
  function togglePayment(value: PaymentMethod) {
    onPaymentMethodsChange(
      paymentMethods.includes(value)
        ? paymentMethods.filter((v) => v !== value)
        : [...paymentMethods, value]
    )
  }

  function toggleStatus(value: SaleStatus) {
    onStatusesChange(
      statuses.includes(value)
        ? statuses.filter((v) => v !== value)
        : [...statuses, value]
    )
  }

  return (
    <div className="rounded-xl bg-[#1a0b2e] border border-[#2d1550] p-4 space-y-4">
      {/* Date range */}
      <div className="flex flex-wrap gap-4 items-end">
        <div className="space-y-1">
          <label className="text-xs text-[#9d7bc8]">De</label>
          <input
            type="date"
            value={toInputValue(from)}
            onChange={(e) => e.target.value && onFromChange(fromInputValue(e.target.value))}
            className="bg-[#0f0720] border border-[#2d1550] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#4c1e8c]"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-[#9d7bc8]">Até</label>
          <input
            type="date"
            value={toInputValue(to)}
            onChange={(e) => e.target.value && onToChange(fromInputValue(e.target.value))}
            className="bg-[#0f0720] border border-[#2d1550] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#4c1e8c]"
          />
        </div>

        {/* Payment methods */}
        <div className="space-y-1">
          <label className="text-xs text-[#9d7bc8]">Pagamento</label>
          <div className="flex gap-2 flex-wrap">
            {PAYMENT_OPTIONS.map(({ value, label }) => (
              <label
                key={value}
                className="flex items-center gap-1.5 cursor-pointer text-sm text-[#9d7bc8] hover:text-white"
              >
                <input
                  type="checkbox"
                  checked={paymentMethods.length === 0 || paymentMethods.includes(value)}
                  onChange={() => togglePayment(value)}
                  className="accent-[#4c1e8c]"
                />
                {label}
              </label>
            ))}
          </div>
        </div>

        {/* Status */}
        <div className="space-y-1">
          <label className="text-xs text-[#9d7bc8]">Status</label>
          <div className="flex gap-2">
            {STATUS_OPTIONS.map(({ value, label }) => (
              <label
                key={value}
                className="flex items-center gap-1.5 cursor-pointer text-sm text-[#9d7bc8] hover:text-white"
              >
                <input
                  type="checkbox"
                  checked={statuses.length === 0 || statuses.includes(value)}
                  onChange={() => toggleStatus(value)}
                  className="accent-[#4c1e8c]"
                />
                {label}
              </label>
            ))}
          </div>
        </div>

        <button
          onClick={onClearFilters}
          className="text-xs text-[#9d7bc8] hover:text-white underline transition-colors self-end pb-2"
        >
          Limpar filtros
        </button>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2 border-t border-[#2d1550]">
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page === 0}
            className="px-3 py-1.5 text-sm rounded-lg bg-[#2d1550] text-[#9d7bc8] hover:text-white disabled:opacity-40 transition-colors"
          >
            ← Anterior
          </button>
          <span className="text-xs text-[#9d7bc8]">
            Página {page + 1} de {totalPages}
          </span>
          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages - 1}
            className="px-3 py-1.5 text-sm rounded-lg bg-[#2d1550] text-[#9d7bc8] hover:text-white disabled:opacity-40 transition-colors"
          >
            Próxima →
          </button>
        </div>
      )}
    </div>
  )
}
