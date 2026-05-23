import type { IScaleProvider, Unsubscribe } from './IScaleProvider'

// UPX Wind D3 — demand mode via physical IMPRIME button
// Press IMPRIME on scale to send current weight
// Baud: 9600, 8N1
const BAUD_RATE = 9600
const PACKET_LENGTH = 10
const STX = 0x02

export class SerialScaleProvider implements IScaleProvider {
  readonly type = 'serial' as const

  private weightCallbacks = new Set<(grams: number) => void>()
  private connectionCallbacks = new Set<(connected: boolean) => void>()
  private port: SerialPort | null = null
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null
  private readLoopActive = false
  private reconnectAttempts = 0
  private readonly maxReconnectAttempts = 3

  async connect(): Promise<void> {
    if (!('serial' in navigator)) {
      throw new Error('Web Serial API não suportada. Use Chrome ou Edge no desktop.')
    }

    this.port = await navigator.serial.requestPort()

    // Wait for any previous session to fully release the port
    await new Promise((resolve) => setTimeout(resolve, 500))

    await this.openPort()
    this.port.addEventListener('disconnect', () => this.handleDisconnect())
    this.reconnectAttempts = 0
    this.connectionCallbacks.forEach((cb) => cb(true))
    this.startReadLoop()
  }

  private async openPort(): Promise<void> {
    if (!this.port) return
    try {
      await this.port.open({ baudRate: BAUD_RATE, dataBits: 8, stopBits: 1, parity: 'none' })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (this.port as any).setSignals({ dataTerminalReady: true, requestToSend: false })
      console.log('[Scale] port opened at', BAUD_RATE, 'baud — waiting for IMPRIME button')
    } catch (err) {
      // Port may still be locked — wait and retry once
      console.log('[Scale] open failed, retrying in 1s...', err)
      await new Promise((resolve) => setTimeout(resolve, 1000))
      await this.port.open({ baudRate: BAUD_RATE, dataBits: 8, stopBits: 1, parity: 'none' })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (this.port as any).setSignals({ dataTerminalReady: true, requestToSend: false })
      console.log('[Scale] port opened on retry')
    }
  }

  disconnect(): void {
    this.readLoopActive = false
    this.reader?.cancel().catch(() => {})
    this.port?.close().catch(() => {})
    this.port = null
    this.reader = null
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

  private startReadLoop(): void {
    if (!this.port?.readable) {
      console.log('[Scale] ERROR: port.readable is null')
      return
    }
    console.log('[Scale] listening — press IMPRIME on scale to send weight')
    this.reader = this.port.readable.getReader()
    this.readLoopActive = true
    this.readLoop()
  }

  private async readLoop(): Promise<void> {
    const buffer: number[] = []

    try {
      while (this.readLoopActive && this.reader) {
        const { value, done } = await this.reader.read()
        if (done) break

        // DEBUG — remove after protocol confirmed
        const hex = Array.from(value).map((b) => `0x${b.toString(16).padStart(2, '0')}`).join(' ')
        const str = String.fromCharCode(...Array.from(value))
        console.log('[Scale] raw hex:', hex)
        console.log('[Scale] raw str:', JSON.stringify(str))

        for (const byte of value) {
          buffer.push(byte)
          if (buffer.length > PACKET_LENGTH) buffer.shift()
          if (buffer.length === PACKET_LENGTH) {
            const weight = this.parsePacket(buffer)
            if (weight !== null) {
              console.log('[Scale] parsed weight:', weight, 'g')
              this.weightCallbacks.forEach((cb) => cb(weight))
            }
          }
        }
      }
    } catch {
      // handled by disconnect
    } finally {
      this.reader?.releaseLock()
      this.reader = null
    }
  }

  private parsePacket(buffer: number[]): number | null {
    if (buffer[0] !== STX) return null
    if (buffer[8] !== 0x0d || buffer[9] !== 0x0a) return null
    const weightStr = String.fromCharCode(...buffer.slice(1, 7))
    const grams = parseInt(weightStr, 10)
    return isNaN(grams) ? null : grams
  }

  private async handleDisconnect(): Promise<void> {
    this.connectionCallbacks.forEach((cb) => cb(false))

    while (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++
      await new Promise((resolve) => setTimeout(resolve, Math.pow(2, this.reconnectAttempts - 1) * 1000))
      try {
        if (this.port) {
          await this.port.open({ baudRate: BAUD_RATE })
          this.reconnectAttempts = 0
          this.connectionCallbacks.forEach((cb) => cb(true))
          this.startReadLoop()
          return
        }
      } catch { /* retry */ }
    }
    this.connectionCallbacks.forEach((cb) => cb(false))
  }
}
