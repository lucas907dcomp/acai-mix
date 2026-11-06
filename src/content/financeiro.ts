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
  comprasSub: 'lançadas no período',
  saldo: 'Saldo do período',
  saldoSub: 'vendas menos compras',
  grafico: { dia: 'Vendas × compras, últimos 7 dias', semana: 'Vendas × compras da semana', mes: 'Vendas × compras, últimos 6 meses', periodo: 'Vendas × compras do período' },
  porCategoria: 'Compras por categoria',
  totalPorProduto: 'Total comprado por produto',
  lancamentos: 'Lançamentos do período',
  vazio: 'Nenhuma compra lançada neste período.',
  visoes: [
    { valor: 'dia', rotulo: 'Dia' },
    { valor: 'semana', rotulo: 'Semana' },
    { valor: 'mes', rotulo: 'Mês' },
    { valor: 'periodo', rotulo: 'Período' },
  ],
}
