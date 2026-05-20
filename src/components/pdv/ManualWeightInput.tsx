import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useSaleStore } from '@/stores/saleStore'
import { usePricePerGram } from '@/hooks/usePricePerGram'
import type { ManualInputProvider } from '@/providers/scale/ManualInputProvider'

interface ManualWeightInputProps {
  provider: ManualInputProvider
}

export function ManualWeightInput({ provider }: ManualWeightInputProps) {
  const [raw, setRaw] = useState('')
  const [error, setError] = useState<string | null>(null)
  const captureWeight = useSaleStore((s) => s.captureWeight)
  const { data: pricePerGram } = usePricePerGram()

  function handleConfirm() {
    const grams = parseFloat(raw)

    if (isNaN(grams) || grams <= 0) {
      setError('Digite um peso válido maior que zero.')
      return
    }
    if (grams > 10000) {
      setError('Peso máximo: 10.000g (10kg).')
      return
    }

    const rounded = Math.round(grams)
    provider.setWeight(rounded)

    if (pricePerGram) {
      captureWeight(rounded, pricePerGram)
    }

    setRaw('')
    setError(null)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleConfirm()
  }

  return (
    <div className="flex flex-col gap-3">
      <label htmlFor="manual-weight" className="text-sm text-[#9d7bc8]">
        Peso em gramas
      </label>
      <Input
        id="manual-weight"
        type="number"
        inputMode="decimal"
        placeholder="Ex: 350"
        value={raw}
        onChange={(e) => {
          setRaw(e.target.value)
          setError(null)
        }}
        onKeyDown={handleKeyDown}
        className="text-4xl h-16 text-center font-bold bg-[#0f0720] border-[#2d1550] text-white placeholder:text-[#4a3570] focus-visible:ring-[#4c1e8c]"
        aria-label="Peso manual em gramas"
        aria-describedby={error ? 'weight-error' : undefined}
        autoFocus
      />
      {error && (
        <p id="weight-error" className="text-sm text-red-400" role="alert">
          {error}
        </p>
      )}
      <Button
        onClick={handleConfirm}
        disabled={!raw || !pricePerGram}
        className="h-14 text-lg bg-[#4c1e8c] hover:bg-[#5d2aaa] disabled:opacity-40 text-white"
      >
        Confirmar Peso
      </Button>
    </div>
  )
}
