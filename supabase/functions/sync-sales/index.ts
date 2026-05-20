import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

interface SalePayload {
  id: string
  shift_id: string
  location_id: string
  weight_grams: number
  weight_source: 'scale' | 'manual'
  price_per_gram: number
  amount: number
  payment_method: 'pix' | 'credit' | 'debit' | 'cash'
  amount_received: number | null
  change_returned: number | null
  sync_reconciled: boolean
  synced_at: string | null
  created_offline: boolean
  created_at: string
}

interface ShiftRecord {
  id: string
  opened_at: string
  closed_at: string | null
}

async function findShiftByTimestamp(
  supabase: ReturnType<typeof createClient>,
  locationId: string,
  createdAt: string
): Promise<ShiftRecord | null> {
  const { data } = await supabase
    .from('shifts')
    .select('id, opened_at, closed_at')
    .eq('location_id', locationId)
    .lte('opened_at', createdAt)
    .or(`closed_at.is.null,closed_at.gt.${createdAt}`)
    .order('opened_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return data
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  let body: { sales: SalePayload[] }
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const sales = (body.sales ?? []).slice(0, 50) // max 50 per batch
  const now = new Date().toISOString()

  let synced = 0
  let reconciled = 0
  const errors: Array<{ id: string; error: string }> = []

  for (const sale of sales) {
    try {
      let shift_id = sale.shift_id
      let sync_reconciled = false

      // Verify the sale's shift contains the created_at timestamp
      const { data: shift } = await supabase
        .from('shifts')
        .select('id, opened_at, closed_at')
        .eq('id', sale.shift_id)
        .maybeSingle<ShiftRecord>()

      if (!shift) {
        const correctShift = await findShiftByTimestamp(supabase, sale.location_id, sale.created_at)
        if (!correctShift) {
          errors.push({ id: sale.id, error: 'No shift found for this timestamp' })
          continue
        }
        shift_id = correctShift.id
        sync_reconciled = true
      } else {
        const withinWindow =
          sale.created_at >= shift.opened_at &&
          (!shift.closed_at || sale.created_at < shift.closed_at)

        if (!withinWindow) {
          const correctShift = await findShiftByTimestamp(
            supabase,
            sale.location_id,
            sale.created_at
          )
          if (correctShift && correctShift.id !== shift_id) {
            shift_id = correctShift.id
            sync_reconciled = true
          }
        }
      }

      const { error: upsertError } = await supabase.from('sales').upsert(
        {
          id: sale.id,
          shift_id,
          location_id: sale.location_id,
          weight_grams: sale.weight_grams,
          weight_source: sale.weight_source,
          price_per_gram: sale.price_per_gram,
          amount: sale.amount,
          payment_method: sale.payment_method,
          amount_received: sale.amount_received,
          change_returned: sale.change_returned,
          sync_reconciled,
          synced_at: now,
          created_offline: true,
          created_at: sale.created_at,
        },
        { onConflict: 'id' }
      )

      if (upsertError) throw upsertError

      synced++
      if (sync_reconciled) reconciled++
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      errors.push({ id: sale.id, error: msg })
    }
  }

  return new Response(JSON.stringify({ synced, reconciled, errors }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
