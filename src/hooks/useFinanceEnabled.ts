import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

type Chave = 'finance_enabled' | 'delivery_enabled'

/**
 * Loja tem a seção ligada? Consulta separada de useLocationData de propósito:
 * se a coluna faltar ou a rede cair, só a seção some; o resto da loja que está
 * vendendo não sente. `undefined` = ainda carregando.
 */
function useLocationFlag(chave: Chave): boolean | undefined {
  const locationId = useAuthStore((s) => s.profile?.location_id)
  const { data } = useQuery<boolean>({
    queryKey: [chave, locationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('locations')
        .select(chave)
        .eq('id', locationId!)
        .single()
      return !error && (data as Record<Chave, boolean> | null)?.[chave] === true
    },
    enabled: !!locationId,
    staleTime: 10 * 60_000,
  })
  return data
}

export const useFinanceEnabled = () => useLocationFlag('finance_enabled')
export const useDeliveryEnabled = () => useLocationFlag('delivery_enabled')
