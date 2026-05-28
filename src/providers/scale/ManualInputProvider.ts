import type { IScaleProvider, Unsubscribe } from './IScaleProvider'

export class ManualInputProvider implements IScaleProvider {
  readonly type = 'manual' as const

  private weightCallbacks = new Set<(grams: number) => void>()
  private connectionCallbacks = new Set<(connected: boolean) => void>()

  async connect(): Promise<void> {
    this.connectionCallbacks.forEach((cb) => cb(true))
  }

  async disconnect(): Promise<void> {
    this.connectionCallbacks.forEach((cb) => cb(false))
  }

  onWeight(callback: (grams: number) => void): Unsubscribe {
    this.weightCallbacks.add(callback)
    return () => this.weightCallbacks.delete(callback)
  }

  onConnectionChange(callback: (connected: boolean) => void): Unsubscribe {
    this.connectionCallbacks.add(callback)
    return () => this.connectionCallbacks.delete(callback)
  }

  setWeight(grams: number): void {
    this.weightCallbacks.forEach((cb) => cb(grams))
  }
}
