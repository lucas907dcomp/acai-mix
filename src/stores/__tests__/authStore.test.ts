import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useAuthStore } from '../authStore'
import type { UserProfile } from '@/types'

const rpcMock = vi.fn()

vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpcMock(...args),
  },
}))

const baseProfile: UserProfile = {
  id: 'owner-1',
  location_id: 'loja-1',
  role: 'owner',
  display_name: 'Owner Teste',
  created_at: new Date().toISOString(),
  locations: [
    { id: 'loja-1', name: 'Loja 1' },
    { id: 'loja-2', name: 'Loja 2' },
  ],
}

beforeEach(() => {
  rpcMock.mockReset()
  useAuthStore.setState({
    user: { id: 'owner-1' } as never,
    profile: { ...baseProfile },
    isLoading: false,
  })
})

describe('authStore.switchActiveLocation', () => {
  it('sucesso: chama a RPC e atualiza profile.location_id', async () => {
    rpcMock.mockResolvedValue({ error: null })

    await useAuthStore.getState().switchActiveLocation('loja-2')

    expect(rpcMock).toHaveBeenCalledWith('switch_active_location', { p_location_id: 'loja-2' })
    expect(useAuthStore.getState().profile?.location_id).toBe('loja-2')
  })

  it('falha (RLS/loja não vinculada): não altera profile.location_id e propaga o erro', async () => {
    const rpcError = new Error('location not linked to current owner')
    rpcMock.mockResolvedValue({ error: rpcError })

    await expect(useAuthStore.getState().switchActiveLocation('loja-fake')).rejects.toThrow(
      'location not linked'
    )
    expect(useAuthStore.getState().profile?.location_id).toBe('loja-1')
  })
})
