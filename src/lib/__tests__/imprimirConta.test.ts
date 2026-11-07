import { afterEach, describe, expect, it, vi } from 'vitest'
import { bytesConta, descreverItem, htmlConta, imprimirConta } from '../imprimirConta'
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

const SPP = '00001101-0000-1000-8000-00805f9b34fb'
const conta = { loja: 'Açaí da Praça', mesa: 'Família Silva', itens: [acai, agua], total: 28, quando: new Date(2026, 10, 6, 20, 5) }
const texto = (b: Uint8Array) => Array.from(b, (c) => String.fromCharCode(c)).join('')

describe('conta na impressora térmica', () => {
  it('sai em 32 colunas, sem acento, com item e total', () => {
    const b = bytesConta({ ...conta, itens: [...conta.itens, { ...agua, product_name: 'Combo família com nome bem comprido demais' }] })
    expect([...b.slice(0, 2)]).toEqual([0x1b, 0x40])
    expect(b.every((c) => c < 0x80)).toBe(true)
    const linhas = texto(b).replace(new RegExp(`${String.fromCharCode(0x1b)}(@|a.|E.|d.)`, 'g'), '').split('\n')
    expect(linhas.every((l) => l.length <= 32)).toBe(true)
    expect(linhas).toContain('Acai 350 g + casquinha  R$ 22,00')
    expect(linhas.some((l) => /^TOTAL +R\$ 28,00$/.test(l))).toBe(true)
  })
})

describe('imprimir pela porta Bluetooth', () => {
  afterEach(() => vi.unstubAllGlobals())

  function porta(info: SerialPortInfo) {
    const escrito: Uint8Array[] = []
    return {
      escrito,
      getInfo: () => info,
      open: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
      writable: { getWriter: () => ({ write: async (b: Uint8Array) => { escrito.push(b) }, close: async () => {} }) },
    }
  }
  const usar = (serial: object) => {
    vi.stubGlobal('navigator', { serial })
    vi.stubGlobal('document', { activeElement: null })
    vi.stubGlobal('HTMLElement', class {})
  }

  it('escreve na impressora e nunca na porta da balança', async () => {
    const balanca = porta({ usbVendorId: 1 }), impressora = porta({ bluetoothServiceClassId: SPP })
    usar({ getPorts: async () => [balanca, impressora], requestPort: vi.fn() })
    await imprimirConta(conta)
    expect(impressora.escrito).toHaveLength(1)
    expect(impressora.close).toHaveBeenCalled()
    expect(balanca.open).not.toHaveBeenCalled()
  })

  it('pede a impressora só por Bluetooth, e cancelar não é erro', async () => {
    const requestPort = vi.fn().mockRejectedValue(new DOMException('x', 'NotFoundError'))
    usar({ getPorts: async () => [], requestPort })
    await expect(imprimirConta(conta)).resolves.toBeUndefined()
    expect(requestPort).toHaveBeenCalledWith({ filters: [{ bluetoothServiceClassId: SPP }] })
  })

  it('impressora desligada vira erro e libera a próxima tentativa', async () => {
    const off = porta({ bluetoothServiceClassId: SPP })
    off.open.mockRejectedValueOnce(new Error('sem conexao'))
    usar({ getPorts: async () => [off], requestPort: vi.fn() })
    await expect(imprimirConta(conta)).rejects.toThrow()
    await imprimirConta(conta)
    expect(off.escrito).toHaveLength(1)
  })
})
