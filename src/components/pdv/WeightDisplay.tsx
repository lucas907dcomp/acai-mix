import { useScaleStore } from '@/stores/scaleStore'
import { ManualWeightInput } from './ManualWeightInput'
import type { ManualInputProvider } from '@/providers/scale/ManualInputProvider'

function formatWeight(grams: number): string {
  if (grams >= 1000) return (grams / 1000).toFixed(3) + ' kg'
  return grams + ' g'
}

export function WeightDisplay() {
  const weight = useScaleStore((s) => s.currentWeightGrams)
  const providerType = useScaleStore((s) => s.providerType)
  const provider = useScaleStore((s) => s.provider)

  if (providerType === 'manual') {
    return <ManualWeightInput provider={provider as ManualInputProvider} />
  }

  return (
    <div
      className="flex items-baseline gap-2 transition-all duration-150"
      aria-live="polite"
      aria-label={weight !== null ? `Peso: ${formatWeight(weight)}` : 'Aguardando peso'}
    >
      <span
        className={`text-6xl font-bold tabular-nums transition-colors duration-150 ${
          weight && weight > 0 ? 'text-[#10b981]' : 'text-[#4a3570]'
        }`}
      >
        {weight !== null ? formatWeight(weight) : '— g'}
      </span>
    </div>
  )
}
