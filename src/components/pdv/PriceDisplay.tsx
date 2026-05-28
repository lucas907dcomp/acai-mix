import { useSaleStore, formatCurrency } from '@/stores/saleStore'
import { useScaleStore } from '@/stores/scaleStore'
import { usePricePerGram } from '@/hooks/usePricePerGram'
import { CASQUINHA_PRICE } from '@/constants/pricing'
import { IceCreamCone } from 'lucide-react'

export function PriceDisplay() {
  const currentWeight = useScaleStore((s) => s.currentWeightGrams)
  const capturedWeight = useSaleStore((s) => s.capturedWeightGrams)
  const amount = useSaleStore((s) => s.amount)
  const hasCasquinha = useSaleStore((s) => s.hasCasquinha)
  const toggleCasquinha = useSaleStore((s) => s.toggleCasquinha)
  const captureWeight = useSaleStore((s) => s.captureWeight)

  const { data: pricePerGram, isLoading } = usePricePerGram()

  const displayWeight = capturedWeight ?? currentWeight
  const previewAmount =
    !capturedWeight && currentWeight && pricePerGram
      ? Math.round((currentWeight * Math.round(pricePerGram * 100_000)) / 1_000) / 100
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

      {/* Breakdown when casquinha is active (AC4) — only meaningful
          after the weight is captured. */}
      {capturedWeight !== null && hasCasquinha && amount !== null && (
        <div className="space-y-1 text-sm border-t border-[#2d1550] pt-3">
          <div className="flex justify-between text-[#9d7bc8]">
            <span>Açaí {capturedWeight}g</span>
            <span className="tabular-nums">
              {formatCurrency(amount - CASQUINHA_PRICE)}
            </span>
          </div>
          <div className="flex justify-between text-[#9d7bc8]">
            <span>+ Casquinha</span>
            <span className="tabular-nums">{formatCurrency(CASQUINHA_PRICE)}</span>
          </div>
        </div>
      )}

      {/* Total + casquinha toggle (inline after capture) */}
      <div className="flex items-center justify-between gap-3">
        {capturedWeight !== null ? (
          <button
            type="button"
            role="switch"
            aria-checked={hasCasquinha}
            aria-label="Adicionar casquinha por R$ 1,00"
            onClick={toggleCasquinha}
            className={`flex items-center gap-2 rounded-lg px-3 py-2 border transition-colors shrink-0 ${
              hasCasquinha
                ? 'bg-[#2d1550] border-[#4c1e8c] text-white'
                : 'bg-[#0f0720] border-[#2d1550] text-[#9d7bc8] hover:border-[#4c1e8c] hover:text-white'
            }`}
          >
            <IceCreamCone size={16} />
            <span className="text-sm font-medium leading-none">
              +{formatCurrency(CASQUINHA_PRICE)}
            </span>
            {/* pill */}
            <span
              className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                hasCasquinha ? 'bg-[#10b981]' : 'bg-[#4a3570]'
              }`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                  hasCasquinha ? 'translate-x-4' : 'translate-x-0.5'
                }`}
              />
            </span>
          </button>
        ) : (
          <span /> /* spacer so total stays right-aligned */
        )}

        <div className="text-4xl font-bold tabular-nums text-white">
          {amount !== null
            ? formatCurrency(amount)
            : previewAmount !== null
              ? formatCurrency(previewAmount)
              : '—'}
        </div>
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
          disabled={!currentWeight || currentWeight <= 0 || !pricePerGram}
          className="w-full py-1.5 rounded-lg border border-[#2d1550] text-[#9d7bc8] hover:text-white disabled:opacity-40 text-sm transition-colors"
        >
          Recapturar
        </button>
      )}
    </div>
  )
}
