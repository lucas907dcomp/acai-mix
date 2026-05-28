import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import acaiLogo from '@/assets/acai-mix-logo.jpg'
import type { Shift, Sale } from '@/types'

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

const fmtDateLong = (iso: string) =>
  new Date(iso).toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })

const fmtDateShort = (iso: string) =>
  new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })

function elapsed(openedAt: string, closedAt: string | null): string {
  const end = closedAt ? new Date(closedAt) : new Date()
  const mins = Math.round((end.getTime() - new Date(openedAt).getTime()) / 60000)
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return h > 0 ? `${h}h ${m}min` : `${m}min`
}

// BRT = UTC-3. A "day" in BRT starts at 03:00 UTC and ends at 03:00 UTC next day.
function brtDayRange(openedAt: string): { gte: string; lt: string } {
  const utcMs = new Date(openedAt).getTime()
  const brtMs = utcMs - 3 * 60 * 60 * 1000
  const brtDay = new Date(brtMs)
  const startUtc = new Date(
    Date.UTC(brtDay.getUTCFullYear(), brtDay.getUTCMonth(), brtDay.getUTCDate(), 3, 0, 0)
  )
  return {
    gte: startUtc.toISOString(),
    lt: new Date(startUtc.getTime() + 24 * 60 * 60 * 1000).toISOString(),
  }
}

const PAYMENT_META: Record<string, { label: string; color: string }> = {
  pix:    { label: 'PIX',      color: '#059669' },
  credit: { label: 'Crédito',  color: '#2563eb' },
  debit:  { label: 'Débito',   color: '#7c3aed' },
  cash:   { label: 'Dinheiro', color: '#d97706' },
}

const SECTION_COLORS = ['#7b2d8b', '#00b5a0'] // turno 1 = roxo, turno 2 = verde

interface DayData {
  shifts: Shift[]
  salesByShift: Record<string, Sale[]>
}

// ── Sub-components ──────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: string }) {
  return (
    <div style={{
      fontSize: '10px', fontWeight: 700, color: '#9ca3af',
      letterSpacing: '0.8px', textTransform: 'uppercase',
      borderLeft: '3px solid #f5c800', paddingLeft: '8px', marginBottom: '14px',
    }}>
      {children}
    </div>
  )
}

