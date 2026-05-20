import type { IScaleProvider, Unsubscribe } from './IScaleProvider'

interface MockScaleOptions {
  initialWeight?: number
  interval?: number
  variance?: number
}

export class MockScaleProvider implements IScaleProvider {
  readonly type = 'mock' as const

  private weightCallbacks = new Set<(grams: number) => void>()
  private connectionCallbacks = new Set<(connected: boolean) => void>()
  private intervalId: ReturnType<typeof setInterval> | null = null
  private currentWeight: number
  private emitInterval: number
  private variance: number

  constructor({ initialWeight = 500, interval = 500, variance = 0 }: MockScaleOptions = {}) {
    this.currentWeight = initialWeight
    this.emitInterval = interval
    this.variance = variance
  }

  async connect(): Promise<void> {
    this.connectionCallbacks.forEach((cb) => cb(true))
    this.startEmitting()
  }

  disconnect(): void {
    this.stopEmitting()
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

  private startEmitting(): void {
    this.intervalId = setInterval(() => {
      const jitter = this.variance > 0 ? (Math.random() * 2 - 1) * this.variance : 0
      const weight = Math.max(0, Math.round(this.currentWeight + jitter))
      this.weightCallbacks.forEach((cb) => cb(weight))
    }, this.emitInterval)
  }

  private stopEmitting(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
  }
}
