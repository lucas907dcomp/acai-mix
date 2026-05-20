import { useScaleStore } from '@/stores/scaleStore'

export function ScaleConnectionStatus() {
  const isConnected = useScaleStore((s) => s.isConnected)
  const providerType = useScaleStore((s) => s.providerType)
  const openManualDialog = useScaleStore((s) => s.openManualDialog)

  const badge =
    providerType === 'manual'
      ? { label: 'Modo Manual', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' }
      : isConnected
        ? { label: 'Balança Conectada', color: 'bg-green-500/20 text-green-400 border-green-500/30' }
        : { label: 'Balança Desconectada', color: 'bg-red-500/20 text-red-400 border-red-500/30' }

  return (
    <div className="flex items-center gap-3">
      <span
        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-medium ${badge.color}`}
        aria-live="polite"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-current" />
        {badge.label}
      </span>

      {!isConnected && providerType !== 'manual' && (
        <button
          onClick={openManualDialog}
          className="text-xs text-[#9d7bc8] hover:text-white underline transition-colors"
        >
          Digitar manualmente
        </button>
      )}
    </div>
  )
}
