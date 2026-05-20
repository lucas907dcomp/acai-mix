import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

const fmt = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 4,
  maximumFractionDigits: 4,
})

interface HistoryRow {
  id: string
  old_price: number
  new_price: number
  changed_at: string
}

interface PriceHistoryProps {
  productId: string
}

export function PriceHistory({ productId }: PriceHistoryProps) {
  const { data, isLoading } = useQuery<HistoryRow[]>({
    queryKey: ['price-history', productId],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('product_price_history')
        .select('id, old_price, new_price, changed_at')
        .eq('product_id', productId)
        .order('changed_at', { ascending: false })
        .limit(10)
      if (error) throw error
      return (data ?? []) as HistoryRow[]
    },
    enabled: !!productId,
    staleTime: 30_000,
  })

  return (
    <Card className="bg-[#1a0b2e] border-[#2d1550]">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-[#9d7bc8]">Histórico de Preços</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : !data?.length ? (
          <p className="text-center text-[#9d7bc8] text-sm py-6">
            Nenhuma alteração de preço registrada.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#2d1550]">
                  <th className="py-2 px-4 text-left text-xs text-[#9d7bc8] font-medium">Data</th>
                  <th className="py-2 px-4 text-right text-xs text-[#9d7bc8] font-medium">Anterior</th>
                  <th className="py-2 px-4 text-right text-xs text-[#9d7bc8] font-medium">Novo</th>
                </tr>
              </thead>
              <tbody>
                {data.map((row) => (
                  <tr key={row.id} className="border-b border-[#2d1550]/50">
                    <td className="py-2.5 px-4 text-[#9d7bc8]">
                      {format(new Date(row.changed_at), "dd/MM/yy 'às' HH:mm", { locale: ptBR })}
                    </td>
                    <td className="py-2.5 px-4 text-right text-[#9d7bc8]">
                      R${fmt.format(Number(row.old_price))}
                    </td>
                    <td className="py-2.5 px-4 text-right text-white font-medium">
                      R${fmt.format(Number(row.new_price))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
