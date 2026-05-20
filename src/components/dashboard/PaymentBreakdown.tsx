import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

const fmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

interface PaymentBreakdownProps {
  pix: number
  card: number
  cash: number
  total: number
  isLoading?: boolean
}

const METHODS = [
  { key: 'pix', label: 'PIX', color: 'bg-green-500' },
  { key: 'card', label: 'Cartão', color: 'bg-blue-500' },
  { key: 'cash', label: 'Dinheiro', color: 'bg-yellow-500' },
] as const

export function PaymentBreakdown({ pix, card, cash, total, isLoading }: PaymentBreakdownProps) {
  const values = { pix, card, cash }

  return (
    <Card className="bg-[#1a0b2e] border-[#2d1550]">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-[#9d7bc8]">Por Tipo de Pagamento</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <>
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </>
        ) : (
          <>
            {/* Barra proporcional */}
            {total > 0 && (
              <div className="flex h-2 rounded-full overflow-hidden gap-0.5">
                {METHODS.map(({ key, color }) => {
                  const pct = total > 0 ? (values[key] / total) * 100 : 0
                  if (pct === 0) return null
                  return (
                    <div
                      key={key}
                      className={`${color} opacity-80 transition-all`}
                      style={{ width: `${pct}%` }}
                    />
                  )
                })}
              </div>
            )}

            {/* Linhas por método */}
            <div className="space-y-2">
              {METHODS.map(({ key, label, color }) => {
                const value = values[key]
                const pct = total > 0 ? (value / total) * 100 : 0
                return (
                  <div key={key} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${color} opacity-80 flex-shrink-0`} />
                      <span className="text-sm text-[#9d7bc8]">{label}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-[#9d7bc8]">{pct.toFixed(1)}%</span>
                      <span className="text-sm font-medium text-white w-28 text-right">
                        {fmt.format(value)}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
