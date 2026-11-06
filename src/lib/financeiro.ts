export interface Purchase {
  id: string
  purchase_date: string
  category: string
  item: string
  quantity: number | null
  unit: string | null
  amount: number
  supplier: string | null
}

export interface MesResumo {
  mes: string // yyyy-MM
  vendas: number
  compras: number
  saldo: number
}

const centavos = (v: number | string) => Math.round(Number(v) * 100)

/** Soma vendas (daily_summary) e compras por mês, em centavos para não acumular erro de float. */
export function resumoPorMes(
  meses: string[],
  vendasDia: { sale_date: string; total_amount: number | string }[],
  compras: Pick<Purchase, 'purchase_date' | 'amount'>[]
): MesResumo[] {
  return meses.map((mes) => {
    const v = vendasDia
      .filter((d) => d.sale_date.startsWith(mes))
      .reduce((s, d) => s + centavos(d.total_amount), 0)
    const c = compras
      .filter((p) => p.purchase_date.startsWith(mes))
      .reduce((s, p) => s + centavos(p.amount), 0)
    return { mes, vendas: v / 100, compras: c / 100, saldo: (v - c) / 100 }
  })
}

export function porCategoria(compras: Purchase[]) {
  const mapa = new Map<string, number>()
  for (const p of compras) mapa.set(p.category, (mapa.get(p.category) ?? 0) + centavos(p.amount))
  return [...mapa]
    .map(([categoria, c]) => ({ categoria, total: c / 100 }))
    .sort((a, b) => b.total - a.total)
}

/** Agrupa o mesmo produto na mesma unidade: "Açaí" em L não soma com "Açaí" em kg. */
export function entradasPorItem(compras: Purchase[]) {
  const mapa = new Map<string, { item: string; unit: string | null; quantidade: number; c: number }>()
  for (const p of compras) {
    const chave = `${p.item.trim().toLowerCase()}|${p.unit ?? ''}`
    const atual = mapa.get(chave) ?? { item: p.item.trim(), unit: p.unit, quantidade: 0, c: 0 }
    atual.quantidade += Number(p.quantity ?? 0)
    atual.c += centavos(p.amount)
    mapa.set(chave, atual)
  }
  return [...mapa.values()]
    .map(({ c, ...r }) => ({ ...r, total: c / 100 }))
    .sort((a, b) => b.total - a.total)
}
