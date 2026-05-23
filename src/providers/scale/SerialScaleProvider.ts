import type { IScaleProvider, Unsubscribe } from './IScaleProvider'

// UPX Wind D3 — protocol to be confirmed at installation
// Baud rate: 9600, Data bits: 8, Stop bits: 1, Parity: None
// Scale operates in demand mode: responds to CR (0x0D) with current weight
const BAUD_RATE = 9600
const PACKET_LENGTH = 10 // STX + 6 digits + unit + CR + LF
const STX = 0x02

export class SerialScaleProvider implements IScaleProvider {
  readonly type = 'serial' as const

  private weightCallbacks = new Set<(grams: number) => void>()
  private connectionCallbacks = new Set<(connected: boolean) => void>()
  private port: SerialPort | null = null
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null
  private readLoopActive = false
  private pollInterval: ReturnType<typeof setInterval> | null = null
  private reconnectAttempts = 0
  private readonly maxReconnectAttempts = 3

  async connect(): Promise<void> {
    if (!('serial' in navigator)) {
      throw new Error(
        'Web Serial API não suportada. Use Chrome ou Edge 89+ no desktop para conectar a balança.'
      )
    }

    this.port = await navigator.serial.requestPort()
    await this.port.open({ baudRate: BAUD_RATE, dataBits: 8, stopBits: 1, parity: 'none' })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (this.port as any).setSignals({ dataTerminalReady: true, requestToSend: false })
    console.log('[Scale] port opened, DTR set, baud:', BAUD_RATE)

    this.reconnectAttempts = 0
    this.connectionCallbacks.forEach((cb) => cb(true))
    this.startReadLoop()
    this.startPolling()

    this.port.addEventListener('disconnect', () => this.handleDisconnect())
  }

  disconnect(): void {
    this.readLoopActive = false
    if (this.pollInterval) { clearInterval(this.pollInterval); this.pollInterval = null }
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

  // Sends CR to request weight — works for demand-mode scales
  private async sendCommand(bytes: number[]): Promise<void> {
    if (!this.port?.writable) return
    const writer = this.port.writable.getWriter()
    try {
      await writer.write(new Uint8Array(bytes))
    } finally {
      writer.releaseLock()
    }
  }

  // Polls the scale every 300ms with CR — covers demand-mode and continuous-mode scales
  private startPolling(): void {
    console.log('[Scale] starting poll (CR every 300ms)')
    this.pollInterval = setInterval(() => {
      this.sendCommand([0x0D]).catch(() => {})
    }, 300)
  }

  private startReadLoop(): void {
    if (!this.port?.readable) {
      console.log('[Scale] ERROR: port.readable is null')
      return
    }
    console.log('[Scale] startReadLoop called')
    this.reader = this.port.readable.getReader()
    this.readLoopActive = true
    this.readLoop()
  }

  private async readLoop(): Promise<void> {
    const buffer: number[] = []
    console.log('[Scale] readLoop running, waiting for data...')

    try {
      while (this.readLoopActive && this.reader) {
        const { value, done } = await this.reader.read()
        if (done) { console.log('[Scale] reader done'); break }

        // DEBUG — remove after protocol is confirmed
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
              this.weightCallbacks.forEach((cb) => cb(weight))
            }
          }
        }
      }
    } catch {
      // Read error — handleDisconnect manages reconnection
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
    if (this.pollInterval) { clearInterval(this.pollInterval); this.pollInterval = null }
    this.connectionCallbacks.forEach((cb) => cb(false))

    while (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++
      const delay = Math.pow(2, this.reconnectAttempts - 1) * 1000
      await new Promise((resolve) => setTimeout(resolve, delay))

      try {
        if (this.port) {
          await this.port.open({ baudRate: BAUD_RATE })
          this.reconnectAttempts = 0
          this.connectionCallbacks.forEach((cb) => cb(true))
          this.startReadLoop()
          this.startPolling()
          return
        }
      } catch {
        // retry
      }
    }

    this.connectionCallbacks.forEach((cb) => cb(false))
  }
}
