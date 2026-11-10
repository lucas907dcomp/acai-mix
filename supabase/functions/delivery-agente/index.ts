// Agente de delivery (10/11/2026): atende o cliente no WhatsApp, manda o
// cardápio, monta o pedido e grava em delivery_orders (cai na tela /delivery).
//
// Preço e total NUNCA saem do modelo: ele chama montar_resumo, o código calcula
// pelo cardápio do banco e devolve o resumo pronto; confirmar_pedido grava
// exatamente o que o cliente viu.
//
// Hoje: chamada pelo chat de teste do app (JWT do usuário logado).
// Passo 3: webhook do WhatsApp (Evolution) chama atender() com o telefone real.

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

const MODELO = 'gpt-5.5'
const OPENAI_KEY = Deno.env.get('OPENAI_API_KEY')!
const SB_URL = Deno.env.get('SUPABASE_URL')!
const SB_SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const FUSO = 'America/Maceio' // Aracaju
const CONVERSA_EXPIRA_H = 6
const MAX_MENSAGENS = 40

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ---------------------------------------------------------------- tipos

interface Tamanho { nome: string; preco: number }
interface ItemMenu {
  id: string; secao: string; nome: string; descricao: string | null; tamanhos: Tamanho[]
  /** Item de montar: lista de opções, quantas inclusas e o preço de cada extra. */
  acomp_opcoes: string[] | null; acomp_inclusos: number | null; acomp_extra: number | null
}
interface Loja {
  id: string
  nome: string
  atendente: string
  info: string
  taxa: number
}
interface ItemPedido { nome: string; tamanho: string; qtd: number; preco: number; obs?: string }
interface Rascunho {
  cliente_nome: string
  endereco: string
  itens: ItemPedido[]
  subtotal: number
  taxa_entrega: number
  total: number
  pagamento: string
  troco_para: number | null
  observacao: string | null
  resumo: string
}
type Msg = Record<string, unknown> & { role: string }
interface Estado { mensagens: Msg[]; rascunho?: Rascunho | null }

const PAGAMENTOS = ['Pix', 'Cartão na entrega', 'Dinheiro']
const sem = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase()
const brl = (n: number) => 'R$ ' + n.toFixed(2).replace('.', ',')
const centavos = (n: number) => Math.round(n * 100) / 100

// ---------------------------------------------------------------- cardápio

export function textoCardapio(loja: Loja, menu: ItemMenu[]): string {
  const linhas = [`*Cardápio ${loja.nome}* 💜`]
  let secao = ''
  for (const i of menu) {
    if (i.secao !== secao) {
      secao = i.secao
      linhas.push('', `*${secao.toUpperCase()}*`)
    }
    const precos = i.tamanhos.length === 1
      ? brl(i.tamanhos[0].preco)
      : i.tamanhos.map((t) => `${t.nome} ${brl(t.preco)}`).join(' · ')
    linhas.push(`• *${i.nome}*: ${precos}`)
    if (i.descricao) linhas.push(`  _${i.descricao}_`)
    if (i.acomp_opcoes?.length) linhas.push(`  Acompanhamentos: ${i.acomp_opcoes.join(', ')}`)
  }
  if (loja.taxa > 0) linhas.push('', `Taxa de entrega: ${brl(loja.taxa)}`)
  return linhas.join('\n')
}

/** Para o modelo: cada item com o id que ele usa no montar_resumo. */
function cardapioParaModelo(menu: ItemMenu[]): string {
  return menu
    .map((i) => `- [${i.id}] ${i.secao} > ${i.nome}${i.descricao ? ` (${i.descricao})` : ''}: ` +
      i.tamanhos.map((t) => `"${t.nome}" ${brl(t.preco)}`).join(', ') +
      (i.acomp_opcoes?.length
        ? ` | DE MONTAR: ${i.acomp_inclusos ?? 0} acompanhamentos inclusos, extra ${brl(Number(i.acomp_extra ?? 0))} cada (cobrado automaticamente); opções: ${i.acomp_opcoes.join(', ')}`
        : ''))
    .join('\n')
}

// ---------------------------------------------------------------- prompt

