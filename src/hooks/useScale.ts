import { useEffect } from 'react'
import { MockScaleProvider } from '@/providers/scale/MockScaleProvider'
import { SerialScaleProvider } from '@/providers/scale/SerialScaleProvider'
import { ManualInputProvider } from '@/providers/scale/ManualInputProvider'
import { useScaleStore } from '@/stores/scaleStore'

export function useScale() {
  const { setProvider, updateWeight, updateConnection, disconnect } = useScaleStore()

  useEffect(() => {
    const useMock = import.meta.env.VITE_SCALE_MOCK === 'true'
    // Default to manual mode so the cashier never needs to click
    // "Digitar manualmente" on every page visit. Serial scale is
    // opt-in via the "Conectar Balança" button in ScaleConnectionStatus.
    const provider = useMock ? new MockScaleProvider() : new ManualInputProvider()

    setProvider(provider)

    const unsubWeight = provider.onWeight(updateWeight)
    const unsubConnection = provider.onConnectionChange(updateConnection)

    provider.connect().catch(() => {})

    return () => {
      unsubWeight()
      unsubConnection()
      disconnect()
    }
  }, [setProvider, updateWeight, updateConnection, disconnect])
}

export function useReconnectSerial() {
  const { setProvider, updateWeight, updateConnection, disconnect } = useScaleStore()

  async function reconnectSerial() {
    disconnect()
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
