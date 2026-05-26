import { useSaleStore, formatCurrency } from '@/stores/saleStore'
import { CASQUINHA_PRICE } from '@/constants/pricing'

/**
 * Casquinha add-on toggle for the açaí-by-weight PDV flow.
 *
 * EPIC-10 / Story 10.1.
 *
 * Visibility (AC1, AC8):
 *   - Renders ONLY when a weight has been captured. Before capture,
 *     the operator does not see this toggle — it cannot be turned on
 *     in the void.
 *   - Lives inside the weight-by-PDV flow, so by composition it does
 *     not appear in the unit-product flow (Story 10.4).
 *
 * Behavior:
 *   - Reads/writes `hasCasquinha` from the saleStore via
 *     `toggleCasquinha`, which also recomputes `amount` so the total
 *     in `PriceDisplay` updates in real time (AC3).
 *   - When active, shows an explicit breakdown line ("Casquinha
 *     R$ 1,00") so the operator can verify the charge before
 *     confirming (AC4 — complemented by the breakdown rendered in
 *     PriceDisplay itself).
 */
export function CasquinhaToggle() {
  const capturedWeight = useSaleStore((s) => s.capturedWeightGrams)
  const hasCasquinha = useSaleStore((s) => s.hasCasquinha)
  const toggleCasquinha = useSaleStore((s) => s.toggleCasquinha)

  // AC1 — toggle is only visible once the operator has captured a
  // weight. This avoids ambiguity ("casquinha on what?") and matches
  // the disabled-when-no-weight rule from the story tasks.
  if (capturedWeight === null) return null

  return (
    <div
      className={`rounded-xl border p-4 transition-colors ${
        hasCasquinha
          ? 'bg-[#2d1550] border-[#4c1e8c]'
          : 'bg-[#1a0b2e] border-[#2d1550]'
      }`}
    >
      <button
        type="button"
        role="switch"
        aria-checked={hasCasquinha}
        aria-label="Adicionar casquinha por R$ 1,00"
        onClick={toggleCasquinha}
        className="w-full flex items-center justify-between gap-4 text-left"
      >
        <div className="flex flex-col">
          <span className="text-base font-semibold text-white">
            Casquinha +{formatCurrency(CASQUINHA_PRICE)}
          </span>
          <span className="text-xs text-[#9d7bc8]">
            {hasCasquinha
              ? `+${formatCurrency(CASQUINHA_PRICE)} adicionado ao total`
              : 'Toque para adicionar ao pedido'}
          </span>
        </div>

        {/* Visual toggle pill */}
        <span
          className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${
            hasCasquinha ? 'bg-[#10b981]' : 'bg-[#4a3570]'
          }`}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
              hasCasquinha ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </span>
      </button>
    </div>
  )
}
