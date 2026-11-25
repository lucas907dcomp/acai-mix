import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

type Chave = 'finance_enabled' | 'delivery_enabled' | 'employee_consumption_hidden' | 'shift_totals_hidden' | 'pay_by_item'

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
export const useConsumptionHidden = () => useLocationFlag('employee_consumption_hidden')
/** Pedido conjunto pago por partes: escolhe os itens de cada pagamento. */
export const usePayByItem = () => useLocationFlag('pay_by_item') === true
/** Mostra só com `false`: carregando (`undefined`) não pode piscar o total na tela. */
export const useShiftTotalsVisible = () => useLocationFlag('shift_totals_hidden') === false