function prompt(loja: Loja, menu: ItemMenu[], agora: string): string {
  return `# Quem você é
Você é ${loja.atendente}, atendente virtual do delivery da ${loja.nome}, uma açaiteria. Você atende pelo WhatsApp: tira dúvidas, mostra o cardápio, monta o pedido e confirma. Simpática, rápida e organizada, como a melhor atendente da loja. Se perguntarem, diga que é a atendente virtual da loja.

Agora: ${agora}.

# Cardápio (a única fonte de itens e preços)
${cardapioParaModelo(menu)}
${loja.taxa > 0 ? `Taxa de entrega: ${brl(loja.taxa)}.` : 'Taxa de entrega: não informada; não cite valor.'}

# Informações da loja (horário, bairros, tempo de entrega, Pix, regras)
${loja.info || '(a loja ainda não preencheu)'}

# Como você atende
1. Cumprimente pelo nome da loja e pergunte o que a pessoa quer. Se ela pedir o cardápio, não souber o que pedir ou perguntar o que tem: escreva [CARDAPIO] sozinho numa mensagem (o sistema troca pelo cardápio formatado com preços).
2. Item com acompanhamentos já descritos (ex.: açaí da casa) vem exatamente assim: não pergunte acompanhamento. Só pergunte o tamanho se a pessoa não disse. Se ela quiser tirar ou trocar algo, anote em obs. Se quiser algo A MAIS (ex.: granola extra) e o cardápio tiver item de adicional, inclua esse item (uma unidade por extra, dizendo em obs qual) e avise o valor; sem item de adicional no cardápio, diga que a equipe confirma.
3. Item DE MONTAR: pergunte os acompanhamentos (só as opções listadas). Se passar dos inclusos, avise quanto custa cada extra e siga; o sistema cobra os extras sozinho, então NÃO adicione item de adicional para eles. Mande os escolhidos em acompanhamentos.
4. Depois dos itens, pergunte se deseja mais alguma coisa. Então peça nome e endereço completo (rua, número, bairro e ponto de referência) e a forma de pagamento: Pix, cartão na entrega ou dinheiro (se dinheiro, pergunte troco para quanto).
5. Só quando o cliente tiver dito itens, nome, endereço e pagamento (nunca preencha com "não informado"), chame montar_resumo. Mande [RESUMO] sozinho numa mensagem (o sistema troca pelo resumo com o total calculado) e pergunte se pode confirmar.
6. Só chame confirmar_pedido depois de um "sim" claro ao último resumo. Se a pessoa mudar algo, chame montar_resumo de novo. Confirmado, diga o número do pedido e o que acontece agora (tempo de entrega e Pix só se estiverem nas informações da loja).
7. "Cadê meu pedido?": use status_do_pedido.

# Limites
- Item, sabor, tamanho ou preço fora do cardápio não existe: diga que não tem e sugira o mais parecido.
- Nunca calcule total ou soma de cabeça: diga só o total que montar_resumo informar. Preço de um item do cardápio pode dizer.
- Se as informações da loja listam bairros atendidos e o bairro do cliente não está na lista, avise antes do resumo que a equipe vai confirmar se entrega nesse bairro, e siga com o pedido normalmente.
- Horário, bairro atendido, tempo de entrega, chave Pix, promoção: só o que está nas informações da loja. Se não estiver, diga que a equipe da loja confirma por aqui.
- Fora do horário de funcionamento (se informado), avise que a loja está fechada e quando abre.
- Reclamação, pedido já confirmado que precisa mudar ou cancelar, ou assunto fora do delivery: diga que a equipe da loja vai responder por aqui em instantes.
- Nunca diga que o pedido foi feito ou confirmado sem confirmar_pedido ter dado certo.

# Estilo
WhatsApp de verdade: mensagens curtas, linguagem simples e calorosa, no máximo uma ou duas perguntas por vez, emoji com parcimônia (💜🍧). Negrito com *asteriscos*, sem títulos nem markdown. Para mandar mais de uma mensagem, separe com uma linha contendo só ---. Não repita o que a pessoa já disse; não peça de novo o que ela já informou.`
}

