import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import type { EmployeeConsumption, UserProfile } from '@/types'

export function useStaffMembers() {
  const profile = useAuthStore((s) => s.profile)
  return useQuery({
    queryKey: ['staff-members', profile?.location_id],
    enabled: !!profile?.location_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('location_id', profile!.location_id)
        .eq('role', 'staff')
        .order('display_name')
      if (error) throw error
      return data as UserProfile[]
    },
  })
}

export function useEmployeeConsumptions(year: number, month: number) {
  const profile = useAuthStore((s) => s.profile)
  const from = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const to = `${year}-${String(month).padStart(2, '0')}-${lastDay}`

  return useQuery({
    queryKey: ['employee-consumptions', profile?.location_id, year, month],
    enabled: !!profile?.location_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employee_consumptions')
        .select('*')
        .eq('location_id', profile!.location_id)
        .gte('consumed_at', from)
        .lte('consumed_at', to)
        .order('consumed_at', { ascending: false })
      if (error) throw error
      return data as EmployeeConsumption[]
    },
  })
}

export function useAddConsumption() {
  const profile = useAuthStore((s) => s.profile)
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: {
      user_id: string
      amount: number
      description: string
      consumed_at: string
    }) => {
      const { error } = await supabase.from('employee_consumptions').insert({
        ...payload,
        location_id: profile!.location_id,
        created_by: profile!.id,
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee-consumptions'] })
    },
  })
}

export function useDeleteConsumption() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('employee_consumptions').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee-consumptions'] })
    },
  })
}
