import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useParams } from 'react-router-dom'
import { Bike, ChevronDown, Minus, MessageCircle, Plus, ShoppingBag, Trash2, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'

// Cardápio virtual por loja: /cardapio/<id da loja>. Lê o cardápio e a vitrine
// do banco; o pedido vira mensagem no WhatsApp da loja, onde a IA confere o
// preço no código e confirma.

const DEMO = 'de000000-0000-4000-8000-000000000001'
const COR_PADRAO = '#5B1A6B'
const PAGAMENTOS = ['Pix', 'Cartão na entrega', 'Dinheiro'] as const

type Tamanho = { nome: string; preco: number }
type Item = {
  id: string
  secao: string
  nome: string
  descricao: string | null
  tamanhos: Tamanho[]
  foto_url: string | null
  acomp_inclusos: number | null
  acomp_extra: number | null
  acomp_opcoes: string[] | null
}
type Loja = {
  nome: string
  logo_url: string | null
  cor: string | null
  whatsapp: string | null
  taxa: number
  info: string | null
}
type Linha = {
  chave: string
  nome: string
  tamanho: string
  acomps: string[]
  obs: string
  preco: number
  qtd: number
}

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const centavos = (v: number) => Math.round(v * 100) / 100
// Mesma conta da Edge Function delivery-agente: extra só acima dos inclusos.
const precoUnit = (i: Item, t: Tamanho, n: number) =>
  centavos(t.preco + Math.max(0, n - (i.acomp_inclusos ?? 0)) * Number(i.acomp_extra ?? 0))
const temTamanhos = (i: Item) => i.tamanhos.length > 1
const iniciais = (s: string) =>
  s
    .split(/\s+/)
    .filter((p) => p.length > 2)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase()

const CSS = `
@keyframes cv-sobe { from { transform: translateY(100%) } to { transform: none } }
@keyframes cv-fade { from { opacity: 0 } to { opacity: 1 } }
@keyframes cv-entra { from { opacity: 0; transform: translateY(14px) } to { opacity: 1; transform: none } }
@keyframes cv-pulo { 0%,100% { transform: scale(1) } 40% { transform: scale(1.06) } }
@keyframes cv-boia { 0%,100% { transform: translate(0,0) } 50% { transform: translate(12px,-10px) } }
.cv-sheet { animation: cv-sobe .32s cubic-bezier(.2,.9,.3,1) }
.cv-veu { animation: cv-fade .2s ease-out }
.cv-card { animation: cv-entra .45s ease-out both }
.cv-pulo { animation: cv-pulo .35s ease-out }
.cv-boia { animation: cv-boia 9s ease-in-out infinite }
@media (prefers-reduced-motion: reduce) { .cv-sheet,.cv-veu,.cv-card,.cv-pulo,.cv-boia { animation: none } }
`

export default function Cardapio() {
  const { loja: lojaId = DEMO } = useParams()
  const [loja, setLoja] = useState<Loja | null>(null)
  const [itens, setItens] = useState<Item[]>([])
  const [estado, setEstado] = useState<'carregando' | 'ok' | 'fora'>('carregando')
  const [linhas, setLinhas] = useState<Linha[]>([])
  const [aberto, setAberto] = useState<Item | null>(null)
  const [sacola, setSacola] = useState(false)
  const [verInfo, setVerInfo] = useState(false)
  const [secaoAtiva, setSecaoAtiva] = useState('')
  const secoesRef = useRef<Record<string, HTMLElement | null>>({})

  useEffect(() => {
    let vivo = true
    Promise.all([
      supabase.rpc('fn_cardapio_loja', { loc: lojaId }),
      supabase
        .from('delivery_menu')
        .select(
          'id, secao, nome, descricao, tamanhos, foto_url, acomp_inclusos, acomp_extra, acomp_opcoes'
        )
        .eq('location_id', lojaId)
        .order('ordem'),
    ]).then(([l, m]) => {
      if (!vivo) return
      const dados = l.data?.[0]
      if (!dados || !m.data?.length) return setEstado('fora')
      setLoja({ ...dados, taxa: Number(dados.taxa) })
      setItens(m.data as unknown as Item[])
      setEstado('ok')
    })
    return () => {
      vivo = false
    }
  }, [lojaId])

  // Extensão de modo escuro (Dark Reader) apagava a cor da marca.
  useEffect(() => {
    const m = document.createElement('meta')
    m.name = 'darkreader-lock'
    document.head.appendChild(m)
    return () => m.remove()
  }, [])
  useEffect(() => {
    if (loja) document.title = `${loja.nome} · Cardápio`
  }, [loja])

  const capa = itens.find((i) => i.foto_url)?.foto_url
  const secoes = useMemo(() => [...new Set(itens.map((i) => i.secao))], [itens])

  // Aba ativa acompanha a rolagem.
  useEffect(() => {
    if (!secoes.length) return
    const obs = new IntersectionObserver(
      (es) =>
        es.forEach(
          (e) => e.isIntersecting && setSecaoAtiva(e.target.getAttribute('data-secao') ?? '')
        ),
      { rootMargin: '-120px 0px -65% 0px' }
    )
    Object.values(secoesRef.current).forEach((el) => el && obs.observe(el))
    return () => obs.disconnect()
  }, [secoes])

  const subtotal = centavos(linhas.reduce((s, l) => s + l.preco * l.qtd, 0))
  const qtdTotal = linhas.reduce((s, l) => s + l.qtd, 0)
  const cor = loja?.cor ?? COR_PADRAO
  const tokens = {
    '--cor': cor,
    '--cor-escura': `color-mix(in oklab, ${cor} 70%, black)`,
    '--cor-clara': `color-mix(in oklab, ${cor} 9%, white)`,
    '--cor-media': `color-mix(in oklab, ${cor} 22%, white)`,
  } as CSSProperties

  function adicionar(l: Omit<Linha, 'chave'>) {
    const chave = [l.nome, l.tamanho, l.acomps.join('+'), l.obs].join('|')
    setLinhas((a) =>
      a.some((x) => x.chave === chave)
        ? a.map((x) => (x.chave === chave ? { ...x, qtd: x.qtd + l.qtd } : x))
        : [...a, { ...l, chave }]
    )
    setAberto(null)
  }

  function mudarQtd(chave: string, d: number) {
    setLinhas((a) =>
      a.map((x) => (x.chave === chave ? { ...x, qtd: x.qtd + d } : x)).filter((x) => x.qtd > 0)
    )
  }

  if (estado !== 'ok' || !loja) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#FAF7FB] p-8 text-center text-[#5B4A63]">
        {estado === 'carregando' ? (
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#E7DCEB] border-t-[#5B1A6B]" />
        ) : (
          <p className="text-lg font-semibold">Este cardápio não está disponível agora.</p>
        )}
      </div>
    )
  }

  return (
    <div style={tokens} className="min-h-screen bg-[#FAF7FB] pb-32 text-[#2B1630] antialiased">
      <style>{CSS}</style>

      <header className="relative overflow-hidden bg-[var(--cor-escura)] px-5 pb-16 pt-10 text-white">
        {capa && (
          <img
            src={capa}
            alt=""
            className="absolute inset-0 h-full w-full scale-110 object-cover blur-[2px]"
          />
        )}
        <div className="absolute inset-0 bg-[linear-gradient(160deg,color-mix(in_oklab,var(--cor)_82%,transparent)_0%,color-mix(in_oklab,var(--cor-escura)_94%,transparent)_100%)]" />
        <div className="cv-boia pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
        <div className="cv-boia pointer-events-none absolute -bottom-24 -left-10 h-56 w-56 rounded-full bg-fuchsia-300/20 blur-3xl [animation-delay:-4s]" />
        <div className="relative mx-auto flex max-w-xl flex-col items-center text-center">
          {loja.logo_url ? (
            <img
              src={loja.logo_url}
              alt=""
              className="h-24 w-24 rounded-full object-cover shadow-2xl ring-4 ring-white/80"
            />
          ) : (
            <div className="grid h-24 w-24 place-items-center rounded-full bg-white text-3xl font-black tracking-tight text-[var(--cor)] shadow-2xl ring-4 ring-white/40">
              {iniciais(loja.nome)}
            </div>
          )}
          <h1 className="mt-4 text-[34px] font-black leading-none tracking-tight">{loja.nome}</h1>
          <div className="mt-4 flex flex-wrap justify-center gap-2 text-[13px] font-semibold">
            <span className="flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 backdrop-blur">
              <Bike className="h-4 w-4" />{' '}
              {loja.taxa > 0 ? `Entrega ${brl(loja.taxa)}` : 'Entrega grátis'}
            </span>
            <span className="flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 backdrop-blur">
              <MessageCircle className="h-4 w-4" /> Pedido pelo WhatsApp
            </span>
          </div>
        </div>
        <svg
          viewBox="0 0 1440 60"
          preserveAspectRatio="none"
          className="absolute inset-x-0 bottom-0 h-8 w-full fill-[#FAF7FB]"
        >
          <path d="M0,40 C360,0 1080,80 1440,30 L1440,60 L0,60 Z" />
        </svg>
      </header>

      {loja.info && (
        <div className="mx-auto -mt-6 max-w-xl px-4">
          <button
            onClick={() => setVerInfo((v) => !v)}
            aria-expanded={verInfo}
            className="relative w-full rounded-2xl bg-white px-4 py-3 text-left shadow-[0_6px_24px_-12px_rgba(60,20,70,.35)]"
          >
            <span className="flex items-center justify-between text-sm font-bold text-[var(--cor)]">
              Horários, bairros e entrega
              <ChevronDown
                className={`h-4 w-4 transition-transform ${verInfo ? 'rotate-180' : ''}`}
              />
            </span>
            {verInfo && (
              <p className="mt-2 whitespace-pre-line text-[13.5px] leading-relaxed text-[#5B4A63]">
                {loja.info}
              </p>
            )}
          </button>
        </div>
      )}

      <nav className="sticky top-0 z-10 mt-4 border-b border-[#EFE6F1] bg-[#FAF7FB]/90 backdrop-blur">
        <div className="mx-auto flex max-w-xl gap-2 overflow-x-auto px-4 py-3 [scrollbar-width:none]">
          {secoes.map((s) => (
            <button
              key={s}
              onClick={() =>
                secoesRef.current[s]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold transition-colors ${
                (secaoAtiva || secoes[0]) === s
                  ? 'bg-[var(--cor)] text-white shadow-md'
                  : 'bg-white text-[#5B4A63] shadow-sm'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </nav>

      <main className="mx-auto max-w-xl space-y-9 px-4 pt-6">
        {secoes.map((s) => (
          <section
            key={s}
            data-secao={s}
            ref={(el) => {
              secoesRef.current[s] = el
            }}
            className="scroll-mt-20"
          >
            <h2 className="mb-3 text-[22px] font-black tracking-tight">{s}</h2>
            <div className="space-y-3">
              {itens
                .filter((i) => i.secao === s)
                .map((i, n) => {
                  const menor = Math.min(...i.tamanhos.map((t) => t.preco))
                  return (
                    <button
                      key={i.id}
                      onClick={() => setAberto(i)}
                      style={{ animationDelay: `${n * 60}ms` }}
                      className="cv-card group flex w-full items-center gap-4 rounded-3xl bg-white p-3 text-left shadow-[0_2px_14px_-8px_rgba(60,20,70,.3)] transition-transform active:scale-[0.98]"
                    >
                      <div className="min-w-0 flex-1 pl-1">
                        <p className="font-extrabold leading-tight">{i.nome}</p>
                        {i.descricao && (
                          <p className="mt-1 line-clamp-2 text-[13.5px] leading-snug text-[#7A6882]">
                            {i.descricao}
                          </p>
                        )}
                        <p className="mt-2 text-[15px] font-black text-[var(--cor)]">
                          {temTamanhos(i) && (
                            <span className="mr-1 text-xs font-semibold text-[#9A8AA1]">
                              a partir de
                            </span>
                          )}
                          {brl(menor)}
                        </p>
                      </div>
                      <Foto item={i} className="h-24 w-24 shrink-0 rounded-2xl" />
                    </button>
                  )
                })}
            </div>
          </section>
        ))}
        <p className="pb-4 text-center text-xs text-[#A898AE]">
          Preços conferidos pela loja na confirmação do pedido.
        </p>
      </main>

      {qtdTotal > 0 && !sacola && !aberto && (
        <div className="fixed inset-x-0 bottom-0 z-20 p-4">
          <button
            key={qtdTotal}
            onClick={() => setSacola(true)}
            className="cv-pulo mx-auto flex w-full max-w-xl items-center justify-between rounded-2xl bg-[var(--cor)] px-5 py-4 font-extrabold text-white shadow-[0_12px_30px_-10px_var(--cor)]"
          >
            <span className="flex items-center gap-2.5">
              <span className="relative">
                <ShoppingBag className="h-5 w-5" />
                <span className="absolute -right-2 -top-2 grid h-4 min-w-4 place-items-center rounded-full bg-white px-1 text-[10px] text-[var(--cor)]">
                  {qtdTotal}
                </span>
              </span>
              Ver sacola
            </span>
            <span>{brl(subtotal)}</span>
          </button>
        </div>
      )}

      {aberto && (
        <ItemSheet item={aberto} onFechar={() => setAberto(null)} onAdicionar={adicionar} />
      )}
      {sacola && (
        <Sacola
          loja={loja}
          linhas={linhas}
          subtotal={subtotal}
          mudarQtd={mudarQtd}
          onFechar={() => setSacola(false)}
        />
      )}
    </div>
  )
}

function Foto({ item, className }: { item: Item; className: string }) {
  if (item.foto_url)
    return <img src={item.foto_url} alt="" loading="lazy" className={`${className} object-cover`} />
  return (
    <div
      className={`${className} relative grid place-items-center overflow-hidden bg-[radial-gradient(circle_at_30%_25%,var(--cor-media),var(--cor-clara)_70%)]`}
    >
      <span className="absolute -bottom-3 -right-3 h-12 w-12 rounded-full bg-[var(--cor)] opacity-15" />
      <span className="text-2xl font-black tracking-tight text-[var(--cor)] opacity-80">
        {iniciais(item.nome) || item.nome[0]}
      </span>
    </div>
  )
}

function Sheet({
  onFechar,
  titulo,
  children,
}: {
  onFechar: () => void
  titulo: string
  children: React.ReactNode
}) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onFechar()
    document.addEventListener('keydown', esc)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', esc)
      document.body.style.overflow = ''
    }
  }, [onFechar])
  return (
    <div
      className="cv-veu fixed inset-0 z-30 flex items-end bg-[#1A0B1E]/50 backdrop-blur-[2px]"
      onClick={onFechar}
    >
      <div
        role="dialog"
        aria-label={titulo}
        onClick={(e) => e.stopPropagation()}
        className="cv-sheet mx-auto flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-t-[28px] bg-white"
      >
        {children}
      </div>
    </div>
  )
}

