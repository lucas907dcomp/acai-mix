import { create } from 'zustand'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { UserProfile } from '@/types'

interface AuthState {
  user: User | null
  profile: UserProfile | null
  isLoading: boolean
  setAuth: (user: User, profile: UserProfile) => void
  setLoading: (loading: boolean) => void
  clearAuth: () => void
  switchActiveLocation: (locationId: string) => Promise<void>
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  profile: null,
  isLoading: true,
  setAuth: (user, profile) => set({ user, profile, isLoading: false }),
  setLoading: (isLoading) => set({ isLoading }),
  clearAuth: () => set({ user: null, profile: null, isLoading: false }),

  // EPIC-11 / Story 11.3 — troca de loja ativa (owner only). A guarda de
  // sync pendente (DA-4) e a limpeza de estado transitório (AC6) ficam
  // no componente chamador (LocationSelector), não aqui — evita import
  // circular entre authStore e syncStore/saleStore (ambos já importam
  // authStore hoje).
  switchActiveLocation: async (locationId) => {
    const { error } = await supabase.rpc('switch_active_location', {
      p_location_id: locationId,
    })

    if (error) throw error

    const { profile } = get()
    if (profile) {
      set({ profile: { ...profile, location_id: locationId } })
    }
  },
}))
