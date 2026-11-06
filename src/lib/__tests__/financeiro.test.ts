import { describe, expect, it } from 'vitest'
import {
  baldesDoGrafico,
  entradasPorItem,
  intervalo,
  moverData,
  porCategoria,
  resumoPorBalde,
  totaisDoIntervalo,
  type Purchase,
} from '../financeiro'

const compra = (o: Partial<Purchase>): Purchase => ({
  id: '1', purchase_date: '2026-11-03', category: 'Açaí', item: 'Polpa', quantity: 10, unit: 'L',
  amount: 100, supplier: null, ...o,
})

describe('financeiro', () => {
  it('separa por mês e calcula o saldo sem erro de float', () => {
    const r = resumoPorBalde(
      ['2026-10', '2026-11'],
      [{ sale_date: '2026-11-01', total_amount: '0.10' }, { sale_date: '2026-11-02', total_amount: 0.2 }],
      [compra({ amount: 0.1 }), compra({ purchase_date: '2026-10-31', amount: 5 })]
    )
    expect(r).toEqual([
      { balde: '2026-10', vendas: 0, compras: 5, saldo: -5 },
      { balde: '2026-11', vendas: 0.3, compras: 0.1, saldo: 0.2 },
    ])
  })

  it('o mesmo cálculo funciona por dia', () => {
    const r = resumoPorBalde(['2026-11-03'], [{ sale_date: '2026-11-03', total_amount: 10 }], [compra({ amount: 4 })])
    expect(r[0]).toMatchObject({ vendas: 10, compras: 4, saldo: 6 })
  })

  it('totaliza só o que está dentro do intervalo, com as duas pontas', () => {
    const t = totaisDoIntervalo(
      { de: '2026-11-02', ate: '2026-11-08' },
      [
        { sale_date: '2026-11-01', total_amount: 1 },
        { sale_date: '2026-11-02', total_amount: 2 },
        { sale_date: '2026-11-08', total_amount: 4 },
        { sale_date: '2026-11-09', total_amount: 8 },
      ],
      [compra({ purchase_date: '2026-11-08', amount: 1 }), compra({ purchase_date: '2026-11-09', amount: 50 })]
    )
    expect(t).toEqual({ vendas: 6, compras: 1, saldo: 5 })
  })

  it('calcula dia, semana (segunda a domingo) e mês', () => {
    expect(intervalo('dia', '2026-11-06')).toEqual({ de: '2026-11-06', ate: '2026-11-06' })
    expect(intervalo('semana', '2026-11-08')).toEqual({ de: '2026-11-02', ate: '2026-11-08' })
    expect(intervalo('mes', '2026-02-10')).toEqual({ de: '2026-02-01', ate: '2026-02-28' })
  })

  it('anda um dia, uma semana ou um mês', () => {
    expect(moverData('dia', '2026-11-01', -1)).toBe('2026-10-31')
    expect(moverData('semana', '2026-11-06', 1)).toBe('2026-11-13')
    expect(moverData('mes', '2026-01-31', 1)).toBe('2026-02-28')
  })

  it('escolhe os baldes do gráfico conforme a visão', () => {
    expect(baldesDoGrafico('mes', { de: '2026-11-01', ate: '2026-11-30' })[0]).toBe('2026-06')
    expect(baldesDoGrafico('semana', { de: '2026-11-02', ate: '2026-11-08' })).toHaveLength(7)
    expect(baldesDoGrafico('dia', { de: '2026-11-06', ate: '2026-11-06' })).toHaveLength(7)
    expect(baldesDoGrafico('periodo', { de: '2026-11-01', ate: '2026-11-03' })).toEqual([
      '2026-11-01', '2026-11-02', '2026-11-03',
    ])
    expect(baldesDoGrafico('periodo', { de: '2026-01-15', ate: '2026-11-03' })).toHaveLength(11)
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
