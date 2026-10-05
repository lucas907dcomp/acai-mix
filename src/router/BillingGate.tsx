import { Outlet } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { isBillingBlocked } from '@/lib/billing'

/**
 * Para o sistema quando a mensalidade vence (billing.paid_until + carência).
 *
 * Falha de leitura NÃO bloqueia: rede fora no meio do expediente não pode
 * travar o caixa. Quem bloqueia é só uma data vencida lida com sucesso.
 */
export function BillingGate() {
  const { data } = useQuery<string | null>({
    queryKey: ['billing'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('billing')
        .select('paid_until')
        .eq('id', 1)
        .maybeSingle()
      if (error) {
        console.warn('[Billing] Não consegui ler, liberando:', error.message)
        return null
      }
      return data?.paid_until ?? null
    },
    // Bloqueado, confere a cada 15s: o Pix confirma na hora e a loja tem que
    // voltar logo. Liberado, a cada 30 min basta para pegar o vencimento.
    refetchInterval: (q) => (isBillingBlocked(q.state.data) ? 15_000 : 30 * 60_000),
  })

  if (!isBillingBlocked(data)) return <Outlet />

  return (
    <div className="min-h-screen bg-[#0f0720] flex items-center justify-center p-6">
      <div className="max-w-md text-center text-white space-y-4">
        <h1 className="text-2xl font-bold">Sistema suspenso</h1>
        <p className="text-white/70">
          Há uma mensalidade em aberto. Avise o responsável pela loja — o sistema volta sozinho
          assim que o pagamento for confirmado.
        </p>
      </div>
    </div>
  )
}
