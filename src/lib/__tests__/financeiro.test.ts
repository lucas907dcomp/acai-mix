import { describe, expect, it } from 'vitest'
import { entradasPorItem, porCategoria, resumoPorMes, type Purchase } from '../financeiro'

const compra = (o: Partial<Purchase>): Purchase => ({
  id: '1', purchase_date: '2026-11-03', category: 'Açaí', item: 'Polpa', quantity: 10, unit: 'L',
  amount: 100, supplier: null, ...o,
})

describe('financeiro', () => {
  it('separa por mês e calcula o saldo sem erro de float', () => {
    const r = resumoPorMes(
      ['2026-10', '2026-11'],
      [{ sale_date: '2026-11-01', total_amount: '0.10' }, { sale_date: '2026-11-02', total_amount: 0.2 }],
      [compra({ amount: 0.1 }), compra({ purchase_date: '2026-10-31', amount: 5 })]
    )
    expect(r).toEqual([
      { mes: '2026-10', vendas: 0, compras: 5, saldo: -5 },
      { mes: '2026-11', vendas: 0.3, compras: 0.1, saldo: 0.2 },
    ])
  })

  it('soma o mesmo produto ignorando maiúscula, mas não mistura unidades', () => {
    const r = entradasPorItem([
      compra({ item: 'Polpa ' }),
      compra({ item: 'polpa', quantity: 5, amount: 50 }),
      compra({ unit: 'kg', amount: 10 }),
    ])
    expect(r).toEqual([
      { item: 'Polpa', unit: 'L', quantidade: 15, total: 150 },
      { item: 'Polpa', unit: 'kg', quantidade: 10, total: 10 },
    ])
  })

  it('ordena categorias do maior gasto para o menor', () => {
    const r = porCategoria([compra({ category: 'Sorvete', amount: 5 }), compra({ amount: 7 })])
    expect(r.map((c) => c.categoria)).toEqual(['Açaí', 'Sorvete'])
  })
})
