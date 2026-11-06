import { useMemo, useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Plus, ShoppingBag, Trash2, TrendingUp, Wallet } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { useFinanceEnabled } from '@/hooks/useFinanceEnabled'
import { MetricCard } from '@/components/dashboard/MetricCard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  baldesDoGrafico,
  dentroDe,
  entradasPorItem,
  intervalo,
  moverData,
  porCategoria,
  resumoPorBalde,
  totaisDoIntervalo,
  type Intervalo,
  type Purchase,
  type Visao,
} from '@/lib/financeiro'
import { CATEGORIAS, UNIDADES, textos } from '@/content/financeiro'

const fmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const qtd = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 })
const campo =
  'w-full rounded-lg bg-[#0f0720] border border-[#2d1550] px-3 py-2 text-sm text-white placeholder:text-[#6b4f91] focus:outline-none focus:border-[#9d7bc8]'
const campoData = campo.replace('w-full', 'w-40')
const rotulo = 'block text-xs text-[#9d7bc8] mb-1'

const quando = (data: string, padrao: string) => format(parseISO(data), padrao, { locale: ptBR })

const nomeBalde = (b: string) => (b.length === 7 ? quando(`${b}-01`, 'MMM') : quando(b, 'dd/MM'))

function nomeIntervalo(visao: Visao, { de, ate }: Intervalo) {
  if (visao === 'dia') return quando(de, "dd/MM/yyyy")
  if (visao === 'mes') return quando(de, 'MMMM yyyy')
  return `${quando(de, 'dd/MM')} a ${quando(ate, 'dd/MM')}`
}