function Stepper({
  qtd,
  onMenos,
  onMais,
  min = 1,
}: {
  qtd: number
  onMenos: () => void
  onMais: () => void
  min?: number
}) {
  return (
    <div className="flex items-center gap-1 rounded-full bg-[var(--cor-clara)] p-1">
      <button
        onClick={onMenos}
        disabled={qtd <= min}
        aria-label="Menos"
        className="grid h-9 w-9 place-items-center rounded-full bg-white text-[var(--cor)] disabled:opacity-40"
      >
        <Minus className="h-4 w-4" />
      </button>
      <span className="w-7 text-center font-black">{qtd}</span>
      <button
        onClick={onMais}
        aria-label="Mais"
        className="grid h-9 w-9 place-items-center rounded-full bg-[var(--cor)] text-white"
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  )
}

function ItemSheet({
  item,
  onFechar,
  onAdicionar,
}: {
  item: Item
  onFechar: () => void
  onAdicionar: (l: Omit<Linha, 'chave'>) => void
}) {
  const [tam, setTam] = useState(item.tamanhos[Math.min(1, item.tamanhos.length - 1)])
  const [acomps, setAcomps] = useState<string[]>([])
  const [qtd, setQtd] = useState(1)
  const [obs, setObs] = useState('')
  const montar = !!item.acomp_opcoes?.length
  const inclusos = item.acomp_inclusos ?? 0
  const unit = precoUnit(item, tam, acomps.length)

  return (
    <Sheet onFechar={onFechar} titulo={item.nome}>
      <div className="overflow-y-auto">
        <div className="relative">
          <Foto item={item} className="h-48 w-full" />
          <button
            onClick={onFechar}
            aria-label="Fechar"
            className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-white/90 shadow"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-6 p-5">
          <div>
            <h2 className="text-2xl font-black tracking-tight">{item.nome}</h2>
            {item.descricao && (
              <p className="mt-1 text-[14.5px] leading-snug text-[#7A6882]">{item.descricao}</p>
            )}
          </div>

          {temTamanhos(item) && (
            <fieldset>
              <legend className="mb-2 text-sm font-extrabold uppercase tracking-wide text-[#9A8AA1]">
                Tamanho
              </legend>
              <div className="grid grid-cols-3 gap-2">
                {item.tamanhos.map((t) => {
                  const on = t.nome === tam.nome
                  return (
                    <button
                      key={t.nome}
                      onClick={() => setTam(t)}
                      aria-pressed={on}
                      className={`rounded-2xl border-2 px-2 py-3 text-center transition-all ${
                        on
                          ? 'border-[var(--cor)] bg-[var(--cor-clara)] shadow-sm'
                          : 'border-[#EFE6F1]'
                      }`}
                    >
                      <span className="block text-[13px] font-bold">{t.nome}</span>
                      <span className="mt-0.5 block text-sm font-black text-[var(--cor)]">
                        {brl(t.preco)}
                      </span>
                    </button>
                  )
                })}
              </div>
            </fieldset>
          )}

          {montar && (
            <fieldset>
              <legend className="mb-2 flex w-full items-baseline justify-between text-sm font-extrabold uppercase tracking-wide text-[#9A8AA1]">
                Acompanhamentos
                <span className="text-xs font-semibold normal-case tracking-normal">
                  {Math.min(acomps.length, inclusos)} de {inclusos} inclusos
                  {Number(item.acomp_extra) > 0 && ` · extra ${brl(Number(item.acomp_extra))}`}
                </span>
              </legend>
              <div className="flex flex-wrap gap-2">
                {item.acomp_opcoes!.map((a) => {
                  const on = acomps.includes(a)
                  const pago = on && acomps.indexOf(a) >= inclusos
                  return (
                    <button
                      key={a}
                      onClick={() => setAcomps((x) => (on ? x.filter((y) => y !== a) : [...x, a]))}
                      aria-pressed={on}
                      className={`rounded-full px-4 py-2 text-sm font-semibold transition-all active:scale-95 ${
                        on
                          ? 'bg-[var(--cor)] text-white shadow'
                          : 'bg-[var(--cor-clara)] text-[#4A3352]'
                      }`}
                    >
                      {a}
                      {pago && (
                        <span className="ml-1 opacity-80">+{brl(Number(item.acomp_extra))}</span>
                      )}
                    </button>
                  )
                })}
              </div>
            </fieldset>
          )}

          <label className="block">
            <span className="mb-2 block text-sm font-extrabold uppercase tracking-wide text-[#9A8AA1]">
              Alguma observação?
            </span>
            <input
              value={obs}
              onChange={(e) => setObs(e.target.value.slice(0, 120))}
              placeholder="Ex.: sem banana, zero açúcar"
              className="w-full rounded-2xl border-2 border-[#EFE6F1] px-4 py-3 text-[15px] focus:border-[var(--cor)] focus:outline-none"
            />
          </label>
        </div>
      </div>

      <div className="flex items-center gap-3 border-t border-[#F2EAF3] p-4">
        <Stepper
          qtd={qtd}
          onMenos={() => setQtd((q) => q - 1)}
          onMais={() => setQtd((q) => q + 1)}
        />
        <button
          onClick={() =>
            onAdicionar({
              nome: item.nome,
              tamanho: temTamanhos(item) ? tam.nome : '',
              acomps,
              obs: obs.trim(),
              preco: unit,
              qtd,
            })
          }
          className="flex flex-1 items-center justify-between rounded-2xl bg-[var(--cor)] px-5 py-3.5 font-extrabold text-white active:scale-[0.99]"
        >
          <span>Adicionar</span>
          <span>{brl(centavos(unit * qtd))}</span>
        </button>
      </div>
    </Sheet>
  )
}

