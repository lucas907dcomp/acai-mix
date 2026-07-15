import { describe, it, expect } from 'vitest'
import { satisfiesRequiredRole } from '../roleAccess'

describe('satisfiesRequiredRole', () => {
  it('permite qualquer role quando requiredRole não é especificado', () => {
    expect(satisfiesRequiredRole('staff', undefined)).toBe(true)
    expect(satisfiesRequiredRole(undefined, undefined)).toBe(true)
  })

  it('admin satisfaz requiredRole="admin"', () => {
    expect(satisfiesRequiredRole('admin', 'admin')).toBe(true)
  })

  it('staff NÃO satisfaz requiredRole="admin"', () => {
    expect(satisfiesRequiredRole('staff', 'admin')).toBe(false)
  })

  it('owner satisfaz requiredRole="admin" (opera como admin na loja ativa)', () => {
    expect(satisfiesRequiredRole('owner', 'admin')).toBe(true)
  })

  it('owner satisfaz qualquer requiredRole, incluindo "staff"', () => {
    expect(satisfiesRequiredRole('owner', 'staff')).toBe(true)
  })

  it('profile sem role (undefined) não satisfaz um requiredRole definido', () => {
    expect(satisfiesRequiredRole(undefined, 'admin')).toBe(false)
  })
})
