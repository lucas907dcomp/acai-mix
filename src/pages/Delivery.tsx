import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bike, Copy, MessageCircle, Phone, Printer, X } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { useDeliveryEnabled } from '@/hooks/useFinanceEnabled'
import { useLocationData } from '@/hooks/useLocationData'
import { imprimirConta } from '@/lib/imprimirConta'
import {
  PROXIMO,
  contaDoDelivery,
  descreverItemDelivery,
  type PedidoDelivery,
  type StatusDelivery,
} from '@/lib/delivery'
import { botaoAvancar, colunas, textos } from '@/content/delivery'
import { SimularCliente } from '@/components/delivery/SimularCliente'

const fmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const hora = (iso: string) =>
  new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

/** Bip curto sem arquivo de áudio. O navegador só toca depois do 1º clique na página. */
function bip() {
  try {
    const ctx = new AudioContext()
    for (const [inicio, freq] of [[0, 880], [0.25, 1175]] as const) {
      const osc = ctx.createOscillator()
      osc.frequency.value = freq
      osc.connect(ctx.destination)
      osc.start(ctx.currentTime + inicio)
      osc.stop(ctx.currentTime + inicio + 0.18)
    }
  } catch {
    /* sem áudio: o toast ainda avisa */
  }
}

function usePedidos(locationId: string | undefined) {
  const qc = useQueryClient()
  const chave = ['delivery-orders', locationId]

  useEffect(() => {
    if (!locationId) return
    const canal = supabase
      .channel(`delivery-${locationId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'delivery_orders', filter: `location_id=eq.${locationId}` },
        (msg) => {
          if (msg.eventType === 'INSERT') {
            bip()
            toast.success(textos.novoPedido((msg.new as PedidoDelivery).numero))
          }
          qc.invalidateQueries({ queryKey: ['delivery-orders', locationId] })
        }
      )
      .subscribe()
    return () => {
      supabase.removeChannel(canal)
    }
  }, [locationId, qc])

  return useQuery<PedidoDelivery[]>({
    queryKey: chave,
    queryFn: async () => {
      const desde = new Date(Date.now() - 24 * 3600_000).toISOString()
      const { data, error } = await supabase
        .from('delivery_orders')
        .select('id, numero, cliente_nome, cliente_telefone, endereco, itens, total, pagamento, troco_para, observacao, status, created_at')
        .eq('location_id', locationId!)
        .or(`created_at.gte.${desde},status.in.(novo,preparo,saiu)`)
        .order('numero', { ascending: true })
      if (error) throw error
      return data as unknown as PedidoDelivery[]
    },
    enabled: !!locationId,
    // Rede de segurança se o realtime cair.
    refetchInterval: 30_000,
  })
}

export default function Delivery() {
  const locationId = useAuthStore((s) => s.profile?.location_id)
  const ligado = useDeliveryEnabled()
  const { data: loja } = useLocationData()
  const { data: pedidos = [], isLoading } = usePedidos(locationId)
  const qc = useQueryClient()
  const [simulando, setSimulando] = useState(false)

  const mudar = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: StatusDelivery }) => {
      const { error } = await supabase.from('delivery_orders').update({ status }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['delivery-orders', locationId] }),
    onError: () => toast.error('Não consegui atualizar o pedido. Confira a internet.'),
  })

  if (ligado === false) return <Navigate to="/pos" replace />

  const nomeLoja = loja?.brand_name ?? loja?.name ?? ''
  const imprimir = (p: PedidoDelivery) =>
    imprimirConta(contaDoDelivery(p, nomeLoja)).catch(() =>
      toast.error('Impressora não respondeu. Ligada e pareada?')
    )

  function avancar(p: PedidoDelivery) {
    const proximo = PROXIMO[p.status]
    if (!proximo) return
    mudar.mutate({ id: p.id, status: proximo })
    if (p.status === 'novo') imprimir(p)
  }

  const finalizados = pedidos.filter((p) => p.status === 'entregue' || p.status === 'cancelado')

  return (
    <div className={simulando ? 'p-4 md:p-6 grid gap-4 xl:grid-cols-[1fr_380px] text-white' : 'p-4 md:p-6 text-white'}>
    <div className="space-y-6 min-w-0">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bike className="w-6 h-6" /> {textos.titulo}
          </h1>
          <p className="text-sm text-[#9d7bc8]">{textos.subtitulo}</p>
        </div>
        {!simulando && (
          <button onClick={() => setSimulando(true)} className="flex items-center gap-2 rounded-lg bg-[#00a884] hover:bg-[#029172] px-3 py-2 text-sm font-semibold">
            <MessageCircle className="w-4 h-4" /> {textos.botaoSimular}
          </button>
        )}
      </header>

      {isLoading ? (
        <p className="text-[#9d7bc8]">Carregando…</p>
      ) : (
        <div className={simulando ? 'grid gap-4 lg:grid-cols-3 xl:grid-cols-1 2xl:grid-cols-3' : 'grid gap-4 lg:grid-cols-3'}>
          {colunas.map((c) => {
            const lista = pedidos.filter((p) => p.status === c.status)
            return (
              <section key={c.status} className="rounded-xl bg-[#1a0b2e] border border-[#2d1550] p-3 space-y-3">
                <h2 className="font-semibold flex items-center justify-between">
                  {c.titulo}
                  <span className="text-xs rounded-full bg-[#4c1e8c] px-2 py-0.5">{lista.length}</span>
                </h2>
                {lista.length === 0 && <p className="text-sm text-[#6b4f91]">{c.vazio}</p>}
                {lista.map((p) => (
                  <CartaoPedido
                    key={p.id}
                    pedido={p}
                    ocupado={mudar.isPending}
                    onAvancar={() => avancar(p)}
                    onImprimir={() => imprimir(p)}
                    onCancelar={() => mudar.mutate({ id: p.id, status: 'cancelado' })}
                  />
                ))}
              </section>
            )
          })}
        </div>
      )}

      {finalizados.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-[#9d7bc8]">{textos.finalizados}</h2>
          <ul className="text-sm divide-y divide-[#2d1550] rounded-xl bg-[#1a0b2e] border border-[#2d1550]">
            {finalizados.map((p) => (
              <li key={p.id} className="flex justify-between gap-2 px-3 py-2">
                <span>
                  #{p.numero} · {p.cliente_nome} · {hora(p.created_at)}
                </span>
                <span className={p.status === 'cancelado' ? 'text-red-400' : 'text-emerald-400'}>
                  {p.status === 'cancelado' ? 'Cancelado' : fmt.format(p.total)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
    {simulando && <SimularCliente onFechar={() => setSimulando(false)} />}
    </div>
  )
}

function CartaoPedido({
  pedido: p,
  ocupado,
  onAvancar,
  onImprimir,
  onCancelar,
}: {
  pedido: PedidoDelivery
  ocupado: boolean
  onAvancar: () => void
  onImprimir: () => void
  onCancelar: () => void
}) {
  const [confirmando, setConfirmando] = useState(false)

  async function copiarEndereco() {
    try {
      await navigator.clipboard.writeText(p.endereco)
      toast.success(textos.enderecoCopiado)
    } catch {
      toast.error('Não consegui copiar.')
    }
  }

  return (
    <article className="rounded-lg bg-[#0f0720] border border-[#2d1550] p-3 space-y-2 text-sm">
      <div className="flex justify-between">
        <span className="font-bold">#{p.numero} · {p.cliente_nome}</span>
        <span className="text-[#9d7bc8]">{hora(p.created_at)}</span>
      </div>

      <ul className="space-y-0.5">
        {p.itens.map((i, k) => (
          <li key={k} className="flex justify-between gap-2">
            <span>{i.qtd}x {descreverItemDelivery(i)}</span>
            <span className="text-[#9d7bc8] whitespace-nowrap">{fmt.format(i.qtd * i.preco)}</span>
          </li>
        ))}
      </ul>

      <div className="flex justify-between font-semibold border-t border-dashed border-[#2d1550] pt-1">
        <span>Total</span>
        <span>{fmt.format(p.total)}</span>
      </div>

      <p className="text-[#c9b6e4]">
        {p.pagamento}
        {p.pagamento === 'Dinheiro' && p.troco_para ? ` · troco para ${fmt.format(p.troco_para)}` : ''}
      </p>
      <p className="text-[#c9b6e4]">{p.endereco}</p>
      {p.observacao && <p className="text-amber-300">Obs: {p.observacao}</p>}

      <div className="flex flex-wrap gap-2 pt-1">
        {PROXIMO[p.status] && (
          <button
            onClick={onAvancar}
            disabled={ocupado}
            className="flex-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 px-3 py-2 font-semibold"
          >
            {botaoAvancar[p.status]}
          </button>
        )}
        <a
          href={`tel:${p.cliente_telefone}`}
          className="rounded-lg border border-[#2d1550] px-3 py-2 hover:bg-[#2d1550]"
          aria-label="Ligar para o cliente"
        >
          <Phone className="w-4 h-4" />
        </a>
        <button onClick={copiarEndereco} className="rounded-lg border border-[#2d1550] px-3 py-2 hover:bg-[#2d1550]" aria-label={textos.copiarEndereco} title={textos.copiarEndereco}>
          <Copy className="w-4 h-4" />
        </button>
        <button onClick={onImprimir} className="rounded-lg border border-[#2d1550] px-3 py-2 hover:bg-[#2d1550]" aria-label={textos.imprimir} title={textos.imprimir}>
          <Printer className="w-4 h-4" />
        </button>
        {p.status !== 'saiu' &&
          (confirmando ? (
            <button
              onClick={onCancelar}
              onBlur={() => setConfirmando(false)}
              autoFocus
              className="rounded-lg bg-red-700 px-3 py-2 text-xs font-semibold"
            >
              {textos.confirmarCancelar}
            </button>
          ) : (
            <button onClick={() => setConfirmando(true)} className="rounded-lg border border-[#2d1550] px-3 py-2 text-red-400 hover:bg-red-950/30" aria-label={textos.cancelar} title={textos.cancelar}>
              <X className="w-4 h-4" />
            </button>
          ))}
      </div>
    </article>
  )
}
