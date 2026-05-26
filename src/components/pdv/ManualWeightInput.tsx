import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useSaleStore, formatCurrency } from '@/stores/saleStore'
import { usePricePerGram } from '@/hooks/usePricePerGram'
import { CASQUINHA_PRICE } from '@/constants/pricing'
import type { ManualInputProvider } from '@/providers/scale/ManualInputProvider'

interface ManualWeightInputProps {
  provider: ManualInputProvider
}

export function ManualWeightInput({ provider }: ManualWeightInputProps) {
  const [digits, setDigits] = useState('')
  const [error, setError] = useState<string | null>(null)

  const captureAmount = useSaleStore((s) => s.captureAmount)
  const capturedWeight = useSaleStore((s) => s.capturedWeightGrams)
  const capturedAmount = useSaleStore((s) => s.amount)
  const hasCasquinha = useSaleStore((s) => s.hasCasquinha)
  const reset = useSaleStore((s) => s.reset)

  const { data: pricePerGram } = usePricePerGram()

  // ── Confirmed state ─────────────────────────────────────────────────────────
  // After the user confirms a value, show the summary card instead of the input.
  if (capturedAmount !== null) {
    const pricePerKg = pricePerGram
      ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
          pricePerGram * 1000
        )
      : null

    return (
      <div className="rounded-xl bg-[#1a0b2e] border border-[#2d1550] p-4 space-y-3">
        {capturedWeight !== null && pricePerKg && (
          <p className="text-sm text-[#9d7bc8]">
            {capturedWeight}g × {pricePerKg}/kg
          </p>
        )}

        {capturedWeight !== null && hasCasquinha && (
          <div className="space-y-1 text-sm border-t border-[#2d1550] pt-3">
            <div className="flex justify-between text-[#9d7bc8]">
              <span>Açaí {capturedWeight}g</span>
              <span className="tabular-nums">
                {formatCurrency(capturedAmount - CASQUINHA_PRICE)}
              </span>
            </div>
            <div className="flex justify-between text-[#9d7bc8]">
              <span>+ Casquinha</span>
              <span className="tabular-nums">{formatCurrency(CASQUINHA_PRICE)}</span>
            </div>
          </div>
        )}

        <div className="text-4xl font-bold tabular-nums text-white">
          {formatCurrency(capturedAmount)}
        </div>

        <p className="text-xs text-[#10b981] font-medium">Valor confirmado ✓</p>

        <button
          onClick={() => {
            reset()
            setDigits('')
            setError(null)
          }}
          className="w-full py-1.5 rounded-lg border border-[#2d1550] text-[#9d7bc8] hover:text-white text-sm transition-colors"
        >
          Alterar valor
        </button>
      </div>
    )
  }

  // ── Entry state ──────────────────────────────────────────────────────────────
  // Centavo-based: "2750" → 2750 centavos → R$ 27,50
  const centavos = parseInt(digits || '0', 10)
  const reais = centavos / 100
  const displayValue = reais.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const ie = e.nativeEvent as InputEvent
    const inputType = ie.inputType ?? ''
    const data = ie.data ?? ''

    if (inputType === 'deleteContentBackward' || inputType === 'deleteWordBackward') {
      setDigits((d) => d.slice(0, -1))
    } else if (/^\d$/.test(data)) {
      setDigits((d) => (d.length >= 7 ? d : d + data))
    }
    setError(null)
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 7)
    if (pasted) {
      setDigits(pasted)
      setError(null)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleConfirm()
    }
  }

  function handleConfirm() {
    if (reais <= 0) {
      setError('Digite um valor válido maior que zero.')
      return
    }
    if (reais > 10_000) {
      setError('Valor máximo: R$ 10.000,00.')
      return
    }
    if (!pricePerGram) return

    const grams = Math.round(reais / pricePerGram)
    provider.setWeight(grams)
    captureAmount(reais, pricePerGram)

    setDigits('')
    setError(null)
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
          type="text"
          inputMode="numeric"
          value={displayValue}
          onChange={handleChange}
          onPaste={handlePaste}
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
        disabled={centavos === 0 || !pricePerGram}
        className="h-14 text-lg bg-[#4c1e8c] hover:bg-[#5d2aaa] disabled:opacity-40 text-white"
      >
        Confirmar Valor
      </Button>
    </div>
  )
}
