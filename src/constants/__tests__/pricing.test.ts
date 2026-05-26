import { describe, it, expect } from 'vitest'
import { CASQUINHA_PRICE, calcSaleAmount } from '@/constants/pricing'

describe('CASQUINHA_PRICE', () => {
  it('é R$ 1,00 (fixo, hardcoded por decisão de produto)', () => {
    expect(CASQUINHA_PRICE).toBe(1.0)
  })
})

describe('calcSaleAmount', () => {
  it('sem casquinha: 300g × R$0,07/g = R$21,00', () => {
    expect(calcSaleAmount(300, 0.07, false)).toBe(21.0)
  })

  it('com casquinha: 300g × R$0,07/g + R$1,00 = R$22,00', () => {
    expect(calcSaleAmount(300, 0.07, true)).toBe(22.0)
  })

  it('peso 0 com casquinha = R$1,00 (apenas o adicional)', () => {
    expect(calcSaleAmount(0, 0.07, true)).toBe(1.0)
  })

  it('peso 0 sem casquinha = R$0,00', () => {
    expect(calcSaleAmount(0, 0.07, false)).toBe(0)
  })

  it('arredonda para 2 casas decimais (345g × R$0,065/g = R$22,43)', () => {
    expect(calcSaleAmount(345, 0.065, false)).toBe(22.43)
  })

  it('arredonda para 2 casas decimais com casquinha (345g × R$0,065/g + R$1,00 = R$23,43)', () => {
    expect(calcSaleAmount(345, 0.065, true)).toBe(23.43)
  })

  it('cobre o caso 150g × R$0,065/g com casquinha (R$9,75 + R$1,00 = R$10,75)', () => {
    expect(calcSaleAmount(150, 0.065, true)).toBe(10.75)
  })
})
