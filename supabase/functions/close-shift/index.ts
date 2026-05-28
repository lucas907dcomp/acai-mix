import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

async function runCloseShift(
  openNext: boolean
): Promise<{ closed: number; opened: number }> {
  const supabase = createClient(supabaseUrl, supabaseKey)

  const { data: openShifts, error: shiftsError } = await supabase
    .from('shifts')
    .select('*')
    .eq('status', 'open')

  if (shiftsError) throw shiftsError
  if (!openShifts || openShifts.length === 0) {
    console.log('close-shift: no open shifts found')
    return { closed: 0, opened: 0 }
  }

  let closedCount = 0
  let openedCount = 0
  const now = new Date().toISOString()

  // UTC 19 = BRT 16 (shift 1 ends → new shift 2)
  // UTC 2  = BRT 23 (shift 2 ends → new shift 1)
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

    // .eq('status', 'open') on update = idempotency guard
    const { error: closeError } = await supabase
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

    if (closeError) {
      console.error(`Error closing shift ${shift.id}:`, closeError.message)
      continue
    }

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
  try {
    const ct = req.headers.get('content-type') ?? ''
    if (ct.includes('application/json')) {
      const body = await req.json()
      if (body?.openNext === false) openNext = false
    }
  } catch {
    // ignore parse errors — use default openNext=true
  }

  try {
    const result = await runCloseShift(openNext)
    console.log(
      `close-shift: closed=${result.closed}, opened=${result.opened}, openNext=${openNext}`
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
