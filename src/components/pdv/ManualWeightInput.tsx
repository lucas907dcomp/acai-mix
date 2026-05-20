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
  const captureAmount = useSaleStore((s) => s.captureAmount)
  const { data: pricePerGram } = usePricePerGram()

  function handleConfirm() {
    const amount = parseFloat(raw.replace(',', '.'))

    if (isNaN(amount) || amount <= 0) {
      setError('Digite um valor válido maior que zero.')
      return
    }
    if (amount > 10_000) {
      setError('Valor máximo: R$ 10.000,00.')
      return
    }

    if (!pricePerGram) return

    const grams = Math.round(amount / pricePerGram)
    provider.setWeight(grams)
    captureAmount(amount, pricePerGram)

    setRaw('')
    setError(null)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleConfirm()
  }

  return (
    <div className="flex flex-col gap-3">
      <label htmlFor="manual-value" className="text-sm text-[#9d7bc8]">
        Valor da venda (R$)
      </label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-2xl font-bold text-[#4a3570] pointer-events-none select-none">
          R$
        </span>
        <Input
          id="manual-value"
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0.01"
          placeholder="0,00"
          value={raw}
          onChange={(e) => {
            setRaw(e.target.value)
            setError(null)
          }}
          onKeyDown={handleKeyDown}
          className="pl-12 text-4xl h-16 text-center font-bold bg-[#0f0720] border-[#2d1550] text-white placeholder:text-[#4a3570] focus-visible:ring-[#4c1e8c]"
          aria-label="Valor manual da venda em reais"
          aria-describedby={error ? 'value-error' : undefined}
          autoFocus
        />
      </div>
      {error && (
        <p id="value-error" className="text-sm text-red-400" role="alert">
          {error}
        </p>
      )}
      <Button
        onClick={handleConfirm}
        disabled={!raw || !pricePerGram}
        className="h-14 text-lg bg-[#4c1e8c] hover:bg-[#5d2aaa] disabled:opacity-40 text-white"
      >
        Confirmar Valor
      </Button>
    </div>
  )
}
