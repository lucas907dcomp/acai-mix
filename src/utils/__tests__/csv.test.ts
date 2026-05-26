import { describe, it, expect } from 'vitest'
import { buildCsvString } from '../csv'
import type { SaleWithProduct } from '@/types'

function makeSale(overrides: Partial<SaleWithProduct> = {}): SaleWithProduct {
  return {
    id: 'abc',
    shift_id: 's1',
    location_id: 'l1',
    weight_grams: 500,
    weight_source: 'scale',
    price_per_gram: 0.055,
    amount: 27.5,
    payment_method: 'pix',
    amount_received: null,
    change_returned: null,
    sync_reconciled: false,
    synced_at: null,
    created_offline: false,
    created_at: '2026-05-20T14:32:00.000Z',
    status: 'COMPLETED',
    cancelled_at: null,
    cancelled_by: null,
    has_casquinha: false,
    quantity: 1,
    products: { name: 'Açaí', product_type: 'weight' },
    ...overrides,
  }
}

describe('buildCsvString', () => {
  it('inicia com BOM UTF-8', () => {
    const csv = buildCsvString([])
    expect(csv.startsWith('﻿')).toBe(true)
  })

  it('cabeçalho usa separador ponto-e-vírgula', () => {
    const csv = buildCsvString([])
    const header = csv.split('\n')[0]
    expect(header).toBe('﻿Data/Hora;Peso (g);Preço/g (R$);Valor (R$);Pagamento;Status;Produto;Tipo;Quantidade;Casquinha')
  })

  it('colunas legadas preservadas nas posições originais (sem reordenação)', () => {
    const csv = buildCsvString([makeSale()])
    const cols = csv.split('\n')[0].replace('﻿', '').split(';')
    expect(cols[0]).toBe('Data/Hora')
    expect(cols[1]).toBe('Peso (g)')
    expect(cols[2]).toBe('Preço/g (R$)')
    expect(cols[3]).toBe('Valor (R$)')
    expect(cols[4]).toBe('Pagamento')
    expect(cols[5]).toBe('Status')
    // novas colunas ao final
    expect(cols[6]).toBe('Produto')
    expect(cols[7]).toBe('Tipo')
    expect(cols[8]).toBe('Quantidade')
    expect(cols[9]).toBe('Casquinha')
  })

  it('produto e tipo aparecem nas colunas finais', () => {
    const csv = buildCsvString([makeSale({ products: { name: 'Açaí', product_type: 'weight' } })])
    expect(csv).toContain(';Açaí;por peso;1;NAO')
  })

  it('casquinha=true → SIM na coluna Casquinha', () => {
    const csv = buildCsvString([makeSale({ has_casquinha: true })])
    expect(csv).toContain(';SIM')
  })

  it('produto nulo → traço na coluna Produto', () => {
    const csv = buildCsvString([makeSale({ products: null })])
    expect(csv).toContain(';—;')
  })

  it('array vazio gera somente cabeçalho (1 linha)', () => {
    const csv = buildCsvString([])
    const lines = csv.split('\n').filter(Boolean)
    expect(lines).toHaveLength(1)
  })

  it('mapeamento pix → PIX', () => {
    const csv = buildCsvString([makeSale({ payment_method: 'pix' })])
    expect(csv).toContain(';PIX;')
  })

  it('mapeamento credit → CARTAO', () => {
    const csv = buildCsvString([makeSale({ payment_method: 'credit' })])
    expect(csv).toContain(';CARTAO;')
  })

  it('mapeamento debit → CARTAO', () => {
    const csv = buildCsvString([makeSale({ payment_method: 'debit' })])
    expect(csv).toContain(';CARTAO;')
  })

  it('mapeamento cash → DINHEIRO', () => {
    const csv = buildCsvString([makeSale({ payment_method: 'cash' })])
    expect(csv).toContain(';DINHEIRO;')
  })

  it('COMPLETED → ATIVA', () => {
    const csv = buildCsvString([makeSale({ status: 'COMPLETED' })])
    expect(csv).toContain(';ATIVA')
  })

  it('CANCELLED → CANCELADA', () => {
    const csv = buildCsvString([makeSale({ status: 'CANCELLED' })])
    expect(csv).toContain(';CANCELADA')
  })

  it('status undefined (pré-migration) → ATIVA', () => {
    const sale = makeSale()
    delete (sale as Partial<SaleWithProduct>).status
    const csv = buildCsvString([sale])
    expect(csv).toContain(';ATIVA')
  })

  it('valor decimal usa vírgula como separador (pt-BR)', () => {
    const csv = buildCsvString([makeSale({ amount: 27.5 })])
    expect(csv).toContain('27,50')
    expect(csv).not.toContain('27.50')
  })

  it('performance: 5000 linhas em < 500ms', () => {
    const sales = Array.from({ length: 5000 }, () => makeSale())
    const start = Date.now()
    buildCsvString(sales)
    expect(Date.now() - start).toBeLessThan(500)
  })
})
