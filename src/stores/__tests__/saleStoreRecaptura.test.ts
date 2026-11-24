import { describe, it, expect, beforeEach } from 'vitest'
import { useSaleStore } from '../saleStore'

describe('recapturar depois de digitar o dinheiro', () => {
  beforeEach(() => useSaleStore.getState().reset())

  it('limpa o valor recebido e o troco do total antigo', () => {
    const s = useSaleStore.getState()
    s.captureWeight(138, 0.0499)
    s.setPaymentMethod('cash')
    s.setAmountReceived(20)
    expect(useSaleStore.getState().change).toBe(13.11)

    s.captureWeight(266, 0.0499)
    expect(useSaleStore.getState()).toMatchObject({
      amount: 13.27, paymentMethod: 'cash', amountReceived: null, change: null,
    })
    s.setAmountReceived(20)
    expect(useSaleStore.getState().change).toBe(6.73)
  })
})
