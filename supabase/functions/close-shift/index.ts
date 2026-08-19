import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

async function runCloseShift(
  openNext: boolean,
  locationId: string | null
): Promise<{ closed: number; opened: number }> {
  const supabase = createClient(supabaseUrl, supabaseKey)

  // Sem locationId isto pegava os turnos abertos de TODAS as lojas. Com duas
  // lojas trocando de turno em horários diferentes (16h numa, 15h na outra),
  // o agendamento de uma fechava o turno da outra na hora errada.
  //
  // Quando locationId vem, só aquela loja é tocada. Sem ele, o comportamento
  // antigo é mantido de propósito, para um agendamento que ainda não foi
  // atualizado não quebrar — mas fica registrado no log como aviso.
  let query = supabase.from('shifts').select('*').eq('status', 'open')
  if (locationId) {
    query = query.eq('location_id', locationId)
  } else {
    console.warn(
      'close-shift: chamada SEM locationId — vai fechar turno de todas as lojas. ' +
        'Configure o agendamento para enviar {"locationId": "..."}.'
    )
  }

  const { data: openShifts, error: shiftsError } = await query

  if (shiftsError) throw shiftsError
  if (!openShifts || openShifts.length === 0) {
    console.log(`close-shift: nenhum turno aberto${locationId ? ` na loja ${locationId}` : ''}`)
    return { closed: 0, opened: 0 }
  }

  let closedCount = 0
  let openedCount = 0
  const now = new Date().toISOString()

  // Qual turno abrir a seguir, pelo horário da chamada:
  //   troca da tarde  -> abre o turno 2   (AçaiMix 16h BRT = 19 UTC,
  //                                        AçaiMix Barra 15h BRT = 18 UTC)
  //   fecho da noite  -> abre o turno 1   (23h BRT = 2 UTC)
  // O corte em 12 UTC (9h BRT) separa os dois casos com folga — cabem
  // horários de troca diferentes por loja sem tocar nesta linha.
  const newShiftNumber = new Date().getUTCHours() >= 12 ? 2 : 1

  for (const shift of openShifts) {
    const { data: salesData, error: salesError } = await supabase
      .from('sales')
      .select('amount, payment_method')
      .eq('shift_id', shift.id)

    if (salesError) {
      console.error(`Error fetching sales for shift ${shift.id}:`, salesError.message)
      continue
    }

    const sales = salesData ?? []
    const round = (n: number) => Math.round(n * 100) / 100
    const totalSales = round(sales.reduce((s, r) => s + r.amount, 0))
    const totalPix = round(
      sales.filter((r) => r.payment_method === 'pix').reduce((s, r) => s + r.amount, 0)
    )
    const totalCard = round(
      sales
        .filter((r) => r.payment_method === 'credit' || r.payment_method === 'debit')
        .reduce((s, r) => s + r.amount, 0)
    )
    const totalCash = round(
      sales.filter((r) => r.payment_method === 'cash').reduce((s, r) => s + r.amount, 0)
    )

    // .select() é obrigatório: sem ele, UPDATE com 0 linhas afetadas retorna
    // error: null — chamadas paralelas do cron passariam no guard e cada uma
    // abriria um turno novo, criando duplicatas.
    const { data: closed, error: closeError } = await supabase
      .from('shifts')
      .update({
        status: 'closed',
        closed_at: now,
        closed_by: 'system',
        total_sales: totalSales,
        total_pix: totalPix,
        total_card: totalCard,
        total_cash: totalCash,
        sale_count: sales.length,
      })
      .eq('id', shift.id)
      .eq('status', 'open')
      .select('id')

    if (closeError) {
      console.error(`Error closing shift ${shift.id}:`, closeError.message)
      continue
    }

    // Outra chamada paralela já fechou este turno — não abrir duplicata
    if (!closed || closed.length === 0) continue

    closedCount++

    if (!openNext) continue

    const { error: openError } = await supabase.from('shifts').insert({
      location_id: shift.location_id,
      shift_number: newShiftNumber,
      opened_by: 'system',
    })

    if (openError) {
      console.error(
        `Error opening new shift for location ${shift.location_id}:`,
        openError.message
      )
    } else {
      openedCount++
    }
  }

  return { closed: closedCount, opened: openedCount }
}

Deno.serve(async (req) => {
  let openNext = true
  let locationId: string | null = null
  try {
    const ct = req.headers.get('content-type') ?? ''
    if (ct.includes('application/json')) {
      const body = await req.json()
      if (body?.openNext === false) openNext = false
      if (typeof body?.locationId === 'string' && body.locationId.trim() !== '') {
        locationId = body.locationId.trim()
      }
    }
  } catch {
    // ignore parse errors — use default openNext=true
  }

  try {
    const result = await runCloseShift(openNext, locationId)
    console.log(
      `close-shift: closed=${result.closed}, opened=${result.opened}, ` +
        `openNext=${openNext}, locationId=${locationId ?? 'TODAS'}`
    )
    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('close-shift error:', msg)
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
