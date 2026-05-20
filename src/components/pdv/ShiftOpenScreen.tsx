import { PlayCircle } from 'lucide-react'
import { useShiftStore } from '@/stores/shiftStore'
import { useAuthStore } from '@/stores/authStore'

export function ShiftOpenScreen() {
  const openShift = useShiftStore((s) => s.openShift)
  const isLoading = useShiftStore((s) => s.isLoading)
  const error = useShiftStore((s) => s.error)
  const profile = useAuthStore((s) => s.profile)

  async function handleOpen() {
    if (!profile) return
    await openShift(profile.location_id, profile.id)
  }

  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 text-center p-8">
      <div className="w-20 h-20 rounded-full bg-[#1a0b2e] border-2 border-[#4c1e8c] flex items-center justify-center">
        <PlayCircle className="w-10 h-10 text-[#7c3aed]" />
      </div>

      <div>
        <h2 className="text-2xl font-bold text-white mb-2">Nenhum turno ativo</h2>
        <p className="text-[#9d7bc8]">
          Abra o turno para começar a registrar vendas.
        </p>
      </div>

      {error && (
        <p className="text-red-400 text-sm">{error}</p>
      )}

      <button
        onClick={handleOpen}
        disabled={isLoading}
        className="px-8 py-3 bg-[#4c1e8c] hover:bg-[#5d2aa8] disabled:opacity-50 text-white font-semibold rounded-xl transition-colors text-lg"
      >
        {isLoading ? 'Abrindo...' : 'Abrir Turno'}
      </button>
    </div>
  )
}
