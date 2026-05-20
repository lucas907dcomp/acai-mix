export type Unsubscribe = () => void

export interface IScaleProvider {
  readonly type: 'serial' | 'mock' | 'manual'
  connect(): Promise<void>
  disconnect(): void
  onWeight(callback: (grams: number) => void): Unsubscribe
  onConnectionChange(callback: (connected: boolean) => void): Unsubscribe
}
