import type { UserRole } from '@/types'

/**
 * EPIC-11 / Story 11.3 — `owner` satisfaz qualquer `requiredRole` (opera
 * como admin dentro da loja ativa). Extraído de `ProtectedRoute` como
 * função pura para ser testável sem depender de renderização de
 * componente (o projeto não tem `@testing-library/react` instalado).
 */
export function satisfiesRequiredRole(
  profileRole: UserRole | undefined,
  requiredRole?: UserRole
): boolean {
  if (!requiredRole) return true
  if (profileRole === requiredRole) return true
  return profileRole === 'owner'
}
