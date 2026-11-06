import type { CombinedOrderItem } from '@/stores/combinedOrderStore'

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

const escapar = (s: string) =>
  s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

export function descreverItem(item: CombinedOrderItem): string {
  if (item.type === 'weight') {
    return `Açaí ${Math.round(item.weight_grams)} g${item.has_casquinha ? ' + casquinha' : ''}`
  }
  return `${item.quantity}x ${item.product_name}`
}

interface Conta {
  loja: string
  mesa: string
  itens: CombinedOrderItem[]
  total: number
  quando: Date
}

/** Largura útil da bobina de 80 mm. Bobina de 58 mm: trocar para 48mm. */
const LARGURA = '72mm'

export function htmlConta({ loja, mesa, itens, total, quando }: Conta): string {
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
<table>${linhas}<tr class="t"><td>TOTAL</td><td class="v">${brl.format(total)}</td></tr></table>
<p>Conta para conferência</p>
<p>Sem valor fiscal</p>
</body></html>`
}

/** Imprime por um iframe invisível: o CSS do app não interfere no papel. */
export function imprimirConta(conta: Conta) {
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
