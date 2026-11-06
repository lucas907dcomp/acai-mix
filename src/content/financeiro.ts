// Estoque / Financeiro (esboço, 06/11/2026). Listas e textos moram aqui para
// editar sem mexer na página.

export const CATEGORIAS = ['Açaí', 'Sorvete', 'Picolé', 'Complementos', 'Embalagens', 'Bebidas', 'Outros'] as const

export const UNIDADES = ['L', 'kg', 'un', 'cx', 'pct'] as const

export const textos = {
  titulo: 'Estoque / Financeiro',
  botaoLancar: 'Lançar compra',
  vendas: 'Vendas',
  vendasSub: 'do caixa (PDV)',
  compras: 'Compras',
  comprasSub: 'lançadas no mês',
  saldo: 'Saldo do mês',
  saldoSub: 'vendas menos compras',
  grafico: 'Vendas × compras, últimos 6 meses',
  porCategoria: 'Compras por categoria',
  entrouNoEstoque: 'O que entrou no estoque no mês',
  lancamentos: 'Lançamentos do mês',
  vazio: 'Nenhuma compra lançada neste mês.',
}