function Sacola({
  loja,
  linhas,
  subtotal,
  mudarQtd,
  onFechar,
}: {
  loja: Loja
  linhas: Linha[]
  subtotal: number
  mudarQtd: (chave: string, d: number) => void
  onFechar: () => void
}) {
  const [nome, setNome] = useState('')
  const [endereco, setEndereco] = useState('')
  const [pagamento, setPagamento] = useState<(typeof PAGAMENTOS)[number]>('Pix')
  const [troco, setTroco] = useState('')
  const total = centavos(subtotal + loja.taxa)
  const pode = linhas.length > 0 && nome.trim() && endereco.trim().length >= 8

  useEffect(() => {
    if (!linhas.length) onFechar()
  }, [linhas.length, onFechar])

  function enviar() {
    const texto = [
      `Olá! Quero fazer este pedido pelo cardápio:`,
      '',
      ...linhas.map((l) =>
        [
          `• ${l.qtd}x ${l.nome}${l.tamanho ? ` (${l.tamanho})` : ''}: ${brl(l.preco * l.qtd)}`,
          l.acomps.length ? `   com ${l.acomps.join(', ')}` : '',
          l.obs ? `   obs.: ${l.obs}` : '',
        ]
          .filter(Boolean)
          .join('\n')
      ),
      '',
      `Subtotal: ${brl(subtotal)}`,
      `Entrega: ${brl(loja.taxa)}`,
      `*Total: ${brl(total)}*`,
      '',
      `Nome: ${nome.trim()}`,
      `Endereço: ${endereco.trim()}`,
      `Pagamento: ${pagamento}${pagamento === 'Dinheiro' && troco.trim() ? ` (troco para ${troco.trim()})` : ''}`,
    ].join('\n')
    const destino = loja.whatsapp ? `https://wa.me/${loja.whatsapp}` : 'https://wa.me/'
    window.open(`${destino}?text=${encodeURIComponent(texto)}`, '_blank')
  }

  const campo =
    'w-full rounded-2xl border-2 border-[#EFE6F1] px-4 py-3 text-[15px] placeholder:text-[#B3A5B8] focus:border-[var(--cor)] focus:outline-none'

  return (
    <Sheet onFechar={onFechar} titulo="Sua sacola">
      <div className="flex items-center justify-between px-5 pb-2 pt-5">
        <h2 className="text-2xl font-black tracking-tight">Sua sacola</h2>
        <button
          onClick={onFechar}
          aria-label="Fechar"
          className="grid h-10 w-10 place-items-center rounded-full bg-[var(--cor-clara)]"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="space-y-5 overflow-y-auto px-5 pb-4">
        <ul className="divide-y divide-[#F2EAF3]">
          {linhas.map((l) => (
            <li key={l.chave} className="flex items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="font-bold leading-tight">
                  {l.nome}
                  {l.tamanho && (
                    <span className="font-semibold text-[#7A6882]"> · {l.tamanho}</span>
                  )}
                </p>
                {l.acomps.length > 0 && (
                  <p className="text-[13px] text-[#7A6882]">{l.acomps.join(', ')}</p>
                )}
                {l.obs && <p className="text-[13px] italic text-[#7A6882]">{l.obs}</p>}
                <p className="mt-1 text-sm font-black text-[var(--cor)]">{brl(l.preco * l.qtd)}</p>
              </div>
              {l.qtd === 1 ? (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => mudarQtd(l.chave, -1)}
                    aria-label={`Remover ${l.nome}`}
                    className="grid h-9 w-9 place-items-center text-[#9A8AA1]"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                  <Stepper
                    qtd={1}
                    min={0}
                    onMenos={() => mudarQtd(l.chave, -1)}
                    onMais={() => mudarQtd(l.chave, 1)}
                  />
                </div>
              ) : (
                <Stepper
                  qtd={l.qtd}
                  min={0}
                  onMenos={() => mudarQtd(l.chave, -1)}
                  onMais={() => mudarQtd(l.chave, 1)}
                />
              )}
            </li>
          ))}
        </ul>

        <div className="space-y-1.5 rounded-2xl bg-[var(--cor-clara)] p-4 text-[15px]">
          <p className="flex justify-between">
            <span>Subtotal</span>
            <span>{brl(subtotal)}</span>
          </p>
          <p className="flex justify-between">
            <span>Entrega</span>
            <span>{loja.taxa > 0 ? brl(loja.taxa) : 'Grátis'}</span>
          </p>
          <p className="flex justify-between pt-1 text-lg font-black">
            <span>Total</span>
            <span className="text-[var(--cor)]">{brl(total)}</span>
          </p>
        </div>

        <div className="space-y-3">
          <input
            className={campo}
            placeholder="Seu nome"
            value={nome}
            onChange={(e) => setNome(e.target.value.slice(0, 80))}
          />
          <textarea
            className={campo}
            rows={2}
            placeholder="Endereço: rua, número, bairro e referência"
            value={endereco}
            onChange={(e) => setEndereco(e.target.value.slice(0, 300))}
          />
          <div className="grid grid-cols-3 gap-2">
            {PAGAMENTOS.map((p) => (
              <button
                key={p}
                onClick={() => setPagamento(p)}
                aria-pressed={pagamento === p}
                className={`rounded-2xl px-2 py-3 text-[13px] font-bold transition-colors ${
                  pagamento === p
                    ? 'bg-[var(--cor)] text-white'
                    : 'bg-[var(--cor-clara)] text-[#4A3352]'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
          {pagamento === 'Dinheiro' && (
            <input
              className={campo}
              inputMode="decimal"
              placeholder="Troco para quanto?"
              value={troco}
              onChange={(e) => setTroco(e.target.value.slice(0, 12))}
            />
          )}
        </div>
      </div>
      <div className="border-t border-[#F2EAF3] p-4">
        <button
          onClick={enviar}
          disabled={!pode}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#1FAF5A] py-4 text-[17px] font-extrabold text-white transition-opacity disabled:opacity-40"
        >
          <MessageCircle className="h-5 w-5" /> Enviar pedido no WhatsApp
        </button>
        {!pode && (
          <p className="mt-2 text-center text-[13px] text-[#9A8AA1]">
            Preencha nome e endereço completo
          </p>
        )}
      </div>
    </Sheet>
  )
}
