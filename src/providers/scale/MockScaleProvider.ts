import type { IScaleProvider, Unsubscribe } from './IScaleProvider'

// Simulates a real scale cycle:
// 1. Item placed → weight rises to a stable value (with ±3g jitter)
// 2. Stays stable for a few seconds (user captures the weight)
// 3. Item removed → weight drops to 0
// 4. Repeat with a new random weight
// Realistic açaí range: 200–650g
const STABLE_DURATION_MS = 5000
const EMPTY_DURATION_MS = 2000
const EMIT_INTERVAL_MS = 300
const MIN_WEIGHT = 200
const MAX_WEIGHT = 650
const JITTER = 3

interface MockScaleOptions {
  initialWeight?: number
  interval?: number
  variance?: number
}

export class MockScaleProvider implements IScaleProvider {
  readonly type = 'mock' as const

  private weightCallbacks = new Set<(grams: number) => void>()
  private connectionCallbacks = new Set<(connected: boolean) => void>()
  private emitIntervalId: ReturnType<typeof setInterval> | null = null
  private cycleTimeoutId: ReturnType<typeof setTimeout> | null = null
  private currentWeight = 0
  private stableTarget = 0

  // Accept legacy constructor options without breaking existing tests
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(_options: MockScaleOptions = {}) {}

  async connect(): Promise<void> {
    this.connectionCallbacks.forEach((cb) => cb(true))
    this.startCycle()
  }

  async disconnect(): Promise<void> {
    this.stop()
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

  private startCycle(): void {
    // Pick a new random weight and start emitting it
    this.stableTarget = Math.round(MIN_WEIGHT + Math.random() * (MAX_WEIGHT - MIN_WEIGHT))
    this.currentWeight = this.stableTarget

    this.emitIntervalId = setInterval(() => {
      const jitter = Math.round((Math.random() * 2 - 1) * JITTER)
      const weight = Math.max(0, this.currentWeight + jitter)
      this.weightCallbacks.forEach((cb) => cb(weight))
    }, EMIT_INTERVAL_MS)

    // After stable duration, simulate item removal
    this.cycleTimeoutId = setTimeout(() => {
      this.goEmpty()
    }, STABLE_DURATION_MS)
  }

  private goEmpty(): void {
    if (this.emitIntervalId !== null) {
      clearInterval(this.emitIntervalId)
      this.emitIntervalId = null
    }

    this.currentWeight = 0
    this.weightCallbacks.forEach((cb) => cb(0))

    // After empty pause, start next cycle
    this.cycleTimeoutId = setTimeout(() => {
      this.startCycle()
    }, EMPTY_DURATION_MS)
  }

  private stop(): void {
    if (this.emitIntervalId !== null) {
      clearInterval(this.emitIntervalId)
      this.emitIntervalId = null
    }
    if (this.cycleTimeoutId !== null) {
      clearTimeout(this.cycleTimeoutId)
      this.cycleTimeoutId = null
    }
  }
}
