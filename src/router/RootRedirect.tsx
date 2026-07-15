import { Navigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'

export default function RootRedirect() {
  const user = useAuthStore((s) => s.user)
  const profile = useAuthStore((s) => s.profile)
  const isLoading = useAuthStore((s) => s.isLoading)

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0f0720] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#4c1e8c] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />
  // EPIC-11 / Story 11.3 — owner opera como admin dentro da loja ativa.
  // TODO(11.4): trocar para '/overview' quando a rota da Visão Geral
  // existir; até lá, /dashboard é o destino mais próximo do papel dele.
  if (profile?.role === 'admin' || profile?.role === 'owner') {
    return <Navigate to="/dashboard" replace />
  }
  return <Navigate to="/pos" replace />
}
