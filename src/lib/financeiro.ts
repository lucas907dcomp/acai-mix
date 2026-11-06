import {
  addDays,
  addMonths,
  eachDayOfInterval,
  eachMonthOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  parseISO,
  startOfMonth,
  startOfWeek,
  subDays,
  subMonths,
} from 'date-fns'

export type Visao = 'dia' | 'semana' | 'mes' | 'periodo'

export interface Intervalo {
  de: string // yyyy-MM-dd
  ate: string
}

const dia = (d: Date) => format(d, 'yyyy-MM-dd')
const semana = { weekStartsOn: 1 } as const

export function intervalo(visao: Exclude<Visao, 'periodo'>, ref: string): Intervalo {
  const d = parseISO(ref)
  if (visao === 'dia') return { de: ref, ate: ref }
  if (visao === 'semana') return { de: dia(startOfWeek(d, semana)), ate: dia(endOfWeek(d, semana)) }
  return { de: dia(startOfMonth(d)), ate: dia(endOfMonth(d)) }
}

export function moverData(visao: Exclude<Visao, 'periodo'>, ref: string, passo: number): string {
  const d = parseISO(ref)
  if (visao === 'dia') return dia(addDays(d, passo))
  if (visao === 'semana') return dia(addDays(d, passo * 7))
  return dia(addMonths(d, passo))
}

/** Colunas do gráfico: yyyy-MM (mês) ou yyyy-MM-dd (dia). */
export function baldesDoGrafico(visao: Visao, { de, ate }: Intervalo): string[] {
  const inicio = parseISO(de)
  const fim = parseISO(ate)
  const porDia = (a: Date, b: Date) => eachDayOfInterval({ start: a, end: b }).map(dia)
  const porMes = (a: Date, b: Date) =>
    eachMonthOfInterval({ start: a, end: b }).map((d) => format(d, 'yyyy-MM'))

  if (visao === 'mes') return porMes(subMonths(inicio, 5), inicio)
  if (visao === 'dia') return porDia(subDays(inicio, 6), inicio)
  if (visao === 'semana') return porDia(inicio, fim)
  // Mais de 31 colunas por dia fica ilegível; aí o gráfico vira por mês.
  return porDia(inicio, fim).length <= 31 ? porDia(inicio, fim) : porMes(inicio, fim)
}

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

export interface BaldeResumo {
  balde: string // yyyy-MM ou yyyy-MM-dd
  vendas: number
  compras: number
  saldo: number
}

const centavos = (v: number | string) => Math.round(Number(v) * 100)

/** Soma vendas (daily_summary) e compras por balde, em centavos para não acumular erro de float. */
export function resumoPorBalde(
  baldes: string[],
  vendasDia: { sale_date: string; total_amount: number | string }[],
  compras: Pick<Purchase, 'purchase_date' | 'amount'>[]
): BaldeResumo[] {
  return baldes.map((balde) => {
    const v = vendasDia
      .filter((d) => d.sale_date.startsWith(balde))
      .reduce((s, d) => s + centavos(d.total_amount), 0)
    const c = compras
      .filter((p) => p.purchase_date.startsWith(balde))
      .reduce((s, p) => s + centavos(p.amount), 0)
    return { balde, vendas: v / 100, compras: c / 100, saldo: (v - c) / 100 }
  })
}

export const dentroDe = (data: string, { de, ate }: Intervalo) => data >= de && data <= ate

export function totaisDoIntervalo(
  periodo: Intervalo,
  vendasDia: { sale_date: string; total_amount: number | string }[],
  compras: Pick<Purchase, 'purchase_date' | 'amount'>[]
) {
  const v = vendasDia
    .filter((d) => dentroDe(d.sale_date, periodo))
    .reduce((s, d) => s + centavos(d.total_amount), 0)
  const c = compras
    .filter((p) => dentroDe(p.purchase_date, periodo))
    .reduce((s, p) => s + centavos(p.amount), 0)
  return { vendas: v / 100, compras: c / 100, saldo: (v - c) / 100 }
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
