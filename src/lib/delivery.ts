import type { Conta } from '@/lib/imprimirConta'
import type { CombinedOrderUnitItem } from '@/stores/combinedOrderStore'

export type StatusDelivery = 'novo' | 'preparo' | 'saiu' | 'entregue' | 'cancelado'

export interface ItemDelivery {
  nome: string
  tamanho: string
  qtd: number
  preco: number
  obs?: string | null
}

export interface PedidoDelivery {
  id: string
  numero: number
  cliente_nome: string
  cliente_telefone: string
  endereco: string
  itens: ItemDelivery[]
  total: number
  pagamento: string
  troco_para: number | null
  observacao: string | null
  status: StatusDelivery
  created_at: string
}

/** Próximo passo de cada status: o botão principal do cartão. */
export const PROXIMO: Partial<Record<StatusDelivery, StatusDelivery>> = {
  novo: 'preparo',
  preparo: 'saiu',
  saiu: 'entregue',
}

export const descreverItemDelivery = (i: ItemDelivery) =>
  `${i.nome} ${i.tamanho}${i.obs ? ` (${i.obs})` : ''}`

export function contaDoDelivery(p: PedidoDelivery, loja: string): Conta {
  const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  const itens: CombinedOrderUnitItem[] = p.itens.map((i, k) => ({
    id: String(k),
    type: 'unit',
    product_id: '',
    product_name: descreverItemDelivery(i),
    quantity: i.qtd,
    unit_price: i.preco,
    amount: Math.round(i.qtd * i.preco * 100) / 100,
  }))
  const pagamento =
    p.pagamento === 'Dinheiro' && p.troco_para ? `Dinheiro, troco para ${brl(p.troco_para)}` : p.pagamento
  return {
    loja,
    mesa: `DELIVERY #${p.numero}`,
    itens,
    total: p.total,
    quando: new Date(p.created_at),
    extras: [
      `Cliente: ${p.cliente_nome}`,
      `Tel: ${p.cliente_telefone}`,
      `End: ${p.endereco}`,
      `Pagamento: ${pagamento}`,
      ...(p.observacao ? [`Obs: ${p.observacao}`] : []),
    ],
  }
}
