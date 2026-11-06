import { describe, expect, it } from 'vitest'
import { descreverItem, htmlConta } from '../imprimirConta'
import type { CombinedOrderItem } from '@/stores/combinedOrderStore'

const acai: CombinedOrderItem = {
  id: '1', type: 'weight', weight_grams: 350.4, price_per_gram: 0.06, has_casquinha: true, amount: 22,
}
const agua: CombinedOrderItem = {
  id: '2', type: 'unit', product_id: 'p', product_name: 'Água <gelada>', quantity: 2, unit_price: 3, amount: 6,
}

describe('conta impressa', () => {
  it('descreve peso e unidade', () => {
    expect(descreverItem(acai)).toBe('Açaí 350 g + casquinha')
    expect(descreverItem(agua)).toBe('2x Água <gelada>')
  })

  it('lista cada item, o total e não deixa nome de produto virar HTML', () => {
    const html = htmlConta({ loja: 'Loja', mesa: 'Mesa 2', itens: [acai, agua], total: 28, quando: new Date() })
    expect(html).toContain('Açaí 350 g + casquinha')
    expect(html).toContain('2x Água &#60;gelada&#62;')
    expect(html).not.toContain('<gelada>')
    expect(html).toMatch(/TOTAL<\/td><td class="v">R\$\s28,00/)
  })
})
