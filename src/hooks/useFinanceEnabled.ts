import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

/**
 * Loja tem a seção Estoque / Financeiro? Consulta separada de useLocationData
 * de propósito: se a coluna faltar ou a rede cair, só a seção some; o resto
 * da loja que está vendendo não sente. `undefined` = ainda carregando.
 */
export function useFinanceEnabled(): boolean | undefined {
  const locationId = useAuthStore((s) => s.profile?.location_id)
  const { data } = useQuery<boolean>({
    queryKey: ['finance-enabled', locationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('locations')
        .select('finance_enabled')
        .eq('id', locationId!)
        .single()
      return !error && data?.finance_enabled === true
    },
    enabled: !!locationId,
    staleTime: 10 * 60_000,
  })
  return data
}
