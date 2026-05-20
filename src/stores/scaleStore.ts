import { create } from 'zustand'
import type { IScaleProvider } from '@/providers/scale/IScaleProvider'

interface ScaleState {
  isConnected: boolean
  currentWeightGrams: number | null
  provider: IScaleProvider | null
  providerType: 'serial' | 'mock' | 'manual'
  showManualDialog: boolean
  setProvider: (provider: IScaleProvider) => void
  updateWeight: (grams: number) => void
  updateConnection: (connected: boolean) => void
  openManualDialog: () => void
  closeManualDialog: () => void
  disconnect: () => void
}

export const useScaleStore = create<ScaleState>((set, get) => ({
  isConnected: false,
  currentWeightGrams: null,
  provider: null,
  providerType: 'mock',
  showManualDialog: false,

  setProvider: (provider) =>
    set({ provider, providerType: provider.type, isConnected: false, currentWeightGrams: null }),

  updateWeight: (grams) => set({ currentWeightGrams: grams }),

  updateConnection: (connected) => set({ isConnected: connected }),

  openManualDialog: () => set({ showManualDialog: true }),

  closeManualDialog: () => set({ showManualDialog: false }),

  disconnect: () => {
    const { provider } = get()
    provider?.disconnect()
    set({ isConnected: false, currentWeightGrams: null, provider: null })
  },
}))