function useDadosFinanceiros(locationId: string, de: string, ate: string) {
  const compras = useQuery<Purchase[]>({
    queryKey: ['purchases', locationId, de, ate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('purchases')
        .select('id, purchase_date, category, item, quantity, unit, amount, supplier')
        .eq('location_id', locationId)
        .gte('purchase_date', de)
        .lte('purchase_date', ate)
        .order('purchase_date', { ascending: false })
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
    enabled: !!locationId,
  })

  const vendas = useQuery({
    queryKey: ['finance-sales', locationId, de, ate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('daily_summary')
        .select('sale_date, total_amount')
        .eq('location_id', locationId)
        .gte('sale_date', de)
        .lte('sale_date', ate)
      if (error) throw error
      return (data ?? []) as { sale_date: string; total_amount: number }[]
    },
    enabled: !!locationId,
  })

  return { compras, vendas }
}

function FormCompra({
  locationId,
  sugestoes,
  aoSalvar,
}: {
  locationId: string
  sugestoes: string[]
  aoSalvar: () => void
}) {
  const [categoria, setCategoria] = useState<string>(CATEGORIAS[0])
  const salvar = useMutation({
    mutationFn: async (f: FormData) => {
      const quantidade = f.get('quantity') as string
      const { error } = await supabase.from('purchases').insert({
        location_id: locationId,
        purchase_date: f.get('purchase_date') as string,
        category: categoria,
        item: (f.get('item') as string).trim(),
        quantity: quantidade ? Number(quantidade) : null,
        unit: quantidade ? (f.get('unit') as string) : null,
        amount: Number(f.get('amount')),
        supplier: (f.get('supplier') as string).trim() || null,
      })
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Compra lançada')
      aoSalvar()
    },
    onError: () => toast.error('Não consegui salvar. Tente de novo.'),
  })

  function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    salvar.mutate(new FormData(e.currentTarget))
  }

  return (
    <form onSubmit={enviar} className="space-y-4">
      <div>
        <span className={rotulo}>Categoria</span>
        <div className="flex flex-wrap gap-2">
          {CATEGORIAS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategoria(c)}
              aria-pressed={categoria === c}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                categoria === c
                  ? 'bg-[#4c1e8c] text-white'
                  : 'bg-[#0f0720] border border-[#2d1550] text-[#9d7bc8] hover:text-white'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className={rotulo} htmlFor="item">Produto</label>
        <input id="item" name="item" required maxLength={80} list="itens" className={campo} placeholder="Ex.: Polpa de açaí" />
        <datalist id="itens">
          {sugestoes.map((s) => <option key={s} value={s} />)}
        </datalist>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2">
          <label className={rotulo} htmlFor="quantity">Quantidade</label>
          <input id="quantity" name="quantity" type="number" min="0.001" step="any" className={campo} placeholder="Ex.: 50" />
        </div>
        <div>
          <label className={rotulo} htmlFor="unit">Unidade</label>
          <select id="unit" name="unit" className={campo}>
            {UNIDADES.map((u) => <option key={u}>{u}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={rotulo} htmlFor="amount">Valor total (R$)</label>
          <input id="amount" name="amount" type="number" min="0" step="0.01" required className={campo} placeholder="0,00" />
        </div>
        <div>
          <label className={rotulo} htmlFor="purchase_date">Data</label>
          <input id="purchase_date" name="purchase_date" type="date" required defaultValue={format(new Date(), 'yyyy-MM-dd')} className={campo} />
        </div>
      </div>
      <div>
        <label className={rotulo} htmlFor="supplier">Fornecedor (opcional)</label>
        <input id="supplier" name="supplier" maxLength={80} className={campo} />
      </div>
      <button
        type="submit"
        disabled={salvar.isPending}
        className="w-full rounded-lg bg-[#4c1e8c] hover:bg-[#5d2aa6] disabled:opacity-50 text-white text-sm font-medium py-2.5 transition-colors"
      >
        {salvar.isPending ? 'Salvando…' : 'Salvar compra'}
      </button>
    </form>
  )
}

export default function Financeiro() {
  const habilitado = useFinanceEnabled()
  const locationId = useAuthStore((s) => s.profile?.location_id) ?? ''
  const queryClient = useQueryClient()
  const hoje = format(new Date(), 'yyyy-MM-dd')
  const [visao, setVisao] = useState<Visao>('mes')
  const [ref, setRef] = useState(hoje)
  const [livre, setLivre] = useState<Intervalo>(() => intervalo('mes', hoje))
  const [lancando, setLancando] = useState(false)
  const [apagando, setApagando] = useState<string | null>(null)

  const periodo = useMemo(() => {
    if (visao !== 'periodo') return intervalo(visao, ref)
    // Datas invertidas no filtro: vale o intervalo entre elas.
    const [de, ate] = [livre.de, livre.ate].sort()
    return { de, ate }
  }, [visao, ref, livre])
  const baldes = useMemo(() => baldesDoGrafico(visao, periodo), [visao, periodo])

  // Busca o que o período e o gráfico precisam (o gráfico pode voltar mais).
  const inicioBusca = baldes[0].length === 7 ? `${baldes[0]}-01` : baldes[0]
  const { compras, vendas } = useDadosFinanceiros(
    locationId,
    inicioBusca < periodo.de ? inicioBusca : periodo.de,
    periodo.ate
  )

  const apagar = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('purchases').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['purchases', locationId] }),
    onError: () => toast.error('Não consegui excluir. Tente de novo.'),
  })

  if (habilitado === false) return <Navigate to="/pos" replace />

  const todas = compras.data ?? []
  const doPeriodo = todas.filter((p) => dentroDe(p.purchase_date, periodo))
  const resumo = resumoPorBalde(baldes, vendas.data ?? [], todas)
  const atual = totaisDoIntervalo(periodo, vendas.data ?? [], todas)
  const categorias = porCategoria(doPeriodo)
  const entradas = entradasPorItem(doPeriodo)
  const sugestoes = [...new Set(todas.map((p) => p.item))]
  const carregando = compras.isLoading || vendas.isLoading
  const andar = (passo: number) => {
    if (visao !== 'periodo') setRef(moverData(visao, ref, passo))
  }
  const trocarVisao = (nova: Visao) => {
    // Ao abrir o filtro de datas, começa no que já estava na tela.
    if (nova === 'periodo') setLivre(periodo)
    setVisao(nova)
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-white">{textos.titulo}</h1>
        <button
          onClick={() => setLancando(true)}
          className="flex items-center gap-2 rounded-lg bg-[#4c1e8c] hover:bg-[#5d2aa6] text-white text-sm font-medium px-4 py-2 transition-colors"
        >
          <Plus className="w-4 h-4" />
          {textos.botaoLancar}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 bg-[#1a0b2e] border border-[#2d1550] rounded-lg p-1 w-fit">
          {textos.visoes.map((v) => (
            <button
              key={v.valor}
              onClick={() => trocarVisao(v.valor as Visao)}
              aria-pressed={visao === v.valor}
              className={`px-4 py-1.5 text-sm rounded-md transition-colors ${
                visao === v.valor
                  ? 'bg-[#4c1e8c] text-white font-medium'
                  : 'text-[#9d7bc8] hover:text-white hover:bg-[#2d1550]'
              }`}
            >
              {v.rotulo}
            </button>
          ))}
        </div>

        {visao === 'periodo' ? (
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              aria-label="Data inicial"
              value={livre.de}
              onChange={(e) => e.target.value && setLivre({ ...livre, de: e.target.value })}
              className={campoData}
            />
            <span className="text-sm text-[#9d7bc8]">até</span>
            <input
              type="date"
              aria-label="Data final"
              value={livre.ate}
              onChange={(e) => e.target.value && setLivre({ ...livre, ate: e.target.value })}
              className={campoData}
            />
          </div>
        ) : (
          <div className="flex items-center gap-1 bg-[#1a0b2e] border border-[#2d1550] rounded-lg p-1">
            <button onClick={() => andar(-1)} aria-label="Anterior" className="p-1.5 rounded-md text-[#9d7bc8] hover:text-white hover:bg-[#2d1550]">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm text-white w-36 text-center first-letter:uppercase">{nomeIntervalo(visao, periodo)}</span>
            <button onClick={() => andar(1)} aria-label="Próximo" className="p-1.5 rounded-md text-[#9d7bc8] hover:text-white hover:bg-[#2d1550]">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard title={textos.vendas} value={fmt.format(atual.vendas)} subtitle={textos.vendasSub} icon={<TrendingUp className="w-4 h-4" />} isLoading={carregando} />
        <MetricCard title={textos.compras} value={fmt.format(atual.compras)} subtitle={textos.comprasSub} icon={<ShoppingBag className="w-4 h-4" />} isLoading={carregando} />
        <MetricCard title={textos.saldo} value={fmt.format(atual.saldo)} subtitle={textos.saldoSub} icon={<Wallet className="w-4 h-4" />} isLoading={carregando} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="bg-[#1a0b2e] border-[#2d1550] lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-[#9d7bc8]">{textos.grafico[visao]}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={resumo.map((r) => ({ ...r, nome: nomeBalde(r.balde) }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2d1550" vertical={false} />
                <XAxis dataKey="nome" tick={{ fill: '#9d7bc8', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#9d7bc8', fontSize: 12 }} axisLine={false} tickLine={false} width={80} tickFormatter={(v: number) => fmt.format(v).replace(/,00$/, '')} />
                <Tooltip
                  cursor={{ fill: '#2d1550', opacity: 0.4 }}
                  contentStyle={{ background: '#1a0b2e', border: '1px solid #2d1550', borderRadius: 8 }}
                  labelStyle={{ color: '#9d7bc8' }}
                  formatter={(v) => fmt.format(Number(v))}
                />
                <Legend wrapperStyle={{ fontSize: 12, color: '#9d7bc8' }} />
                <Bar dataKey="vendas" name={textos.vendas} fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="compras" name={textos.compras} fill="#F7D417" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="bg-[#1a0b2e] border-[#2d1550]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-[#9d7bc8]">{textos.porCategoria}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {categorias.length === 0 && <p className="text-sm text-[#9d7bc8]">{textos.vazio}</p>}
            {categorias.map((c) => (
              <div key={c.categoria}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-white">{c.categoria}</span>
                  <span className="text-[#9d7bc8]">{fmt.format(c.total)}</span>
                </div>
                <div className="h-1.5 rounded-full bg-[#2d1550]">
                  <div className="h-full rounded-full bg-[#F7D417]" style={{ width: `${atual.compras ? (c.total / atual.compras) * 100 : 0}%` }} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="bg-[#1a0b2e] border-[#2d1550]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-[#9d7bc8]">{textos.totalPorProduto}</CardTitle>
          </CardHeader>
          <CardContent className="divide-y divide-[#2d1550]">
            {entradas.length === 0 && <p className="text-sm text-[#9d7bc8]">{textos.vazio}</p>}
            {entradas.map((e) => (
              <div key={`${e.item}|${e.unit}`} className="flex justify-between py-2 text-sm">
                <span className="text-white truncate pr-3">{e.item}</span>
                <span className="text-[#9d7bc8] whitespace-nowrap">
                  {e.unit ? `${qtd.format(e.quantidade)} ${e.unit}` : fmt.format(e.total)}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="bg-[#1a0b2e] border-[#2d1550] lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-[#9d7bc8]">{textos.lancamentos}</CardTitle>
          </CardHeader>
          <CardContent className="divide-y divide-[#2d1550]">
            {doPeriodo.length === 0 && <p className="text-sm text-[#9d7bc8]">{textos.vazio}</p>}
            {doPeriodo.map((p) => (
              <div key={p.id} className="flex items-center gap-3 py-2.5 text-sm">
                <span className="text-[#9d7bc8] w-12 flex-shrink-0">{format(parseISO(p.purchase_date), 'dd/MM')}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-white truncate">{p.item}</p>
                  <p className="text-xs text-[#9d7bc8] truncate">
                    {[p.category, p.quantity ? `${qtd.format(p.quantity)} ${p.unit}` : null, p.supplier].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <span className="text-white font-medium whitespace-nowrap">{fmt.format(p.amount)}</span>
                {apagando === p.id ? (
                  <button
                    onClick={() => {
                      apagar.mutate(p.id)
                      setApagando(null)
                    }}
                    onBlur={() => setApagando(null)}
                    autoFocus
                    className="text-xs text-red-400 hover:text-red-300 px-1"
                  >
                    Confirmar
                  </button>
                ) : (
                  <button onClick={() => setApagando(p.id)} aria-label={`Excluir ${p.item}`} className="text-[#9d7bc8] hover:text-red-400 p-1">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Dialog open={lancando} onOpenChange={setLancando}>
        <DialogContent className="bg-[#1a0b2e] border-[#2d1550] text-white">
          <DialogHeader>
            <DialogTitle>{textos.botaoLancar}</DialogTitle>
            <DialogDescription className="text-[#9d7bc8]">Mercadoria que entrou na loja.</DialogDescription>
          </DialogHeader>
          <FormCompra
            locationId={locationId}
            sugestoes={sugestoes}
            aoSalvar={() => {
              setLancando(false)
              queryClient.invalidateQueries({ queryKey: ['purchases', locationId] })
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}
