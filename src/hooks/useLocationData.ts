import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

export interface LocationData {
  id: string
  name: string
  address: string | null
  brand_name: string | null
  single_operator: boolean
  ask_operator_name: boolean
}

export function useLocationData() {
  const locationId = useAuthStore((s) => s.profile?.location_id)

  return useQuery<LocationData>({
    queryKey: ['location', locationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('locations')
        .select('id, name, address, brand_name, single_operator, ask_operator_name')
        .eq('id', locationId!)
        .single()
      if (error) throw error
      return { id: data.id, name: data.name, address: data.address, brand_name: data.brand_name, single_operator: data.single_operator, ask_operator_name: data.ask_operator_name }
    },
    enabled: !!locationId,
    staleTime: 10 * 60_000,
  })
}
