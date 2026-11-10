// Textos da tela Delivery do PDV (separados do componente para editar sem mexer em código).
import type { StatusDelivery } from '@/lib/delivery'

export const colunas: { status: StatusDelivery; titulo: string; vazio: string }[] = [
  { status: 'novo', titulo: 'Novos', vazio: 'Nenhum pedido novo' },
  { status: 'preparo', titulo: 'Em preparo', vazio: 'Nada em preparo' },
  { status: 'saiu', titulo: 'Saiu para entrega', vazio: 'Nenhum na rua' },
]

export const botaoAvancar: Partial<Record<StatusDelivery, string>> = {
  novo: 'Aceitar e imprimir',
  preparo: 'Saiu para entrega',
  saiu: 'Entregue',
}

export const textos = {
  titulo: 'Delivery',
  subtitulo: 'Pedidos do WhatsApp. Chegou pedido, toca um aviso.',
  finalizados: 'Finalizados nas últimas 24 h',
  copiarEndereco: 'Copiar endereço',
  enderecoCopiado: 'Endereço copiado. Cole no Entrega Fácil do iFood.',
  imprimir: 'Imprimir',
  cancelar: 'Cancelar',
  confirmarCancelar: 'Confirmar cancelamento',
  novoPedido: (n: number) => `Novo pedido de delivery #${n}`,
}
