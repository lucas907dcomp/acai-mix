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

// --- preço da casquinha por loja (19/08/2026) ---
//
// Nasceu fixo em R$ 1,00 com uma loja só. A AçaiMix Barra cobra R$ 2,00.
// Como este número entra no valor cobrado do cliente, as duas pontas ficam
// fixadas em teste: o default não pode mudar sozinho, e o preço da loja tem
// que chegar até o total.
describe('calcSaleAmount com preço de casquinha por loja', () => {
  it('sem o 4º argumento, cobra R$ 1,00 — como era antes', () => {
    expect(calcSaleAmount(300, 0.07, true)).toBe(22.0)
  })

  it('loja de R$ 2,00: 300g × R$0,07/g + R$2,00 = R$23,00', () => {
    expect(calcSaleAmount(300, 0.07, true, 2.0)).toBe(23.0)
  })

  it('o preço da casquinha não afeta venda sem casquinha', () => {
    expect(calcSaleAmount(300, 0.07, false, 2.0)).toBe(21.0)
    expect(calcSaleAmount(300, 0.07, false, 1.0)).toBe(21.0)
  })

  it('peso 0 com casquinha de R$ 2,00 = R$ 2,00', () => {
    expect(calcSaleAmount(0, 0.07, true, 2.0)).toBe(2.0)
  })

  it('preço quebrado não estraga o arredondamento (345g × 0,065 + 2,50)', () => {
    expect(calcSaleAmount(345, 0.065, true, 2.5)).toBe(24.93)
  })
})
