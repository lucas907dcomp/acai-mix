import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

interface LoginCredentials {
  email: string
  password: string
}

interface UseAuthReturn {
  login: (credentials: LoginCredentials) => Promise<void>
  isLoading: boolean
  error: string | null
}

export function useAuth(): UseAuthReturn {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)

  async function login({ email, password }: LoginCredentials) {
    setIsLoading(true)
    setError(null)

    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (authError) {
        setError('Email ou senha inválidos. Verifique suas credenciais.')
        return
      }

      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('id, location_id, role, display_name, created_at')
        .eq('id', authData.user.id)
        .single()

      if (profileError || !profile) {
        setError('Perfil de usuário não encontrado. Contate o administrador.')
        await supabase.auth.signOut()
        return
      }

      setAuth(authData.user, {
        id: profile.id,
        location_id: profile.location_id ?? '',
        role: profile.role as 'admin' | 'staff',
        display_name: profile.display_name ?? '',
        created_at: profile.created_at,
      })

      if (profile.role === 'admin') {
        navigate('/dashboard')
      } else {
        navigate('/pos')
      }
    } finally {
      setIsLoading(false)
    }
  }

  return { login, isLoading, error }
}
