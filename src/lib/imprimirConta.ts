import type { CombinedOrderItem } from '@/stores/combinedOrderStore'
import type { SaleWithProduct } from '@/types'

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

const escapar = (s: string) =>
  s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

export function descreverItem(item: CombinedOrderItem): string {
  if (item.type === 'weight') {
    return `Açaí ${Math.round(item.weight_grams)} g${item.has_casquinha ? ' + casquinha' : ''}`
  }
  return `${item.quantity}x ${item.product_name}`
}

export interface Conta {
  loja: string
  mesa: string
  itens: CombinedOrderItem[]
  total: number
  quando: Date
  /** Linhas soltas abaixo do cabeçalho (delivery: cliente, endereço, pagamento). */
  extras?: string[]
}

/** Largura útil da bobina de 58 mm (Knup KP-1025). Bobina de 80 mm: 72mm. */
const LARGURA = '48mm'
/** Colunas da fonte padrão em 58 mm. Bobina de 80 mm: 48. */
const COLUNAS = 32
/** Serial Port Profile: o que a impressora Bluetooth expõe depois de pareada. */
const SPP = '00001101-0000-1000-8000-00805f9b34fb'

const ESC = 0x1b

// ponytail: sem acento, porque a tabela de caracteres muda de impressora para
// impressora. Para ter acento: testar ESC t na bobina real ou mandar imagem.
const ascii = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\u00a0/g, ' ').replace(/[^\x20-\x7e]/g, '?')

function linhaComValor(texto: string, valor: string): string[] {
  const livre = COLUNAS - valor.length - 1
  const partes: string[] = []
  let resto = texto
  while (resto.length > livre) {
    partes.push(resto.slice(0, livre))
    resto = resto.slice(livre)
  }
  partes.push(`${resto.padEnd(livre)} ${valor}`)
  return partes
}

/** A conta em ESC/POS: é o que vai pela porta serial da impressora. */
export function bytesConta({ loja, mesa, itens, total, quando, extras = [] }: Conta): Uint8Array {
  const bytes: number[] = []
  const cmd = (...b: number[]) => bytes.push(...b)
  const txt = (s: string) => {
    for (const c of ascii(s)) bytes.push(c.charCodeAt(0))
    bytes.push(0x0a)
  }
  const data = quando.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

  cmd(ESC, 0x40) // reinicia
  cmd(ESC, 0x61, 1) // centraliza
  cmd(ESC, 0x45, 1) // negrito
  txt(loja)
  cmd(ESC, 0x45, 0)
  txt(mesa)
  txt(data)
  cmd(ESC, 0x61, 0)
  for (const e of extras) {
    let resto = ascii(e)
    while (resto.length > COLUNAS) {
      txt(resto.slice(0, COLUNAS))
      resto = resto.slice(COLUNAS)
    }
    txt(resto)
  }
  txt('-'.repeat(COLUNAS))
  for (const i of itens) linhaComValor(ascii(descreverItem(i)), ascii(brl.format(i.amount))).forEach(txt)
  txt('-'.repeat(COLUNAS))
  cmd(ESC, 0x45, 1)
  linhaComValor('TOTAL', ascii(brl.format(total))).forEach(txt)
  cmd(ESC, 0x45, 0)
  cmd(ESC, 0x61, 1)
  txt('Conta para conferencia')
  txt('Sem valor fiscal')
  // Avança até a serrilha com quebras de linha: a KP-1025 ignora ESC d.
  cmd(...new Array(2).fill(0x0a))
  return new Uint8Array(bytes)
}

