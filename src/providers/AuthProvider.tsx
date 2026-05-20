import { useEffect, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

async function resolveProfile(userId: string) {
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('id, location_id, role, display_name, created_at')
    .eq('id', userId)
    .single()
  return profile
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const setAuth = useAuthStore((s) => s.setAuth)
  const clearAuth = useAuthStore((s) => s.clearAuth)
  const isLoading = useAuthStore((s) => s.isLoading)

  useEffect(() => {
    let cancelled = false

    // Explicit session check on mount — reliable across all Supabase JS versions
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (cancelled) return

      if (session) {
        const profile = await resolveProfile(session.user.id)
        if (cancelled) return
        if (profile) {
          setAuth(session.user, {
            id: profile.id,
            location_id: profile.location_id ?? '',
            role: profile.role as 'admin' | 'staff',
            display_name: profile.display_name ?? '',
            created_at: profile.created_at,
          })
        } else {
          clearAuth()
        }
      } else {
        clearAuth()
      }
    }).catch(() => {
      if (!cancelled) clearAuth()
    })

    // Listener for subsequent auth changes (sign-in via useAuth, sign-out, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (cancelled) return
        // INITIAL_SESSION handled by getSession above
        if (event === 'INITIAL_SESSION') return
        if (!session) {
          clearAuth()
        }
      }
    )

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [setAuth, clearAuth])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0f0720] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#4c1e8c] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return <>{children}</>
}
