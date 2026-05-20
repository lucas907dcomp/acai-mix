import { useSaleStore, formatCurrency } from '@/stores/saleStore'
import { useScaleStore } from '@/stores/scaleStore'
import { usePricePerGram } from '@/hooks/usePricePerGram'

export function PriceDisplay() {
  const currentWeight = useScaleStore((s) => s.currentWeightGrams)
  const capturedWeight = useSaleStore((s) => s.capturedWeightGrams)
  const amount = useSaleStore((s) => s.amount)
  const captureWeight = useSaleStore((s) => s.captureWeight)

  const { data: pricePerGram, isLoading } = usePricePerGram()

  const displayWeight = capturedWeight ?? currentWeight
  const previewAmount =
    !capturedWeight && currentWeight && pricePerGram
      ? Math.round(currentWeight * pricePerGram * 100) / 100
      : null

  function handleCapture() {
    if (currentWeight && currentWeight > 0 && pricePerGram) {
      captureWeight(currentWeight, pricePerGram)
    }
  }

  if (isLoading) {
    return (
      <div className="rounded-xl bg-[#1a0b2e] border border-[#2d1550] p-4 animate-pulse h-28" />
    )
  }

  return (
    <div className="rounded-xl bg-[#1a0b2e] border border-[#2d1550] p-4 space-y-3">
      {/* Peso × preço preview */}
      {displayWeight !== null && pricePerGram && (
        <p className="text-sm text-[#9d7bc8]">
          {displayWeight}g ×{' '}
          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
            pricePerGram * 1000
          )}
          /kg
        </p>
      )}

      {/* Total */}
      <div className="text-4xl font-bold tabular-nums text-white">
        {amount !== null
          ? formatCurrency(amount)
          : previewAmount !== null
            ? formatCurrency(previewAmount)
            : '—'}
      </div>

      {capturedWeight !== null && (
        <p className="text-xs text-[#10b981] font-medium">Peso capturado: {capturedWeight}g</p>
      )}

      {/* Capturar peso */}
      <button
        onClick={handleCapture}
        disabled={!currentWeight || currentWeight <= 0 || !pricePerGram || capturedWeight !== null}
        className="w-full py-2.5 rounded-lg bg-[#4c1e8c] hover:bg-[#5d2aa8] disabled:opacity-40 text-white font-semibold transition-colors"
        aria-label="Capturar peso atual da balança"
      >
        {capturedWeight !== null ? 'Peso capturado ✓' : 'Capturar Peso'}
      </button>

      {capturedWeight !== null && (
        <button
          onClick={() =>
            useSaleStore
              .getState()
              .captureWeight(currentWeight ?? capturedWeight, pricePerGram ?? 0)
          }
          className="w-full py-1.5 rounded-lg border border-[#2d1550] text-[#9d7bc8] hover:text-white text-sm transition-colors"
        >
          Recapturar
        </button>
      )}
    </div>
  )
}
