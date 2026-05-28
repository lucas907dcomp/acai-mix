import { useEffect } from 'react'
import { useSaleStore } from '@/stores/saleStore'
import { useCombinedOrderStore } from '@/stores/combinedOrderStore'
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
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (isInputFocused()) return
      if (isModalOpen()) return

      const saleState = useSaleStore.getState()
      const combinedState = useCombinedOrderStore.getState()

      // 1/2/3/4 — select payment method (only when weight is captured)
      const payment = KEY_TO_PAYMENT[e.key]
      if (payment && saleState.amount !== null) {
        e.preventDefault()
        saleState.setPaymentMethod(payment)
        return
      }

      // Enter — confirm sale or add to combined order
      if (e.key === 'Enter') {
        const { activeOrderId } = combinedState
        const { capturedWeightGrams, pricePerGram, hasCasquinha, amount } = saleState

        // Combined order mode: add current weight to active order
        if (activeOrderId && capturedWeightGrams !== null && amount !== null) {
          e.preventDefault()
          combinedState.addWeightItem({
            type: 'weight',
            weight_grams: capturedWeightGrams,
            price_per_gram: pricePerGram ?? 0,
            has_casquinha: hasCasquinha,
            amount,
          })
          saleState.reset()
          return
        }

        // Normal mode: confirm sale
        const { paymentMethod, amountReceived, isConfirming } = saleState
        const cashOk =
          paymentMethod !== 'cash' ||
          (amountReceived !== null && amountReceived >= (amount ?? 0))
        const canConfirm =
          amount !== null && paymentMethod !== null && cashOk && !isConfirming

        if (canConfirm) {
          e.preventDefault()
          saleState.confirmSale()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, []) // stable: reads state directly via getState() inside handler
}
