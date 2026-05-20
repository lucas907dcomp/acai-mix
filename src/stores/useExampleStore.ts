import { create } from 'zustand'

interface ExampleState {
  count: number
  increment: () => void
  reset: () => void
}

export const useExampleStore = create<ExampleState>((set) => ({
  count: 0,
  increment: () => set((s) => ({ count: s.count + 1 })),
  reset: () => set({ count: 0 }),
}))
