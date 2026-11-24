export type Unsubscribe = () => void

export interface IScaleProvider {
  readonly type: 'serial' | 'mock' | 'manual'
  /**
   * A balança só manda o peso UMA vez por pesagem (modo etiqueta). O peso na
   * tela não se atualiza sozinho, então é gasto ao capturar.
   */
  readonly singleShot?: boolean
  connect(): Promise<void>
  disconnect(): Promise<void>
  onWeight(callback: (grams: number) => void): Unsubscribe
  onConnectionChange(callback: (connected: boolean) => void): Unsubscribe
}
