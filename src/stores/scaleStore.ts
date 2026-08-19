import { create } from 'zustand'
import type { IScaleProvider } from '@/providers/scale/IScaleProvider'

interface ScaleState {
  isConnected: boolean
  currentWeightGrams: number | null
  provider: IScaleProvider | null
  providerType: 'serial' | 'mock' | 'manual'
  showManualDialog: boolean
  /**
   * Lançamento manual pontual, COM a balança conectada.
   *
   * Serve para a venda em que não dá para pesar (produto já embalado, balança
   * ocupada, item sem peso). Dura uma venda: some sozinho quando a venda é
   * concluída ou descartada, e a balança nunca é desconectada — diferente do
   * modo manual do `providerType`, que é uma troca de provider e exige
   * reconectar depois.
   */
  manualOverride: boolean
  setProvider: (provider: IScaleProvider) => void
  updateWeight: (grams: number) => void
  updateConnection: (connected: boolean) => void
  openManualDialog: () => void
  closeManualDialog: () => void
  disconnect: () => Promise<void>
  connectScale: () => Promise<void>
  setManualOverride: (on: boolean) => void
}

export const useScaleStore = create<ScaleState>((set, get) => ({
  isConnected: false,
  currentWeightGrams: null,
  provider: null,
  providerType: 'mock',
  showManualDialog: false,
  manualOverride: false,

  setProvider: (provider) =>
    set({ provider, providerType: provider.type, isConnected: false, currentWeightGrams: null }),

  updateWeight: (grams) => set({ currentWeightGrams: grams }),

  updateConnection: (connected) => set({ isConnected: connected }),

  openManualDialog: () => set({ showManualDialog: true }),

  closeManualDialog: () => set({ showManualDialog: false }),

  disconnect: async () => {
    const { provider } = get()
    await provider?.disconnect()
    set({ isConnected: false, currentWeightGrams: null, provider: null })
  },

  setManualOverride: (on) => set({ manualOverride: on }),

  connectScale: async () => {
    const { provider } = get()
    if (!provider) return
    await provider.connect()
  },
}))
