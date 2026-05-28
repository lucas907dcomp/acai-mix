import { useEffect } from 'react'
import { MockScaleProvider } from '@/providers/scale/MockScaleProvider'
import { SerialScaleProvider } from '@/providers/scale/SerialScaleProvider'
import { ManualInputProvider } from '@/providers/scale/ManualInputProvider'
import { useScaleStore } from '@/stores/scaleStore'

export function useScale() {
  const { setProvider, updateWeight, updateConnection } = useScaleStore()

  useEffect(() => {
    // If a provider is already active (e.g. serial connected), just re-subscribe
    // to its callbacks — don't create a new provider or disconnect the existing one.
    const existing = useScaleStore.getState().provider

    let activeProvider = existing

    if (!existing) {
      // First mount: start in manual mode (or mock in dev).
      // Serial is opt-in via the "Conectar Balança" button.
      const useMock = import.meta.env.VITE_SCALE_MOCK === 'true'
      activeProvider = useMock ? new MockScaleProvider() : new ManualInputProvider()
      setProvider(activeProvider)
      activeProvider.connect().catch(() => {})
    }

    const unsubWeight = activeProvider!.onWeight(updateWeight)
    const unsubConnection = activeProvider!.onConnectionChange(updateConnection)

    return () => {
      unsubWeight()
      unsubConnection()
      // Do NOT disconnect here — the serial provider must survive route changes.
      // Disconnection only happens explicitly via the UI button.
    }
  }, [setProvider, updateWeight, updateConnection])
}

export function useReconnectSerial() {
  const { setProvider, updateWeight, updateConnection, disconnect } = useScaleStore()

  async function reconnectSerial() {
    await disconnect()
    const provider = new SerialScaleProvider()
    setProvider(provider)
    provider.onWeight(updateWeight)
    provider.onConnectionChange(updateConnection)
    await provider.connect()
  }

  return { reconnectSerial }
}

export function useSwitchToManual() {
  const { setProvider, updateWeight, updateConnection, closeManualDialog } = useScaleStore()

  function confirmManual() {
    const provider = new ManualInputProvider()
    setProvider(provider)

    const unsubWeight = provider.onWeight(updateWeight)
    const unsubConnection = provider.onConnectionChange(updateConnection)

    provider.connect()
    closeManualDialog()

    return () => {
      unsubWeight()
      unsubConnection()
    }
  }

  return { confirmManual }
}
