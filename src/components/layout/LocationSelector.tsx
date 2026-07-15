import { useState } from 'react'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/authStore'
import { useSyncStore } from '@/stores/syncStore'
import { useShiftStore } from '@/stores/shiftStore'
import { useSaleStore } from '@/stores/saleStore'
import { shouldBlockLocationSwitch } from '@/lib/syncGuard'

/**
 * Seletor de loja no header — visível apenas para `owner` (EPIC-11 /
 * Story 11.3). Troca a loja ativa via RPC `switch_active_location`;
 * os 16 hooks existentes refazem fetch sozinhos porque leem
 * `profile.location_id` na query key (decisão DA-1/DA-3) — nenhum
 * deles precisa ser alterado.
 */
export function LocationSelector() {
  const profile = useAuthStore((s) => s.profile)
  const switchActiveLocation = useAuthStore((s) => s.switchActiveLocation)
  const pendingCount = useSyncStore((s) => s.pendingCount)
  const isSyncing = useSyncStore((s) => s.isSyncing)
  const [isSwitching, setIsSwitching] = useState(false)

  if (!profile?.locations || profile.locations.length === 0) return null

  const syncBlocking = shouldBlockLocationSwitch(pendingCount, isSyncing)
  const disabled = isSwitching || syncBlocking

  async function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const nextLocationId = e.target.value
    if (nextLocationId === profile!.location_id) return

    // DA-4: bloqueia a troca com sync pendente, mesmo padrão de guarda
    // já usado em syncStore.cancelPending (EPIC-09).
    if (syncBlocking) {
      toast.error(
        'Não é possível trocar de loja com vendas offline pendentes de sincronização. Aguarde a sincronização terminar.'
      )
      return
    }

    setIsSwitching(true)
    try {
      await switchActiveLocation(nextLocationId)
      // AC6: limpa estado transitório da loja anterior antes de liberar
      // nova interação no PDV — turno ativo e venda em andamento não
      // devem "vazar" para a loja nova.
      useShiftStore.getState().clearShift()
      useSaleStore.getState().reset()
      toast.success('Loja trocada com sucesso.')
    } catch {
      toast.error('Não foi possível trocar de loja. Tente novamente.')
    } finally {
      setIsSwitching(false)
    }
  }

  return (
    <div className="px-3 py-1">
      <label htmlFor="location-selector" className="sr-only">
        Loja ativa
      </label>
      <select
        id="location-selector"
        value={profile.location_id}
        onChange={handleChange}
        disabled={disabled}
        title={syncBlocking ? 'Aguarde a sincronização de vendas offline terminar' : undefined}
        className="w-full bg-[#2d1550] text-white text-sm rounded-lg px-3 py-2 border border-[#4c1e8c] disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#9d7bc8]"
      >
        {profile.locations.map((loc) => (
          <option key={loc.id} value={loc.id}>
            {loc.name}
          </option>
        ))}
      </select>
    </div>
  )
}
