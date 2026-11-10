import { useEffect, useRef, useState, type FormEvent } from 'react'
import { RotateCcw, Send, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { textos } from '@/content/delivery'

interface Bolha { de: 'cliente' | 'loja'; texto: string }

/** *negrito* e _itálico_ do WhatsApp, sem HTML vindo de fora. */
function Formatado({ texto }: { texto: string }) {
  const partes = texto.split(/(\*[^*\n]+\*|_[^_\n]+_)/g)
  return (
    <>
      {partes.map((p, i) =>
        p.startsWith('*') && p.endsWith('*') && p.length > 2 ? (
          <strong key={i}>{p.slice(1, -1)}</strong>
        ) : p.startsWith('_') && p.endsWith('_') && p.length > 2 ? (
          <em key={i}>{p.slice(1, -1)}</em>
        ) : (
          p
        )
      )}
    </>
  )
}

/**
 * Chat de teste do agente de delivery: o usuário logado conversa como cliente
 * da própria loja. O pedido confirmado cai na tela ao lado, como no WhatsApp.
 */
export function SimularCliente({ onFechar }: { onFechar: () => void }) {
  const [bolhas, setBolhas] = useState<Bolha[]>([])
  const [texto, setTexto] = useState('')
  const [digitando, setDigitando] = useState(false)
  const fim = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fim.current?.scrollIntoView({ behavior: 'smooth' })
  }, [bolhas, digitando])

  async function chamar(body: object) {
    const { data, error } = await supabase.functions.invoke('delivery-agente', { body })
    if (error) throw error
    return (data?.mensagens ?? []) as string[]
  }

  async function enviar(e: FormEvent) {
    e.preventDefault()
    const msg = texto.trim()
    if (!msg || digitando) return
    setTexto('')
    setBolhas((b) => [...b, { de: 'cliente', texto: msg }])
    setDigitando(true)
    try {
      const respostas = await chamar({ mensagem: msg })
      setBolhas((b) => [...b, ...respostas.map((t) => ({ de: 'loja' as const, texto: t }))])
    } catch {
      setBolhas((b) => [...b, { de: 'loja', texto: textos.simular.erro }])
    } finally {
      setDigitando(false)
    }
  }

  async function reiniciar() {
    setBolhas([])
    await chamar({ reiniciar: true }).catch(() => {})
  }

  return (
    <aside className="flex flex-col h-[calc(100vh-3rem)] min-h-[420px] xl:sticky xl:top-6 self-start w-full rounded-xl border border-[#2d1550] overflow-hidden bg-[#efe7dd]">
      <header className="flex items-center justify-between gap-2 px-4 py-3 bg-[#075e54] text-white">
        <div>
          <p className="font-semibold">{textos.simular.titulo}</p>
          <p className="text-xs opacity-80">{textos.simular.subtitulo}</p>
        </div>
        <div className="flex gap-1">
          <button onClick={reiniciar} className="p-2 rounded hover:bg-white/10" title={textos.simular.reiniciar} aria-label={textos.simular.reiniciar}>
            <RotateCcw className="w-4 h-4" />
          </button>
          <button onClick={onFechar} className="p-2 rounded hover:bg-white/10" aria-label="Fechar">
            <X className="w-4 h-4" />
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-3 space-y-2 text-sm text-[#111b21]">
        {bolhas.length === 0 && (
          <p className="text-center text-xs text-[#54656f] bg-white/70 rounded-lg p-2">{textos.simular.dica}</p>
        )}
        {bolhas.map((b, i) => (
          <div key={i} className={b.de === 'cliente' ? 'flex justify-end' : 'flex justify-start'}>
            <p className={`max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 shadow-sm ${b.de === 'cliente' ? 'bg-[#d9fdd3]' : 'bg-white'}`}>
              <Formatado texto={b.texto} />
            </p>
          </div>
        ))}
        {digitando && <p className="text-xs text-[#54656f] italic">{textos.simular.digitando}</p>}
        <div ref={fim} />
      </div>

      <form onSubmit={enviar} className="flex gap-2 p-2 bg-[#f0f2f5]">
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder={textos.simular.placeholder}
          className="flex-1 rounded-full px-4 py-2 text-sm text-[#111b21] bg-white focus:outline-none"
          aria-label={textos.simular.placeholder}
          autoFocus
        />
        <button type="submit" disabled={digitando || !texto.trim()} className="rounded-full bg-[#00a884] text-white p-2.5 disabled:opacity-50" aria-label="Enviar">
          <Send className="w-4 h-4" />
        </button>
      </form>
    </aside>
  )
}