const ferramentas = [
  {
    type: 'function',
    function: {
      name: 'montar_resumo',
      description: 'Calcula o pedido pelo cardápio e prepara o resumo para o cliente confirmar. Chame quando tiver itens, nome, endereço e pagamento.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        required: ['itens', 'cliente_nome', 'endereco', 'pagamento', 'troco_para', 'observacao'],
        properties: {
          itens: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['item_id', 'tamanho', 'qtd', 'acompanhamentos', 'obs'],
              properties: {
                item_id: { type: 'string', description: 'id entre colchetes no cardápio' },
                tamanho: { type: 'string', description: 'nome exato do tamanho' },
                qtd: { type: 'integer' },
                acompanhamentos: { type: ['array', 'null'], items: { type: 'string' }, description: 'só em item DE MONTAR: os escolhidos, exatamente como nas opções' },
                obs: { type: ['string', 'null'], description: 'alteração pedida pelo cliente (ex.: sem banana)' },
              },
            },
          },
          cliente_nome: { type: 'string' },
          endereco: { type: 'string', description: 'rua, número, bairro e referência' },
          pagamento: { type: 'string', enum: PAGAMENTOS },
          troco_para: { type: ['number', 'null'] },
          observacao: { type: ['string', 'null'], description: 'só o que o cliente pediu para a entrega (ex.: tocar interfone). Nunca anotação sua.' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'confirmar_pedido',
      description: 'Grava o último resumo como pedido. Só depois de o cliente dizer sim ao resumo.',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
  {
    type: 'function',
    function: {
      name: 'status_do_pedido',
      description: 'Situação do último pedido deste cliente.',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
]

// ---------------------------------------------------------------- ferramentas

export function montarResumo(args: any, menu: ItemMenu[], taxa: number): Rascunho | string {
  if (!Array.isArray(args.itens) || args.itens.length === 0) return 'Erro: pedido sem itens.'
  const itens: ItemPedido[] = []
  for (const a of args.itens) {
    const item = menu.find((m) => m.id === a.item_id)
    if (!item) return `Erro: item ${a.item_id} não existe no cardápio.`
    const tam = item.tamanhos.find((t) => t.nome.toLowerCase() === String(a.tamanho).toLowerCase())
      ?? (item.tamanhos.length === 1 ? item.tamanhos[0] : undefined)
    if (!tam) return `Erro: tamanho "${a.tamanho}" não existe para ${item.nome}. Tamanhos: ${item.tamanhos.map((t) => t.nome).join(', ')}.`
    const qtd = Number(a.qtd)
    if (!Number.isInteger(qtd) || qtd < 1 || qtd > 30) return `Erro: quantidade inválida para ${item.nome}.`
    let preco = tam.preco
    const notas: string[] = []
    const escolhidos: string[] = Array.isArray(a.acompanhamentos) ? a.acompanhamentos.map(String) : []
    if (item.acomp_opcoes?.length) {
      const fora = escolhidos.filter((e) => !item.acomp_opcoes!.some((o) => sem(o) === sem(e)))
      if (fora.length) return `Erro: ${fora.join(', ')} não está nas opções de ${item.nome}. Opções: ${item.acomp_opcoes.join(', ')}.`
      const extras = Math.max(0, escolhidos.length - (item.acomp_inclusos ?? 0))
      preco = centavos(preco + extras * Number(item.acomp_extra ?? 0))
      if (escolhidos.length) notas.push(escolhidos.join(', ') + (extras ? ` (+${extras} extra${extras > 1 ? 's' : ''})` : ''))
    } else if (escolhidos.length) {
      return `Erro: ${item.nome} é item pronto, não se monta. Alteração vai em obs.`
    }
    if (a.obs) notas.push(String(a.obs))
    const obs = notas.join('; ').slice(0, 160)
    itens.push({ nome: item.nome, tamanho: tam.nome, qtd, preco, ...(obs ? { obs } : {}) })
  }
  const nome = String(args.cliente_nome ?? '').trim()
  const endereco = String(args.endereco ?? '').trim()
  const vazio = /n[aã]o (informad|dit)|pendente|a confirmar|^\?/i
  if (!nome || vazio.test(nome)) return 'Erro: falta o nome do cliente. Pergunte antes.'
  if (endereco.length < 8 || vazio.test(endereco)) return 'Erro: falta o endereço completo. Pergunte antes.'
  if (!PAGAMENTOS.includes(args.pagamento)) return 'Erro: forma de pagamento inválida.'

  const subtotal = centavos(itens.reduce((s, i) => s + i.qtd * i.preco, 0))
  const total = centavos(subtotal + taxa)
  const troco = args.pagamento === 'Dinheiro' && Number(args.troco_para) > 0 ? centavos(Number(args.troco_para)) : null
  if (troco !== null && troco < total) return `Erro: o total do pedido é ${brl(total)} e o troco pedido (${brl(troco)}) é menor. Diga o total ao cliente e pergunte troco para quanto (ou se prefere outra forma).`
  const obs = args.observacao ? String(args.observacao).slice(0, 300) : null

  const linhas = ['*Resumo do seu pedido* 📝', '']
  for (const i of itens) {
    linhas.push(`${i.qtd}x ${i.nome} ${i.tamanho}: ${brl(i.qtd * i.preco)}`)
    if (i.obs) linhas.push(`   _${i.obs}_`)
  }
  if (taxa > 0) linhas.push(`Taxa de entrega: ${brl(taxa)}`)
  linhas.push(`*Total: ${brl(total)}*`, '', `👤 ${nome}`, `📍 ${endereco}`,
    `💳 ${args.pagamento}${troco ? ` (troco para ${brl(troco)})` : ''}`)
  if (obs) linhas.push(`📝 ${obs}`)

  return {
    cliente_nome: nome.slice(0, 80), endereco: endereco.slice(0, 300), itens, subtotal,
    taxa_entrega: taxa, total, pagamento: args.pagamento, troco_para: troco, observacao: obs,
    resumo: linhas.join('\n'),
  }
}

// ---------------------------------------------------------------- núcleo

async function openai(mensagens: Msg[]) {
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${OPENAI_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: MODELO, messages: mensagens, tools: ferramentas, reasoning_effort: 'none' }),
  })
  if (!r.ok) throw new Error(`OpenAI ${r.status}: ${await r.text()}`)
  const j = await r.json()
  return j.choices[0].message as Msg & { content: string | null; tool_calls?: any[] }
}

/** Corta o começo do histórico num ponto em que começa mensagem do cliente. */
function aparar(m: Msg[]): Msg[] {
  if (m.length <= MAX_MENSAGENS) return m
  let i = m.length - MAX_MENSAGENS
  while (i < m.length && m[i].role !== 'user') i++
  return m.slice(i)
}

export async function atender(sb: SupabaseClient, locationId: string, telefone: string, texto: string) {
  const [{ data: l, error: el }, { data: menu, error: em }, { data: conv }] = await Promise.all([
    sb.from('locations').select('id, name, brand_name, delivery_enabled, delivery_agent_name, delivery_info, delivery_fee').eq('id', locationId).single(),
    sb.from('delivery_menu').select('id, secao, nome, descricao, tamanhos, acomp_opcoes, acomp_inclusos, acomp_extra').eq('location_id', locationId).eq('ativo', true).order('ordem'),
    sb.from('delivery_conversas').select('mensagens, updated_at').eq('location_id', locationId).eq('telefone', telefone).maybeSingle(),
  ])
  if (el || !l?.delivery_enabled) throw new Error('Loja sem delivery')
  if (em) throw em
  const loja: Loja = {
    id: l.id, nome: l.brand_name ?? l.name, atendente: l.delivery_agent_name ?? 'Bia',
    info: l.delivery_info ?? '', taxa: Number(l.delivery_fee ?? 0),
  }
  const cardapio = (menu ?? []) as ItemMenu[]

  const expirou = !conv || Date.now() - new Date(conv.updated_at).getTime() > CONVERSA_EXPIRA_H * 3600_000
  const estado: Estado = expirou ? { mensagens: [] } : (conv.mensagens as Estado)
  estado.mensagens.push({ role: 'user', content: texto })

  const agora = new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, weekday: 'long', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date())
  const sistema: Msg = { role: 'system', content: prompt(loja, cardapio, agora) }

  let resposta = ''
  for (let volta = 0; volta < 5; volta++) {
    const msg = await openai([sistema, ...estado.mensagens])
    estado.mensagens.push({ role: 'assistant', content: msg.content ?? null, ...(msg.tool_calls ? { tool_calls: msg.tool_calls } : {}) })
    if (!msg.tool_calls?.length) {
      resposta = msg.content ?? ''
      break
    }
    for (const call of msg.tool_calls) {
      let saida: string
      const nome = call.function.name
      if (nome === 'montar_resumo') {
        const r = montarResumo(JSON.parse(call.function.arguments || '{}'), cardapio, loja.taxa)
        if (typeof r === 'string') saida = r
        else {
          estado.rascunho = r
          saida = `OK. Total ${brl(r.total)}. Antes de mandar: o bairro de "${r.endereco}" está nos bairros atendidos das informações da loja? Se não estiver, avise numa mensagem que a equipe vai confirmar se entrega lá. Depois mande [RESUMO] e peça a confirmação.`
        }
      } else if (nome === 'confirmar_pedido') {
        const r = estado.rascunho
        if (!r) saida = 'Erro: não há resumo. Chame montar_resumo antes.'
        else {
          const { resumo: _, subtotal: __, ...pedido } = r
          const { data, error } = await sb.from('delivery_orders')
            .insert({ ...pedido, location_id: locationId, cliente_telefone: telefone.slice(0, 20) })
            .select('numero').single()
          if (error) saida = `Erro ao gravar: ${error.message}. Diga que houve um problema e que a equipe da loja vai confirmar.`
          else {
            estado.rascunho = null
            saida = `Pedido gravado: número ${data.numero}. Já está na tela da loja. Pagamento escolhido: ${r.pagamento}${r.troco_para ? ` com troco para ${brl(r.troco_para)}` : ''}; fale só desse pagamento.`
          }
        }
      } else if (nome === 'status_do_pedido') {
        const { data } = await sb.from('delivery_orders').select('numero, status, created_at')
          .eq('location_id', locationId).eq('cliente_telefone', telefone.slice(0, 20))
          .order('created_at', { ascending: false }).limit(1).maybeSingle()
        const nomes: Record<string, string> = { novo: 'recebido, aguardando a loja aceitar', preparo: 'em preparo', saiu: 'saiu para entrega', entregue: 'entregue', cancelado: 'cancelado' }
        saida = data ? `Pedido ${data.numero}: ${nomes[data.status]}.` : 'Nenhum pedido deste cliente.'
      } else saida = 'Ferramenta desconhecida.'
      estado.mensagens.push({ role: 'tool', tool_call_id: call.id, content: saida })
    }
  }

  estado.mensagens = aparar(estado.mensagens)
  await sb.from('delivery_conversas').upsert({ location_id: locationId, telefone, mensagens: estado, updated_at: new Date().toISOString() })

  const mensagens = resposta
    .split(/\n\s*---\s*\n|^---\s*\n|\n---\s*$/)
    .map((m) => m.replaceAll('[CARDAPIO]', textoCardapio(loja, cardapio))
      .replaceAll('[RESUMO]', estado.rascunho?.resumo ?? '').trim())
    .filter(Boolean)
  return mensagens
}