function PaymentBreakdown({ sales }: { sales: Sale[] }) {
  const total = sales.reduce((s, x) => s + x.amount, 0)
  const rows = ['pix', 'credit', 'debit', 'cash'].map((m) => {
    const ms = sales.filter((s) => s.payment_method === m)
    const t = ms.reduce((s, x) => s + x.amount, 0)
    return { method: m, ...PAYMENT_META[m], total: t, count: ms.length, pct: total > 0 ? (t / total) * 100 : 0 }
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
      {rows.map((row) => (
        <div key={row.method}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '3px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: row.color, flexShrink: 0, display: 'inline-block' }} />
              <span style={{ fontWeight: 600, color: '#374151', fontSize: '12px' }}>{row.label}</span>
              <span style={{ color: '#9ca3af', fontSize: '11px' }}>{row.count} {row.count === 1 ? 'venda' : 'vendas'}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ color: '#6b7280', fontSize: '11px', minWidth: '30px', textAlign: 'right' }}>{row.pct.toFixed(0)}%</span>
              <span style={{ fontWeight: 700, color: '#111827', fontSize: '12px', minWidth: '80px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmt(row.total)}</span>
            </div>
          </div>
          <div style={{ height: '3px', background: '#f3f4f6', borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${row.pct}%`, background: row.color, borderRadius: '2px' }} />
          </div>
        </div>
      ))}
    </div>
  )
}

function SalesTable({ sales }: { sales: Sale[] }) {
  const grandTotal = sales.reduce((s, x) => s + x.amount, 0)
  if (sales.length === 0) {
    return <p style={{ color: '#9ca3af', textAlign: 'center', padding: '20px 0', fontSize: '12px' }}>Nenhuma venda neste turno.</p>
  }
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
          {['#', 'Horário', 'Descrição', 'Peso / Qtd', 'Valor', 'Pagamento'].map((h, i) => (
            <th key={i} style={{
              padding: '5px 7px', textAlign: i >= 3 ? 'right' : 'left',
              fontSize: '10px', fontWeight: 700, color: '#9ca3af',
              letterSpacing: '0.4px', textTransform: 'uppercase', whiteSpace: 'nowrap',
            }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {sales.map((sale, i) => {
          const meta = PAYMENT_META[sale.payment_method]
          const isWeight = sale.weight_grams > 0 && !sale.is_combined
          const desc = sale.is_combined
            ? `Pedido conjunto — ${sale.combined_order_name ?? 'Conjunto'}`
            : isWeight
              ? `Açaí self service${sale.has_casquinha ? ' + casquinha' : ''}`
              : 'Produto avulso'
          const detail = isWeight ? `${sale.weight_grams}g` : sale.quantity ? `${sale.quantity}×` : '—'
          return (
            <tr key={sale.id} style={{ background: i % 2 === 0 ? 'white' : '#f9fafb', borderBottom: '1px solid #f3f4f6' }}>
              <td style={{ padding: '6px 7px', color: '#9ca3af', fontSize: '11px', fontVariantNumeric: 'tabular-nums' }}>{i + 1}</td>
              <td style={{ padding: '6px 7px', color: '#6b7280', fontSize: '11px', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{fmtTime(sale.created_at)}</td>
              <td style={{ padding: '6px 7px', color: '#111827', fontSize: '11px', maxWidth: '180px' }}>{desc}</td>
              <td style={{ padding: '6px 7px', color: '#6b7280', fontSize: '11px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{detail}</td>
              <td style={{ padding: '6px 7px', fontWeight: 600, color: '#111827', fontSize: '11px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{fmt(sale.amount)}</td>
              <td style={{ padding: '6px 7px', textAlign: 'right' }}>
                <span style={{
                  display: 'inline-block', padding: '1px 6px', borderRadius: '3px',
                  fontSize: '10px', fontWeight: 700, letterSpacing: '0.2px',
                  background: meta.color + '18', color: meta.color, whiteSpace: 'nowrap',
                }}>{meta.label}</span>
              </td>
            </tr>
          )
        })}
      </tbody>
      <tfoot>
        <tr style={{ borderTop: '2px solid #e5e7eb' }}>
          <td colSpan={3} style={{ padding: '8px 7px 0', color: '#6b7280', fontSize: '11px' }}>
            {sales.length} {sales.length === 1 ? 'transação' : 'transações'}
          </td>
          <td />
          <td style={{ padding: '8px 7px 0', textAlign: 'right', fontWeight: 800, fontSize: '14px', color: '#111827', fontVariantNumeric: 'tabular-nums' }}>{fmt(grandTotal)}</td>
          <td />
        </tr>
      </tfoot>
    </table>
  )
}

// ── Main component ───────────────────────────────────────────────────────────

export default function ShiftReport() {
  const [params] = useSearchParams()
  const shiftId = params.get('shiftId')

  const [data, setData] = useState<DayData | null>(null)
  const [loading, setLoading] = useState(!!shiftId)
  const [fetchError, setFetchError] = useState<string | null>(null)

  useEffect(() => {
    if (!shiftId) return
    async function load() {
      // 1. Load anchor shift to get location + date
      const { data: anchor, error: anchorErr } = await supabase
        .from('shifts').select('*').eq('id', shiftId!).single()
      if (anchorErr || !anchor) {
        setFetchError(anchorErr?.message ?? 'Turno não encontrado.')
        setLoading(false)
        return
      }

      // 2. All shifts for this location on the same BRT day
      const { gte, lt } = brtDayRange(anchor.opened_at)
      const { data: dayShifts, error: shiftsErr } = await supabase
        .from('shifts').select('*')
        .eq('location_id', anchor.location_id)
        .gte('opened_at', gte)
        .lt('opened_at', lt)
        .order('shift_number')
      if (shiftsErr) {
        setFetchError(shiftsErr.message)
        setLoading(false)
        return
      }

      const shifts = (dayShifts ?? []) as Shift[]

      // 3. All sales for all shifts in one query
      const shiftIds = shifts.map((s) => s.id)
      const { data: salesData, error: salesErr } = await supabase
        .from('sales').select('*')
        .in('shift_id', shiftIds)
        .neq('status', 'CANCELLED')
        .order('created_at')
      if (salesErr) {
        setFetchError(salesErr.message)
        setLoading(false)
        return
      }

      const allSales = (salesData ?? []) as Sale[]
      const salesByShift: Record<string, Sale[]> = {}
      shifts.forEach((s) => {
        salesByShift[s.id] = allSales.filter((x) => x.shift_id === s.id)
      })

      setData({ shifts, salesByShift })
      setLoading(false)
    }
    load()
  }, [shiftId])

  useEffect(() => {
    if (!loading && data && !fetchError) {
      const t = setTimeout(() => window.print(), 400)
      return () => clearTimeout(t)
    }
  }, [loading, data, fetchError])

  const errorMsg = !shiftId ? 'ID do turno não informado.' : fetchError

  if (loading) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#9ca3af', fontSize: '13px' }}>Carregando relatório...</div>
  }
  if (errorMsg || !data) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#ef4444', fontSize: '13px' }}>{errorMsg ?? 'Erro ao carregar dados.'}</div>
  }

  const { shifts, salesByShift } = data
  const allSales = shifts.flatMap((s) => salesByShift[s.id] ?? [])
  const dayTotal = allSales.reduce((sum, s) => sum + s.amount, 0)
  const dayCount = allSales.length
  const refDate = shifts[0]?.opened_at ?? new Date().toISOString()

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          background: #f1f5f9;
          font-family: 'Inter', 'Segoe UI', system-ui, sans-serif;
          color: #111827; font-size: 13px; line-height: 1.5;
        }
        @media print {
          @page { margin: 10mm 12mm; size: A4; }
          body { background: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
          .page { box-shadow: none !important; margin: 0 !important; border-radius: 0 !important; }
        }
      `}</style>

      {/* Toolbar */}
      <div className="no-print" style={{ display: 'flex', justifyContent: 'center', gap: '12px', padding: '20px 0 8px' }}>
        <button onClick={() => window.print()} style={{ background: '#7b2d8b', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 20px', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}>
          Imprimir / Salvar PDF
        </button>
        <button onClick={() => window.close()} style={{ background: '#e5e7eb', color: '#374151', border: 'none', borderRadius: '8px', padding: '8px 20px', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}>
          Fechar
        </button>
      </div>

      {/* Page */}
      <div className="page" style={{ maxWidth: '740px', margin: '0 auto 40px', background: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.12), 0 4px 16px rgba(0,0,0,0.08)', overflow: 'hidden' }}>

        {/* ── HEADER ── */}
        <div style={{ borderBottom: '3px solid #f5c800', padding: '22px 32px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <img src={acaiLogo} alt="Açaí Mix" style={{ width: '58px', height: '58px', borderRadius: '50%', objectFit: 'cover', objectPosition: 'center', flexShrink: 0 }} />
              <div>
                <div style={{ fontWeight: 800, fontSize: '18px', letterSpacing: '-0.3px', color: '#7b2d8b' }}>
                  AÇAÍ<span style={{ color: '#00b5a0' }}>MIX</span>
                </div>
                <div style={{ fontSize: '11px', color: '#6b7280', fontWeight: 500, letterSpacing: '0.5px' }}>SELF SERVICE</div>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontWeight: 700, fontSize: '15px', color: '#111827', letterSpacing: '-0.2px' }}>Relatório do Dia</div>
              <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '3px' }}>{fmtDateLong(refDate)}</div>
              <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
                {shifts.length} {shifts.length === 1 ? 'turno' : 'turnos'} · gerado {fmtTime(new Date().toISOString())}
              </div>
            </div>
          </div>
        </div>

        {/* ── DAY SUMMARY ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', borderBottom: '1px solid #e5e7eb' }}>
          {[
            { label: 'Total do Dia',    value: fmt(dayTotal),     accent: true },
            { label: 'Transações',      value: String(dayCount) },
            { label: 'Data',            value: fmtDateShort(refDate) },
          ].map((m, i) => (
            <div key={i} style={{ padding: '16px 24px', borderRight: i < 2 ? '1px solid #e5e7eb' : undefined }}>
              <div style={{ fontSize: '10px', fontWeight: 700, color: '#9ca3af', letterSpacing: '0.6px', textTransform: 'uppercase', marginBottom: '4px' }}>{m.label}</div>
              <div style={{ fontSize: m.accent ? '20px' : '15px', fontWeight: 700, color: m.accent ? '#059669' : '#111827', letterSpacing: '-0.3px', fontVariantNumeric: 'tabular-nums' }}>{m.value}</div>
            </div>
          ))}
        </div>

        {/* ── PER SHIFT SECTIONS ── */}
        {shifts.map((shift, idx) => {
          const shiftSales = salesByShift[shift.id] ?? []
          const shiftTotal = shiftSales.reduce((s, x) => s + x.amount, 0)
          const accentColor = SECTION_COLORS[idx % SECTION_COLORS.length]

          return (
            <div key={shift.id} style={{ borderBottom: idx < shifts.length - 1 ? '2px solid #f3f4f6' : undefined }}>

              {/* Shift header strip */}
              <div style={{ padding: '14px 32px', background: accentColor + '0d', borderBottom: '1px solid ' + accentColor + '30', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ display: 'inline-block', padding: '2px 10px', borderRadius: '99px', background: accentColor, color: 'white', fontWeight: 700, fontSize: '11px', letterSpacing: '0.3px' }}>
                    TURNO {shift.shift_number}
                  </span>
                  <span style={{ fontSize: '12px', color: '#6b7280' }}>
                    {fmtTime(shift.opened_at)} – {shift.closed_at ? fmtTime(shift.closed_at) : 'em aberto'}
                  </span>
                  <span style={{ fontSize: '11px', color: '#9ca3af' }}>· {elapsed(shift.opened_at, shift.closed_at)}</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '14px', fontWeight: 700, color: '#111827', fontVariantNumeric: 'tabular-nums' }}>{fmt(shiftTotal)}</span>
                  <span style={{ fontSize: '11px', color: '#9ca3af', marginLeft: '8px' }}>{shiftSales.length} vendas</span>
                </div>
              </div>

              {/* Shift body */}
              <div style={{ padding: '18px 32px' }}>
                {shiftSales.length > 0 ? (
                  <>
                    {/* Payment breakdown */}
                    <div style={{ marginBottom: '20px' }}>
                      <SectionTitle>Formas de Pagamento</SectionTitle>
                      <PaymentBreakdown sales={shiftSales} />
                    </div>

                    {/* Sales table */}
                    <SectionTitle>Vendas</SectionTitle>
                    <SalesTable sales={shiftSales} />
                  </>
                ) : (
                  <p style={{ color: '#9ca3af', fontSize: '12px', textAlign: 'center', padding: '16px 0' }}>
                    Nenhuma venda registrada neste turno.
                  </p>
                )}
              </div>
            </div>
          )
        })}

        {/* ── DAY TOTAL ROW ── */}
        {shifts.length > 1 && (
          <div style={{ borderTop: '2px solid #e5e7eb', padding: '14px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f9fafb' }}>
            <span style={{ fontWeight: 700, fontSize: '12px', color: '#374151', letterSpacing: '0.3px', textTransform: 'uppercase' }}>
              Total Geral do Dia
            </span>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontWeight: 800, fontSize: '18px', color: '#059669', fontVariantNumeric: 'tabular-nums' }}>{fmt(dayTotal)}</span>
              <span style={{ fontSize: '12px', color: '#9ca3af', marginLeft: '10px' }}>{dayCount} transações</span>
            </div>
          </div>
        )}

        {/* ── FOOTER ── */}
        <div style={{ borderTop: '1px solid #e5e7eb', padding: '10px 32px', display: 'flex', justifyContent: 'space-between', background: '#f9fafb' }}>
          <span style={{ fontSize: '10px', color: '#9ca3af' }}>Açaí Mix Self Service · {fmtDateLong(refDate)}</span>
          <span style={{ fontSize: '10px', color: '#d1d5db' }}>acaimix.app</span>
        </div>

      </div>
    </>
  )
}
