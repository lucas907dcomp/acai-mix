import { useEffect } from 'react'
import { MockScaleProvider } from '@/providers/scale/MockScaleProvider'
import { SerialScaleProvider } from '@/providers/scale/SerialScaleProvider'
import { ManualInputProvider } from '@/providers/scale/ManualInputProvider'
import { useScaleStore } from '@/stores/scaleStore'

export function useScale() {
  const { setProvider, updateWeight, updateConnection, openManualDialog, disconnect } =
    useScaleStore()

  useEffect(() => {
    const useMock = import.meta.env.VITE_SCALE_MOCK === 'true'
    const provider = useMock ? new MockScaleProvider() : new SerialScaleProvider()

    setProvider(provider)

    const unsubWeight = provider.onWeight(updateWeight)
    const unsubConnection = provider.onConnectionChange(updateConnection)

    provider.connect().catch(() => {
      // Connection failed — user can activate manual mode via dialog
    })

    return () => {
      unsubWeight()
      unsubConnection()
      disconnect()
    }
  }, [setProvider, updateWeight, updateConnection, disconnect])

  return { openManualDialog }
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
