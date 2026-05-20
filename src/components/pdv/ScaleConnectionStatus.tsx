import { useState } from 'react'
import { useScaleStore } from '@/stores/scaleStore'

export function ScaleConnectionStatus() {
  const isConnected = useScaleStore((s) => s.isConnected)
  const providerType = useScaleStore((s) => s.providerType)
  const openManualDialog = useScaleStore((s) => s.openManualDialog)
  const connectScale = useScaleStore((s) => s.connectScale)
  const [isConnecting, setIsConnecting] = useState(false)

  const badge =
    providerType === 'manual'
      ? { label: 'Modo Manual', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' }
      : isConnected
        ? { label: 'Balança Conectada', color: 'bg-green-500/20 text-green-400 border-green-500/30' }
        : { label: 'Balança Desconectada', color: 'bg-red-500/20 text-red-400 border-red-500/30' }

  async function handleConnect() {
    setIsConnecting(true)
    try {
      await connectScale()
    } catch {
      // User cancelled port selection or connection failed — silent
    } finally {
      setIsConnecting(false)
    }
  }

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <span
        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-medium ${badge.color}`}
        aria-live="polite"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-current" />
        {badge.label}
      </span>

      {!isConnected && providerType === 'serial' && (
        <button
          onClick={handleConnect}
          disabled={isConnecting}
          className="text-xs px-3 py-1.5 rounded-lg bg-[#2d1550] text-[#9d7bc8] hover:bg-[#3d1f6e] hover:text-white disabled:opacity-50 transition-colors font-medium"
        >
          {isConnecting ? 'Conectando...' : 'Conectar Balança'}
        </button>
      )}

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