export function htmlConta({ loja, mesa, itens, total, quando, extras = [] }: Conta): string {
  const linhas = itens
    .map(
      (i) =>
        `<tr><td>${escapar(descreverItem(i))}</td><td class="v">${brl.format(i.amount)}</td></tr>`
    )
    .join('')
  const data = quando.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Conta</title><style>
@page { margin: 0 }
* { color: #000; font-family: 'Courier New', monospace; font-weight: 700 }
body { width: ${LARGURA}; margin: 0 auto; padding: 2mm 0 8mm; font-size: 13px }
h1 { font-size: 16px; text-align: center; margin: 0 }
p { text-align: center; margin: 2px 0 }
table { width: 100%; border-collapse: collapse; margin: 6px 0 }
td { padding: 2px 0; vertical-align: top }
.v { text-align: right; white-space: nowrap; padding-left: 6px }
.t td { border-top: 1px dashed #000; font-size: 16px; padding-top: 5px }
</style></head><body>
<h1>${escapar(loja)}</h1>
<p>${escapar(mesa)}</p>
<p>${data}</p>
${extras.map((e) => `<p style="text-align:left">${escapar(e)}</p>`).join('')}
<table>${linhas}<tr class="t"><td>TOTAL</td><td class="v">${brl.format(total)}</td></tr></table>
<p>Conta para conferência</p>
<p>Sem valor fiscal</p>
</body></html>`
}

/** Sem Web Serial no navegador: iframe invisível, o CSS do app não interfere no papel. */
function imprimirPeloNavegador(conta: Conta) {
  const frame = document.createElement('iframe')
  frame.setAttribute('aria-hidden', 'true')
  frame.style.cssText = 'position:fixed;width:0;height:0;border:0'
  frame.srcdoc = htmlConta(conta)
  const antes = document.activeElement
  frame.onload = () => {
    frame.contentWindow?.print() // no Chrome, bloqueia até fechar a janela de impressão
    frame.remove()
    // Sem isso o foco fica perdido e os atalhos do pagamento param.
    if (antes instanceof HTMLElement) antes.focus()
  }
  document.body.appendChild(frame)
}

let imprimindo = false

/**
 * Manda direto para a impressora Bluetooth pareada, sem janela de impressão.
 * A 1ª vez o Chrome pede para escolher o aparelho; depois ele lembra. O filtro
 * por Bluetooth é o que impede de escrever na porta da balança.
 * Rejeita se a impressora não responder (desligada, fora de alcance).
 */
export async function imprimirConta(conta: Conta): Promise<void> {
  if (!('serial' in navigator)) return imprimirPeloNavegador(conta)
  if (imprimindo) return
  imprimindo = true
  const antes = document.activeElement
  try {
    const portas = await navigator.serial.getPorts()
    let porta = portas.find((p) => p.getInfo().bluetoothServiceClassId === SPP)
    if (!porta) {
      try {
        porta = await navigator.serial.requestPort({ filters: [{ bluetoothServiceClassId: SPP }] })
      } catch (e) {
        if (e instanceof DOMException && e.name === 'NotFoundError') return // fechou a escolha
        throw e
      }
    }
    await porta.open({ baudRate: 9600 })
    try {
      const writer = porta.writable!.getWriter()
      await writer.write(bytesConta(conta))
      await writer.close()
    } finally {
      await porta.close()
    }
  } finally {
    imprimindo = false
    if (antes instanceof HTMLElement) antes.focus()
  }
}

/** Venda já registrada (balcão ou pedido conjunto) no formato da conta impressa. */
export function contaDaVenda(v: SaleWithProduct, loja: string): Conta {
  const itens: CombinedOrderItem[] = v.combined_items?.length
    ? v.combined_items.map((i, k) => ({ ...i, id: String(k), product_id: i.product_id ?? undefined }) as CombinedOrderItem)
    : [
        v.products?.product_type === 'unit'
          ? { id: '0', type: 'unit', product_id: v.product_id ?? '', product_name: v.products.name, quantity: v.quantity ?? 1, unit_price: v.amount / (v.quantity ?? 1), amount: v.amount }
          : { id: '0', type: 'weight', weight_grams: v.weight_grams, price_per_gram: v.price_per_gram, has_casquinha: !!v.has_casquinha, amount: v.amount },
      ]
  return { loja, mesa: v.combined_order_name || 'Venda no balcao', itens, total: v.amount, quando: new Date(v.created_at) }
}
