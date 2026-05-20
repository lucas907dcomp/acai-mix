import { describe, it, expect, beforeEach } from 'vitest'
import { useSaleStore } from '../saleStore'

beforeEach(() => {
  useSaleStore.setState({
    capturedWeightGrams: null,
    pricePerGram: null,
    amount: null,
    paymentMethod: null,
    amountReceived: null,
    change: null,
    isConfirming: false,
  })
})

describe('saleStore.captureWeight', () => {
  it('calcula amount corretamente: 345g × R$0,065 = R$22,43', () => {
    useSaleStore.getState().captureWeight(345, 0.065)
    const { capturedWeightGrams, amount } = useSaleStore.getState()
    expect(capturedWeightGrams).toBe(345)
    expect(amount).toBe(22.43)
  })

  it('arredonda para 2 casas decimais', () => {
    useSaleStore.getState().captureWeight(333, 0.065)
    const { amount } = useSaleStore.getState()
    // 333 × 0.065 = 21.645 → Math.round(2164.5) / 100 = 21.65
    expect(amount).toBe(21.65)
  })

  it('armazena pricePerGram no estado', () => {
    useSaleStore.getState().captureWeight(500, 0.07)
    expect(useSaleStore.getState().pricePerGram).toBe(0.07)
  })
})

describe('saleStore.captureAmount', () => {
  it('preserva o valor exato digitado pelo operador', () => {
    useSaleStore.getState().captureAmount(24.75, 0.05499)
    expect(useSaleStore.getState().amount).toBe(24.75)
  })

  it('back-calcula gramas a partir do valor', () => {
    useSaleStore.getState().captureAmount(27.5, 0.055)
    // 27.5 / 0.055 = 500
    expect(useSaleStore.getState().capturedWeightGrams).toBe(500)
  })

  it('armazena pricePerGram no estado', () => {
    useSaleStore.getState().captureAmount(20, 0.065)
    expect(useSaleStore.getState().pricePerGram).toBe(0.065)
  })

  it('retorna 0 gramas quando pricePerGram é zero', () => {
    useSaleStore.getState().captureAmount(10, 0)
    expect(useSaleStore.getState().capturedWeightGrams).toBe(0)
  })
})

describe('saleStore.setPaymentMethod', () => {
  it('define o método de pagamento', () => {
    useSaleStore.getState().setPaymentMethod('pix')
    expect(useSaleStore.getState().paymentMethod).toBe('pix')
  })

  it('limpa amountReceived e change ao selecionar não-cash', () => {
    useSaleStore.setState({ amountReceived: 50, change: 27.57 })
    useSaleStore.getState().setPaymentMethod('pix')
    const { amountReceived, change } = useSaleStore.getState()
    expect(amountReceived).toBeNull()
    expect(change).toBeNull()
  })
})

describe('saleStore.setAmountReceived', () => {
  it('calcula troco corretamente', () => {
    useSaleStore.getState().captureWeight(345, 0.065) // amount = 22.43
    useSaleStore.getState().setAmountReceived(50)
    expect(useSaleStore.getState().change).toBe(27.57)
  })

  it('troco negativo quando valor insuficiente', () => {
    useSaleStore.getState().captureWeight(345, 0.065) // amount = 22.43
    useSaleStore.getState().setAmountReceived(20)
    expect(useSaleStore.getState().change).toBe(-2.43)
  })

  it('troco zero quando valor exato', () => {
    useSaleStore.getState().captureWeight(200, 0.1) // amount = 20.00
    useSaleStore.getState().setAmountReceived(20)
    expect(useSaleStore.getState().change).toBe(0)
  })
})

describe('saleStore.reset', () => {
  it('limpa todos os campos após reset', () => {
    useSaleStore.getState().captureWeight(345, 0.065)
    useSaleStore.getState().setPaymentMethod('cash')
    useSaleStore.getState().setAmountReceived(50)
    useSaleStore.getState().reset()

    const state = useSaleStore.getState()
    expect(state.capturedWeightGrams).toBeNull()
    expect(state.pricePerGram).toBeNull()
    expect(state.amount).toBeNull()
    expect(state.paymentMethod).toBeNull()
    expect(state.amountReceived).toBeNull()
    expect(state.change).toBeNull()
  })
})
