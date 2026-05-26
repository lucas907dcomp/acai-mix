import { format } from 'date-fns'
import type { SaleWithProduct } from '@/types'

const SEP = ';'
const CRLF = '\n'
const BOM = '﻿'

const PAYMENT_MAP: Record<string, string> = {
  pix: 'PIX',
  credit: 'CARTAO',
  debit: 'CARTAO',
  cash: 'DINHEIRO',
}

const fmt = (n: number, places: number) => n.toFixed(places).replace('.', ',')

// CRITICAL: existing columns MUST stay in the same positions (Risk R8 — contador spreadsheets).
// New columns are appended at the END only.
const HEADER = [
  'Data/Hora', 'Peso (g)', 'Preço/g (R$)', 'Valor (R$)', 'Pagamento', 'Status',
  'Produto', 'Tipo', 'Quantidade', 'Casquinha',
].join(SEP)

const PRODUCT_TYPE_LABEL: Record<string, string> = {
  weight: 'por peso',
  unit: 'unidade',
}

export function buildCsvString(sales: SaleWithProduct[]): string {
  const rows = sales.map((s) => {
    const status = (s.status ?? 'COMPLETED') === 'CANCELLED' ? 'CANCELADA' : 'ATIVA'
    const productName = s.products?.name ?? '—'
    const productType = s.products?.product_type ? (PRODUCT_TYPE_LABEL[s.products.product_type] ?? s.products.product_type) : '—'
    const quantity = s.quantity ?? 1
    const casquinha = s.has_casquinha ? 'SIM' : 'NAO'
    return [
      new Date(s.created_at).toISOString(),
      s.weight_grams.toString(),
      fmt(s.price_per_gram, 4),
      fmt(s.amount, 2),
      PAYMENT_MAP[s.payment_method] ?? s.payment_method.toUpperCase(),
      status,
      productName,
      productType,
      quantity.toString(),
      casquinha,
    ].join(SEP)
  })
  return BOM + [HEADER, ...rows].join(CRLF)
}

export function generateSalesCsv(sales: SaleWithProduct[], from: Date, to: Date): void {
  const csv = buildCsvString(sales)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `acaipro-vendas-${format(from, 'yyyy-MM-dd')}-a-${format(to, 'yyyy-MM-dd')}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
