import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { satisfiesRequiredRole } from '@/router/roleAccess'
import type { UserRole } from '@/types'

interface ProtectedRouteProps {
  requiredRole?: UserRole
}

export function ProtectedRoute({ requiredRole }: ProtectedRouteProps) {
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

  if (!user) {
    return <Navigate to="/login" replace />
  }

  // EPIC-11 / Story 11.3 — owner satisfaz qualquer requiredRole (opera
  // como admin dentro da loja ativa).
  if (!satisfiesRequiredRole(profile?.role, requiredRole)) {
    return <Navigate to="/pos" replace />
  }

  return <Outlet />
}
