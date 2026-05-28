import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import acaiLogo from '@/assets/acai-mix-logo.jpg'
import type { Shift, Sale } from '@/types'

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })

function elapsed(openedAt: string, closedAt: string | null): string {
  const end = closedAt ? new Date(closedAt) : new Date()
  const mins = Math.round((end.getTime() - new Date(openedAt).getTime()) / 60000)
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return h > 0 ? `${h}h ${m}min` : `${m}min`
}

const PAYMENT_META: Record<string, { label: string; color: string }> = {
  pix:     { label: 'PIX',      color: '#059669' },
  credit:  { label: 'Crédito',  color: '#2563eb' },
  debit:   { label: 'Débito',   color: '#7c3aed' },
  cash:    { label: 'Dinheiro', color: '#d97706' },
}

export default function ShiftReport() {
  const [params] = useSearchParams()
  const shiftId = params.get('shiftId')

  const [shift, setShift] = useState<Shift | null>(null)
  const [sales, setSales] = useState<Sale[]>([])
  const [loading, setLoading] = useState(!!shiftId)
  const [fetchError, setFetchError] = useState<string | null>(null)

  useEffect(() => {
    if (!shiftId) return
    async function load() {
      const [{ data: shiftData, error: shiftErr }, { data: salesData, error: salesErr }] =
        await Promise.all([
          supabase.from('shifts').select('*').eq('id', shiftId!).single(),
          supabase
            .from('sales')
            .select('*')
            .eq('shift_id', shiftId!)
            .neq('status', 'CANCELLED')
            .order('created_at'),
        ])
      if (shiftErr || salesErr) {
        setFetchError(shiftErr?.message ?? salesErr?.message ?? 'Erro ao carregar dados.')
        setLoading(false)
        return
      }
      setShift(shiftData as Shift)
      setSales((salesData as Sale[]) ?? [])
      setLoading(false)
    }
    load()
  }, [shiftId])

  useEffect(() => {
    if (!loading && shift && !fetchError) {
      const t = setTimeout(() => window.print(), 400)
      return () => clearTimeout(t)
    }
  }, [loading, shift, fetchError])

  const errorMsg = !shiftId ? 'ID do turno não informado.' : fetchError

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-white text-gray-400 text-sm">
        Carregando relatório...
      </div>
    )
  }

  if (errorMsg || !shift) {
    return (
      <div className="flex items-center justify-center h-screen bg-white text-red-500 text-sm">
        {errorMsg ?? 'Turno não encontrado.'}
      </div>
    )
  }

  const activeSales = sales.filter((s) => s.status !== 'CANCELLED')
  const grandTotal = activeSales.reduce((sum, s) => sum + s.amount, 0)

  const paymentRows = ['pix', 'credit', 'debit', 'cash'].map((method) => {
    const ms = activeSales.filter((s) => s.payment_method === method)
    const total = ms.reduce((sum, s) => sum + s.amount, 0)
    return {
      method,
      ...PAYMENT_META[method],
      total,
      count: ms.length,
      pct: grandTotal > 0 ? (total / grandTotal) * 100 : 0,
    }
  })

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          background: #f1f5f9;
          font-family: 'Inter', 'Segoe UI', system-ui, sans-serif;
          color: #111827;
          font-size: 13px;
          line-height: 1.5;
        }
        @media print {
          @page { margin: 12mm 14mm; size: A4; }
          body {
            background: white !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .no-print { display: none !important; }
          .page { box-shadow: none !important; margin: 0 !important; border-radius: 0 !important; }
        }
      `}</style>

      {/* Toolbar — hidden on print */}
      <div className="no-print flex items-center justify-center gap-3 py-5">
        <button
          onClick={() => window.print()}
          style={{ background: '#7b2d8b', color: 'white' }}
          className="px-5 py-2 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          Imprimir / Salvar PDF
        </button>
        <button
          onClick={() => window.close()}
          className="px-5 py-2 rounded-lg text-sm font-semibold bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors"
        >
          Fechar
        </button>
      </div>

      {/* Page */}
      <div
        className="page"
        style={{
          maxWidth: '720px',
          margin: '0 auto 40px',
          background: 'white',
          borderRadius: '8px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.12), 0 4px 16px rgba(0,0,0,0.08)',
          overflow: 'hidden',
        }}
      >

        {/* ── HEADER ─────────────────────────────────────────── */}
        <div style={{ borderBottom: '3px solid #f5c800', padding: '24px 32px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>

            {/* Logo + brand */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <img
                src={acaiLogo}
                alt="Açaí Mix"
                style={{
                  width: '60px',
                  height: '60px',
                  borderRadius: '50%',
                  objectFit: 'cover',
                  objectPosition: 'center',
                  flexShrink: 0,
                }}
              />
              <div>
                <div style={{ fontWeight: 800, fontSize: '18px', letterSpacing: '-0.3px', color: '#7b2d8b' }}>
                  AÇAÍ<span style={{ color: '#00b5a0' }}>MIX</span>
                </div>
                <div style={{ fontSize: '11px', color: '#6b7280', fontWeight: 500, letterSpacing: '0.5px' }}>
                  SELF SERVICE
                </div>
              </div>
            </div>

            {/* Document title */}
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontWeight: 700, fontSize: '15px', color: '#111827', letterSpacing: '-0.2px' }}>
                Relatório de Turno
              </div>
              <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>
                {fmtDate(shift.opened_at)}
              </div>
              <div style={{
                display: 'inline-block',
                marginTop: '6px',
                padding: '2px 10px',
                borderRadius: '99px',
                background: '#f5c800',
                color: '#78350f',
                fontWeight: 700,
                fontSize: '11px',
                letterSpacing: '0.3px',
              }}>
                TURNO {shift.shift_number}
              </div>
            </div>
          </div>
        </div>

        {/* ── METRICS ROW ────────────────────────────────────── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          borderBottom: '1px solid #e5e7eb',
        }}>
          {[
            { label: 'Total do Turno', value: fmt(grandTotal), accent: true },
            { label: 'Transações',     value: String(activeSales.length) },
            { label: 'Período',        value: `${fmtTime(shift.opened_at)} – ${shift.closed_at ? fmtTime(shift.closed_at) : 'aberto'}` },
            { label: 'Duração',        value: elapsed(shift.opened_at, shift.closed_at) },
          ].map((m, i) => (
            <div
              key={i}
              style={{
                padding: '16px 20px',
                borderRight: i < 3 ? '1px solid #e5e7eb' : undefined,
              }}
            >
              <div style={{ fontSize: '10px', fontWeight: 600, color: '#9ca3af', letterSpacing: '0.6px', textTransform: 'uppercase', marginBottom: '4px' }}>
                {m.label}
              </div>
              <div style={{
                fontSize: m.accent ? '18px' : '14px',
                fontWeight: 700,
                color: m.accent ? '#059669' : '#111827',
                letterSpacing: m.accent ? '-0.5px' : '-0.2px',
              }}>
                {m.value}
              </div>
            </div>
          ))}
        </div>

        {/* ── PAYMENT BREAKDOWN ──────────────────────────────── */}
        <div style={{ padding: '20px 32px', borderBottom: '1px solid #e5e7eb' }}>
          <div style={{
            fontSize: '10px', fontWeight: 700, color: '#9ca3af',
            letterSpacing: '0.8px', textTransform: 'uppercase',
            borderLeft: '3px solid #f5c800', paddingLeft: '8px', marginBottom: '14px',
          }}>
            Formas de Pagamento
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {paymentRows.map((row) => (
              <div key={row.method}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{
                      width: '8px', height: '8px', borderRadius: '50%',
                      background: row.color, flexShrink: 0, display: 'inline-block',
                    }} />
                    <span style={{ fontWeight: 600, color: '#374151', fontSize: '12px' }}>{row.label}</span>
                    <span style={{ color: '#9ca3af', fontSize: '11px' }}>
                      {row.count} {row.count === 1 ? 'venda' : 'vendas'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ color: '#6b7280', fontSize: '11px', minWidth: '32px', textAlign: 'right' }}>
                      {row.pct.toFixed(1)}%
                    </span>
                    <span style={{ fontWeight: 700, color: '#111827', fontSize: '13px', minWidth: '80px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      {fmt(row.total)}
                    </span>
                  </div>
                </div>
                <div style={{ height: '4px', background: '#f3f4f6', borderRadius: '2px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${row.pct}%`, background: row.color, borderRadius: '2px' }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── SALES TABLE ────────────────────────────────────── */}
        <div style={{ padding: '20px 32px 28px' }}>
          <div style={{
            fontSize: '10px', fontWeight: 700, color: '#9ca3af',
            letterSpacing: '0.8px', textTransform: 'uppercase',
            borderLeft: '3px solid #f5c800', paddingLeft: '8px', marginBottom: '14px',
          }}>
            Detalhamento de Vendas
          </div>

          {activeSales.length === 0 ? (
            <p style={{ color: '#9ca3af', textAlign: 'center', padding: '24px 0', fontSize: '13px' }}>
              Nenhuma venda registrada neste turno.
            </p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                  {['#', 'Horário', 'Descrição', 'Peso / Qtd', 'Valor', 'Pagamento'].map((h, i) => (
                    <th key={i} style={{
                      padding: '6px 8px',
                      textAlign: i >= 3 ? 'right' : 'left',
                      fontSize: '10px',
                      fontWeight: 700,
                      color: '#9ca3af',
                      letterSpacing: '0.5px',
                      textTransform: 'uppercase',
                      whiteSpace: 'nowrap',
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {activeSales.map((sale, i) => {
                  const meta = PAYMENT_META[sale.payment_method]
                  const isWeight = sale.weight_grams > 0 && !sale.is_combined
                  const desc = sale.is_combined
                    ? `Pedido conjunto — ${sale.combined_order_name ?? 'Conjunto'}`
                    : isWeight
                      ? `Açaí self service${sale.has_casquinha ? ' + casquinha' : ''}`
                      : 'Produto avulso'
                  const detail = isWeight
                    ? `${sale.weight_grams}g`
                    : sale.quantity
                      ? `${sale.quantity}×`
                      : '—'

                  return (
                    <tr
                      key={sale.id}
                      style={{ background: i % 2 === 0 ? 'white' : '#f9fafb', borderBottom: '1px solid #f3f4f6' }}
                    >
                      <td style={{ padding: '7px 8px', color: '#9ca3af', fontSize: '11px', fontVariantNumeric: 'tabular-nums' }}>
                        {i + 1}
                      </td>
                      <td style={{ padding: '7px 8px', color: '#6b7280', fontSize: '12px', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                        {fmtTime(sale.created_at)}
                      </td>
                      <td style={{ padding: '7px 8px', color: '#111827', fontSize: '12px', maxWidth: '200px' }}>
                        {desc}
                      </td>
                      <td style={{ padding: '7px 8px', color: '#6b7280', fontSize: '12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        {detail}
                      </td>
                      <td style={{ padding: '7px 8px', fontWeight: 600, color: '#111827', fontSize: '12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                        {fmt(sale.amount)}
                      </td>
                      <td style={{ padding: '7px 8px', textAlign: 'right' }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '2px 7px',
                          borderRadius: '4px',
                          fontSize: '10px',
                          fontWeight: 700,
                          letterSpacing: '0.3px',
                          background: meta.color + '18',
                          color: meta.color,
                          whiteSpace: 'nowrap',
                        }}>
                          {meta.label}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: '2px solid #e5e7eb' }}>
                  <td colSpan={3} style={{ padding: '10px 8px 0', color: '#6b7280', fontSize: '11px' }}>
                    {activeSales.length} {activeSales.length === 1 ? 'transação' : 'transações'}
                  </td>
                  <td />
                  <td style={{ padding: '10px 8px 0', textAlign: 'right', fontWeight: 800, fontSize: '15px', color: '#111827', fontVariantNumeric: 'tabular-nums' }}>
                    {fmt(grandTotal)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          )}
        </div>

        {/* ── FOOTER ─────────────────────────────────────────── */}
        <div style={{
          borderTop: '1px solid #e5e7eb',
          padding: '10px 32px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: '#f9fafb',
        }}>
          <span style={{ fontSize: '10px', color: '#9ca3af' }}>
            Açaí Mix Self Service · Turno {shift.shift_number} · {fmtDate(shift.opened_at)}
          </span>
          <span style={{ fontSize: '10px', color: '#d1d5db' }}>
            Gerado em {fmtTime(new Date().toISOString())}
          </span>
        </div>

      </div>
    </>
  )
}