// ---------------------------------------------------------------- entrada

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

  try {
    const sb = createClient(SB_URL, SB_SERVICE)
    // Chat de teste: usuário logado do app conversa como cliente da própria loja.
    const jwt = req.headers.get('Authorization')?.replace('Bearer ', '') ?? ''
    const { data: { user } } = await sb.auth.getUser(jwt)
    if (!user) return json({ erro: 'Não autenticado' }, 401)
    const { data: perfil } = await sb.from('user_profiles').select('location_id').eq('id', user.id).single()
    if (!perfil?.location_id) return json({ erro: 'Sem loja' }, 403)

    const { mensagem, reiniciar } = await req.json()
    const telefone = `teste-${user.id.slice(0, 8)}`
    if (reiniciar) {
      await sb.from('delivery_conversas').delete().eq('location_id', perfil.location_id).eq('telefone', telefone)
      return json({ mensagens: [] })
    }
    if (typeof mensagem !== 'string' || !mensagem.trim() || mensagem.length > 2000) return json({ erro: 'Mensagem inválida' }, 400)
    return json({ mensagens: await atender(sb, perfil.location_id, telefone, mensagem.trim()) })
  } catch (e) {
    console.error('delivery-agente:', e)
    return json({ erro: 'Falha no atendimento' }, 500)
  }
})
