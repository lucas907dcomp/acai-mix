import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Minus, Plus, ShoppingBag, Trash2, X } from 'lucide-react'
import {
  MAX_ACOMPANHAMENTOS,
  acompanhamentos,
  avulsos,
  copos,
  marca,
  pagamentos,
} from '@/content/cardapio'

// Cardápio público de delivery (protótipo). Sem backend: o pedido vira uma
// mensagem pronta no WhatsApp da loja, onde o agente do n8n confirma.

type Linha = { chave: string; nome: string; detalhe?: string; preco: number; qtd: number }

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const tokens = {
  '--amarelo': marca.cores.amarelo,
  '--roxo': marca.cores.roxo,
  '--roxo-escuro': marca.cores.roxoEscuro,
  '--verde': marca.cores.verde,
  '--fundo': marca.cores.fundo,
  '--roxo-claro': marca.cores.roxoClaro,
  '--linha': marca.cores.linha,
  '--suave': marca.cores.suave,
} as CSSProperties

export default function Cardapio() {
  const [copoId, setCopoId] = useState(copos[1].id)
  const [extras, setExtras] = useState<string[]>([])
  const [linhas, setLinhas] = useState<Linha[]>([])
  const [aberto, setAberto] = useState(false)
  const [nome, setNome] = useState('')
  const [endereco, setEndereco] = useState('')
  const [pagamento, setPagamento] = useState<string>(pagamentos[0])
  const [troco, setTroco] = useState('')
  const [obs, setObs] = useState('')

  // Extensões de modo escuro (Dark Reader) apagavam o amarelo da marca.
  useEffect(() => {
    const m = document.createElement('meta')
    m.name = 'darkreader-lock'
    document.head.appendChild(m)
    document.title = `${marca.nome} · Delivery`
    return () => m.remove()
  }, [])

  const total = useMemo(() => linhas.reduce((s, l) => s + l.preco * l.qtd, 0), [linhas])
  const qtdTotal = linhas.reduce((s, l) => s + l.qtd, 0)

  function mudar(chave: string, delta: number, base?: Omit<Linha, 'qtd' | 'chave'>) {
    setLinhas((atual) => {
      const achou = atual.find((l) => l.chave === chave)
      if (!achou) return base && delta > 0 ? [...atual, { ...base, chave, qtd: delta }] : atual
      return atual
        .map((l) => (l.chave === chave ? { ...l, qtd: l.qtd + delta } : l))
        .filter((l) => l.qtd > 0)
    })
  }

  function addAcai() {
    const c = copos.find((x) => x.id === copoId)!
    const detalhe = extras.length ? extras.join(', ') : 'puro'
    mudar(`${c.id}|${detalhe}`, 1, { nome: `Açaí ${c.nome}`, detalhe, preco: c.preco })
    setExtras([])
  }

  function toggleExtra(e: string) {
    setExtras((x) =>
      x.includes(e) ? x.filter((y) => y !== e) : x.length < MAX_ACOMPANHAMENTOS ? [...x, e] : x
    )
  }

  const podeEnviar = linhas.length > 0 && nome.trim() && endereco.trim()

  function enviar() {
    const itens = linhas
      .map((l) => `• ${l.qtd}x ${l.nome}${l.detalhe ? ` (${l.detalhe})` : ''}: ${brl(l.preco * l.qtd)}`)
      .join('\n')
    const texto = [
      `*Pedido ${marca.nome}*`,
      itens,
      `*Total: ${brl(total)}*`,
      '',
      `Nome: ${nome.trim()}`,
      `Endereço: ${endereco.trim()}`,
      `Pagamento: ${pagamento}${pagamento === 'Dinheiro' && troco ? ` (troco para ${troco})` : ''}`,
      obs.trim() && `Obs.: ${obs.trim()}`,
    ]
      .filter((x) => x !== '')
      .join('\n')
    window.open(`https://wa.me/${marca.whatsapp}?text=${encodeURIComponent(texto)}`, '_blank')
  }

  const campo =
    'w-full rounded-xl border-2 border-[var(--linha)] bg-white px-4 py-3 text-[15px] text-[var(--roxo-escuro)] placeholder:text-[var(--suave)] focus:border-[var(--verde)] focus:outline-none'

  return (
    <div style={tokens} className="min-h-screen bg-[var(--fundo)] pb-28 text-[var(--roxo-escuro)]">
      <header className="bg-[var(--amarelo)] px-4 pb-8 pt-8 text-center">
        <img
          src={marca.logo}
          alt={marca.nome}
          className="mx-auto h-28 w-28 rounded-full object-cover shadow-lg ring-4 ring-white"
        />
        <h1 className="mt-4 text-3xl font-black tracking-tight text-[var(--roxo)]">{marca.nome}</h1>
        <p className="mt-1 text-sm font-semibold text-[var(--suave)]">
          Delivery · peça aqui, confirme no WhatsApp
        </p>
      </header>

      <main className="mx-auto max-w-md space-y-8 px-4 pt-6">
        <section className="rounded-3xl bg-white p-5 shadow-sm">
          <h2 className="text-xl font-extrabold text-[var(--roxo)]">Monte seu açaí</h2>

          <div className="mt-4 grid gap-2">
            {copos.map((c) => (
              <button
                key={c.id}
                onClick={() => setCopoId(c.id)}
                className={`flex items-center justify-between rounded-2xl border-2 px-4 py-3 text-left transition-colors ${
                  copoId === c.id
                    ? 'border-[var(--roxo)] bg-[var(--roxo-claro)]'
                    : 'border-[var(--linha)]'
                }`}
              >
                <span>
                  <span className="block font-bold">{c.nome}</span>
                  <span className="text-sm text-[var(--suave)]">{c.descricao}</span>
                </span>
                <span className="font-extrabold text-[var(--roxo)]">{brl(c.preco)}</span>
              </button>
            ))}
          </div>

          <p className="mt-5 text-sm font-bold">
            Acompanhamentos{' '}
            <span className="font-medium text-[var(--suave)]">
              ({extras.length}/{MAX_ACOMPANHAMENTOS}, inclusos)
            </span>
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {acompanhamentos.map((a) => {
              const on = extras.includes(a)
              return (
                <button
                  key={a}
                  onClick={() => toggleExtra(a)}
                  aria-pressed={on}
                  className={`rounded-full px-3.5 py-2 text-sm font-semibold transition-colors ${
                    on ? 'bg-[var(--verde)] text-white' : 'bg-[var(--roxo-claro)] text-[var(--roxo-escuro)]'
                  }`}
                >
                  {a}
                </button>
              )
            })}
          </div>

          <button
            onClick={addAcai}
            className="mt-5 w-full rounded-2xl bg-[var(--roxo)] py-3.5 font-extrabold text-white active:scale-[0.99]"
          >
            Adicionar ao pedido
          </button>
        </section>

        {avulsos.map((s) => (
          <section key={s.secao}>
            <h2 className="mb-3 text-xl font-extrabold text-[var(--roxo)]">{s.secao}</h2>
            <ul className="divide-y divide-[var(--linha)] rounded-3xl bg-white px-4 shadow-sm">
              {s.itens.map((i) => {
                const qtd = linhas.find((l) => l.chave === i.id)?.qtd ?? 0
                return (
                  <li key={i.id} className="flex items-center justify-between gap-3 py-3.5">
                    <span>
                      <span className="block font-semibold">{i.nome}</span>
                      <span className="text-sm font-bold text-[var(--roxo)]">{brl(i.preco)}</span>
                    </span>
                    <span className="flex items-center gap-2">
                      {qtd > 0 && (
                        <>
                          <button
                            onClick={() => mudar(i.id, -1)}
                            aria-label={`Tirar ${i.nome}`}
                            className="grid h-9 w-9 place-items-center rounded-full bg-[var(--roxo-claro)]"
                          >
                            <Minus className="h-4 w-4" />
                          </button>
                          <span className="w-5 text-center font-bold">{qtd}</span>
                        </>
                      )}
                      <button
                        onClick={() => mudar(i.id, 1, { nome: i.nome, preco: i.preco })}
                        aria-label={`Adicionar ${i.nome}`}
                        className="grid h-9 w-9 place-items-center rounded-full bg-[var(--verde)] text-white"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </span>
                  </li>
                )
              })}
            </ul>
          </section>
        ))}
      </main>

      {qtdTotal > 0 && !aberto && (
        <div className="fixed inset-x-0 bottom-0 p-4">
          <button
            onClick={() => setAberto(true)}
            className="mx-auto flex w-full max-w-md items-center justify-between rounded-2xl bg-[var(--roxo)] px-5 py-4 font-extrabold text-white shadow-xl"
          >
            <span className="flex items-center gap-2">
              <ShoppingBag className="h-5 w-5" /> Ver pedido ({qtdTotal})
            </span>
            <span>{brl(total)}</span>
          </button>
        </div>
      )}

      {aberto && (
        <div className="fixed inset-0 z-10 flex items-end bg-black/40" onClick={() => setAberto(false)}>
          <div
            role="dialog"
            aria-label="Seu pedido"
            onClick={(e) => e.stopPropagation()}
            className="mx-auto max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-[var(--fundo)] p-5"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-extrabold text-[var(--roxo)]">Seu pedido</h2>
              <button onClick={() => setAberto(false)} aria-label="Fechar">
                <X className="h-6 w-6" />
              </button>
            </div>

            <ul className="mt-3 space-y-2">
              {linhas.map((l) => (
                <li key={l.chave} className="flex items-start justify-between gap-3 rounded-2xl bg-white p-3">
                  <span>
                    <span className="block font-semibold">
                      {l.qtd}x {l.nome}
                    </span>
                    {l.detalhe && <span className="text-sm text-[var(--suave)]">{l.detalhe}</span>}
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="font-bold">{brl(l.preco * l.qtd)}</span>
                    <button onClick={() => mudar(l.chave, -l.qtd)} aria-label={`Remover ${l.nome}`}>
                      <Trash2 className="h-4 w-4 text-[var(--suave)]" />
                    </button>
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-3 flex justify-between text-lg font-extrabold">
              <span>Total</span>
              <span className="text-[var(--roxo)]">{brl(total)}</span>
            </p>

            <div className="mt-5 space-y-3">
              <input className={campo} placeholder="Seu nome" value={nome} onChange={(e) => setNome(e.target.value)} />
              <textarea
                className={campo}
                rows={2}
                placeholder="Endereço completo (rua, número, bairro, referência)"
                value={endereco}
                onChange={(e) => setEndereco(e.target.value)}
              />
              <div className="flex gap-2">
                {pagamentos.map((p) => (
                  <button
                    key={p}
                    onClick={() => setPagamento(p)}
                    className={`flex-1 rounded-xl px-2 py-2.5 text-sm font-bold ${
                      pagamento === p ? 'bg-[var(--roxo)] text-white' : 'bg-white text-[var(--roxo-escuro)]'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
              {pagamento === 'Dinheiro' && (
                <input className={campo} placeholder="Troco para quanto?" value={troco} onChange={(e) => setTroco(e.target.value)} />
              )}
              <input className={campo} placeholder="Observação (opcional)" value={obs} onChange={(e) => setObs(e.target.value)} />
            </div>

            <button
              onClick={enviar}
              disabled={!podeEnviar}
              className="mt-5 w-full rounded-2xl bg-[var(--verde)] py-4 text-lg font-extrabold text-white disabled:opacity-40"
            >
              Enviar pedido no WhatsApp
            </button>
            {!podeEnviar && (
              <p className="mt-2 text-center text-sm text-[var(--suave)]">Preencha nome e endereço</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
