import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useSaleStore, formatCurrency } from '@/stores/saleStore'
import { useScaleStore } from '@/stores/scaleStore'
import { usePricePerGram } from '@/hooks/usePricePerGram'
import { useCasquinhaPrice } from '@/hooks/useCasquinhaPrice'
import { IceCreamCone } from 'lucide-react'

export function PriceDisplay() {
  const casquinhaPrice = useCasquinhaPrice()
  const currentWeight = useScaleStore((s) => s.currentWeightGrams)
  const singleShot = useScaleStore((s) => !!s.provider?.singleShot)
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

  // Recapturar pedido e a balança mandou: troca sozinho. Vale só para a venda em
  // que foi pedido, para o peso do próximo cliente nunca entrar nela.
  const [aguardando, setAguardando] = useState(false)
  useEffect(() => {
    if (!aguardando || !pricePerGram) return
    const pararVenda = useSaleStore.subscribe((v) => {
      if (v.capturedWeightGrams === null) setAguardando(false)
    })
    const pararPeso = useScaleStore.subscribe((b) => {
      if (!b.currentWeightGrams) return
      setAguardando(false)
      captureWeight(b.currentWeightGrams, pricePerGram)
    })
    return () => {
      pararVenda()
      pararPeso()
    }
  }, [aguardando, pricePerGram, captureWeight])

  function handleCapture() {
    if (currentWeight && currentWeight > 0 && pricePerGram) {
      captureWeight(currentWeight, pricePerGram)
    }
  }

  function handleRecapture() {
    // Balança de envio único: não dá para pedir o peso, e mudança pequena ela
    // não reenvia sozinha. Sem peso novo, nada zera: fica esperando o P.
    if (singleShot && !(capturedWeight !== null && currentWeight)) {
      if (capturedWeight !== null) setAguardando(true)
      toast.info('Aperte P na balança para atualizar o peso.')
      return
    }
    useSaleStore.getState().captureWeight(currentWeight ?? capturedWeight ?? 0, pricePerGram ?? 0)
  }

  if (isLoading) {
    return (
      <div className="rounded-xl bg-[#1a0b2e] border border-[#2d1550] p-4 animate-pulse h-28" />
    )
  }

  return (
    <div
      className={`rounded-xl bg-[#1a0b2e] border border-[#2d1550] space-y-3 ${singleShot ? 'px-4 py-2.5' : 'p-4'}`}
    >
      {/* Peso × preço/kg */}
      {displayWeight !== null && pricePerGram && (
        <p className="text-sm text-[#9d7bc8]">
          {displayWeight}g ×{' '}
          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
            pricePerGram * 1000
          )}
          /kg
        </p>
      )}

      {/* Toggle casquinha + total — sempre na mesma linha */}
      <div className="flex items-center justify-between gap-3">
        {capturedWeight !== null ? (
          <button
            type="button"
            role="switch"
            aria-checked={hasCasquinha}
            aria-label={`Adicionar casquinha por ${formatCurrency(casquinhaPrice)}`}
            onClick={toggleCasquinha}
            className={`flex items-center gap-2 rounded-lg px-3 py-2 border transition-colors shrink-0 ${
              hasCasquinha
                ? 'bg-[#2d1550] border-[#4c1e8c] text-white'
                : 'bg-[#0f0720] border-[#2d1550] text-[#9d7bc8] hover:border-[#4c1e8c] hover:text-white'
            }`}
          >
            <IceCreamCone size={16} />
            <span className="text-sm font-medium leading-none">
              +{formatCurrency(casquinhaPrice)}
            </span>
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
          <span />
        )}

        <div className="text-4xl font-bold tabular-nums text-white">
          {amount !== null
            ? formatCurrency(amount)
            : previewAmount !== null
              ? formatCurrency(previewAmount)
              : '—'}
        </div>
      </div>

      {/* Capturar peso / status + Recapturar — ocupa sempre a mesma altura */}
      {capturedWeight !== null ? (
        <div className="flex items-center gap-2">
          <div className="flex-1 flex items-center justify-center py-2.5 rounded-lg bg-[#10b981]/10 border border-[#10b981]/30">
            <span className="text-xs text-[#10b981] font-semibold">
              {aguardando ? `${capturedWeight}g · aperte P na balança` : `✓ ${capturedWeight}g capturado`}
            </span>
          </div>
          <button
            onClick={handleRecapture}
            disabled={!singleShot && (!currentWeight || currentWeight <= 0 || !pricePerGram)}
            className={
              singleShot
                ? 'shrink-0 px-5 py-2.5 rounded-lg border border-[#9d7bc8] bg-[#2d1550] text-white font-semibold hover:bg-[#3d1f6e] transition-colors'
                : 'shrink-0 px-4 py-2.5 rounded-lg border border-[#2d1550] text-[#9d7bc8] hover:text-white hover:border-[#4c1e8c] disabled:opacity-40 text-sm transition-colors'
            }
          >
            Recapturar
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <button
            onClick={handleCapture}
            disabled={!currentWeight || currentWeight <= 0 || !pricePerGram || capturedWeight !== null}
            className="w-full py-2.5 rounded-lg bg-[#4c1e8c] hover:bg-[#5d2aa8] disabled:opacity-40 text-white font-semibold transition-colors"
            aria-label="Capturar peso atual da balança"
          >
            Capturar Peso
          </button>
          {singleShot && (
            <button
              onClick={handleRecapture}
              className="shrink-0 px-5 py-2.5 rounded-lg border border-[#9d7bc8] bg-[#2d1550] text-white font-semibold hover:bg-[#3d1f6e] transition-colors"
            >
              Recapturar
            </button>
          )}
        </div>
      )}
    </div>
  )
}
