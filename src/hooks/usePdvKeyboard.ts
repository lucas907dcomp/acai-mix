import { useEffect, useRef } from 'react'
import { useSaleStore } from '@/stores/saleStore'
import { useCombinedOrderStore } from '@/stores/combinedOrderStore'
import { useScaleStore } from '@/stores/scaleStore'
import { usePricePerGram } from '@/hooks/usePricePerGram'
import { useReconnectSerial } from '@/hooks/useScale'
import type { PaymentMethod } from '@/types'

const KEY_TO_PAYMENT: Record<string, PaymentMethod> = {
  '1': 'pix',
  '2': 'credit',
  '3': 'debit',
  '4': 'cash',
}

function isInputFocused(): boolean {
  const el = document.activeElement
  if (!el) return false
  const tag = el.tagName.toLowerCase()
  return (
    tag === 'input' ||
    tag === 'textarea' ||
    tag === 'select' ||
    (el as HTMLElement).isContentEditable
  )
}

function isModalOpen(): boolean {
  return document.querySelector('[role="dialog"]') !== null
}

export function usePdvKeyboard() {
  const { data: pricePerGram } = usePricePerGram()
  const priceRef = useRef(pricePerGram)

  const { reconnectSerial } = useReconnectSerial()
  const reconnectRef = useRef(reconnectSerial)

  useEffect(() => { priceRef.current = pricePerGram }, [pricePerGram])
  useEffect(() => { reconnectRef.current = reconnectSerial }, [reconnectSerial])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (isInputFocused()) return
      if (isModalOpen()) return

      const sale = useSaleStore.getState()
      const combined = useCombinedOrderStore.getState()
      const scale = useScaleStore.getState()
      const ppg = priceRef.current

      // B — connect/reconnect serial scale
      if (e.key === 'b' || e.key === 'B') {
        e.preventDefault()
        reconnectRef.current()
        return
      }

      // Esc — clear current sale (only if there's something to clear)
      if (e.key === 'Escape') {
        if (sale.capturedWeightGrams !== null || sale.paymentMethod !== null || sale.amount !== null) {
          e.preventDefault()
          sale.reset()
        }
        if (combined.activeOrderId !== null) {
          combined.activateOrder(null)
        }
        return
      }

      // C — toggle casquinha (only after weight is captured)
      if ((e.key === 'c' || e.key === 'C') && sale.capturedWeightGrams !== null) {
        e.preventDefault()
        sale.toggleCasquinha()
        return
      }

      // 1/2/3/4 — select payment method (only after weight is captured)
      const payment = KEY_TO_PAYMENT[e.key]
      if (payment && sale.capturedWeightGrams !== null) {
        e.preventDefault()
        sale.setPaymentMethod(payment)
        return
      }

      // Enter — two-step: (1) capture weight, (2) confirm sale / add to order
      if (e.key === 'Enter') {
        const { activeOrderId } = combined

        // Combined order mode: add captured weight to active order
        if (activeOrderId && sale.capturedWeightGrams !== null && sale.amount !== null) {
          e.preventDefault()
          combined.addWeightItem({
            type: 'weight',
            weight_grams: sale.capturedWeightGrams,
            price_per_gram: sale.pricePerGram ?? 0,
            has_casquinha: sale.hasCasquinha,
            amount: sale.amount,
          })
          sale.reset()
          return
        }

        // Step 1: capture weight from scale (if not yet captured)
        const currentW = scale.currentWeightGrams
        if (sale.capturedWeightGrams === null && currentW && currentW > 0 && ppg) {
          e.preventDefault()
          sale.captureWeight(currentW, ppg)
          return
        }

        // Step 2: confirm sale
        const { paymentMethod, amountReceived, isConfirming, amount } = sale
        const cashOk =
          paymentMethod !== 'cash' ||
          (amountReceived !== null && amountReceived >= (amount ?? 0))
        const canConfirm = amount !== null && paymentMethod !== null && cashOk && !isConfirming
        if (canConfirm) {
          e.preventDefault()
          sale.confirmSale()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])
}
