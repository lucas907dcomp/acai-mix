import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { paidUntilFor } from './period.ts'

const webhookToken = Deno.env.get('ASAAS_WEBHOOK_TOKEN')!
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

// Pix cai como PAYMENT_RECEIVED; cartão como PAYMENT_CONFIRMED.
const PAID_EVENTS = new Set(['PAYMENT_RECEIVED', 'PAYMENT_CONFIRMED'])

// Toda cobrança paga libera o sistema até o próximo dia 20. Cobrança vencida
// não precisa de tratamento: a data não anda e o app bloqueia sozinho.
Deno.serve(async (req) => {
  // A Asaas manda o token cadastrado no webhook neste header.
  if (req.headers.get('asaas-access-token') !== webhookToken) {
    return new Response('token inválido', { status: 401 })
  }

  const { event, payment } = await req.json()
  if (!PAID_EVENTS.has(event)) return new Response('ignorado')

  const paidUntil = paidUntilFor(payment.dueDate)

  // Só avança: evento reentregue fora de ordem não pode recuar a data.
  const { error } = await supabase
    .from('billing')
    .update({ paid_until: paidUntil, updated_at: new Date().toISOString() })
    .eq('id', 1)
    .or(`paid_until.is.null,paid_until.lt.${paidUntil}`)

  if (error) {
    console.error('asaas-webhook: falha ao gravar', error)
    return new Response('erro', { status: 500 }) // Asaas reenvia
  }

  console.log(`asaas-webhook: ${event} ${payment.id} (vence ${payment.dueDate}) -> pago até ${paidUntil}`)
  return new Response('ok')
})
