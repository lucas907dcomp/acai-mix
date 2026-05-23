import type { IScaleProvider, Unsubscribe } from './IScaleProvider'

// Baud rates to try in order during auto-scan
const BAUD_CANDIDATES = [9600, 4800, 2400, 19200]
const PACKET_LENGTH = 10
const STX = 0x02
const SCAN_TIMEOUT_MS = 2500 // time to wait per baud rate

export class SerialScaleProvider implements IScaleProvider {
  readonly type = 'serial' as const

  private weightCallbacks = new Set<(grams: number) => void>()
  private connectionCallbacks = new Set<(connected: boolean) => void>()
  private port: SerialPort | null = null
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null
  private readLoopActive = false
  private pollInterval: ReturnType<typeof setInterval> | null = null
  private confirmedBaud: number | null = null
  private reconnectAttempts = 0
  private readonly maxReconnectAttempts = 3

  async connect(): Promise<void> {
    if (!('serial' in navigator)) {
      throw new Error(
        'Web Serial API não suportada. Use Chrome ou Edge 89+ no desktop para conectar a balança.'
      )
    }

    this.port = await navigator.serial.requestPort()
    await this.scanBaudRates()
  }

  // Try each baud rate for SCAN_TIMEOUT_MS, stop at first one that produces data
  private async scanBaudRates(): Promise<void> {
    for (const baud of BAUD_CANDIDATES) {
      console.log(`[Scale] trying baud rate ${baud}...`)
      const gotData = await this.tryBaud(baud)
      if (gotData) {
        this.confirmedBaud = baud
        console.log(`[Scale] ✅ baud rate confirmed: ${baud}`)
        this.port!.addEventListener('disconnect', () => this.handleDisconnect())
        this.connectionCallbacks.forEach((cb) => cb(true))
        this.startReadLoop()
        this.startPolling()
        return
      }
      console.log(`[Scale] no response at ${baud}, trying next...`)
    }
    // No baud rate worked — connect anyway at 9600 (data may come later or protocol differs)
    console.log('[Scale] auto-scan exhausted — connecting at 9600, check scale settings')
    this.confirmedBaud = 9600
    await this.openAt(9600)
    this.port!.addEventListener('disconnect', () => this.handleDisconnect())
    this.connectionCallbacks.forEach((cb) => cb(true))
    this.startReadLoop()
    this.startPolling()
  }

  private async openAt(baud: number): Promise<void> {
    if (!this.port) return
    await this.port.open({ baudRate: baud, dataBits: 8, stopBits: 1, parity: 'none' })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (this.port as any).setSignals({ dataTerminalReady: true, requestToSend: false })
  }

  private async closePort(): Promise<void> {
    this.readLoopActive = false
    if (this.pollInterval) { clearInterval(this.pollInterval); this.pollInterval = null }
    try { await this.reader?.cancel() } catch { /* ignore */ }
    this.reader = null
    try { await this.port?.close() } catch { /* ignore */ }
  }

  // Opens at given baud, polls with CR for SCAN_TIMEOUT_MS, returns true if any data received
  private async tryBaud(baud: number): Promise<boolean> {
    if (!this.port) return false
    try {
      await this.openAt(baud)
    } catch {
      console.log(`[Scale] failed to open at ${baud}`)
      return false
    }

    let gotData = false

    // Start a temporary reader
    const reader = this.port.readable!.getReader()
    const readPromise = (async () => {
      try {
        while (true) {
          const { value, done } = await reader.read()
          if (done) break
          if (value && value.length > 0) {
            const hex = Array.from(value).map((b) => `0x${b.toString(16).padStart(2, '0')}`).join(' ')
            const str = String.fromCharCode(...Array.from(value))
            console.log(`[Scale] @${baud} raw hex:`, hex)
            console.log(`[Scale] @${baud} raw str:`, JSON.stringify(str))
            gotData = true
          }
        }
      } catch { /* cancelled */ }
      finally { reader.releaseLock() }
    })()

    // Poll with CR during the scan window
    const pollHandle = setInterval(() => {
      if (this.port?.writable) {
        const writer = this.port.writable.getWriter()
        writer.write(new Uint8Array([0x0D])).finally(() => writer.releaseLock())
      }
    }, 300)

    await new Promise((resolve) => setTimeout(resolve, SCAN_TIMEOUT_MS))
    clearInterval(pollHandle)
    await reader.cancel().catch(() => {})
    await readPromise

    // Close to allow reopening at different baud
    await this.closePort()
    // Re-acquire reference after close
    return gotData
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

  private async sendCommand(bytes: number[]): Promise<void> {
    if (!this.port?.writable) return
    const writer = this.port.writable.getWriter()
    try { await writer.write(new Uint8Array(bytes)) }
    finally { writer.releaseLock() }
  }

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
    console.log('[Scale] startReadLoop called at baud', this.confirmedBaud)
    this.reader = this.port.readable.getReader()
    this.readLoopActive = true
    this.readLoop()
  }

  private async readLoop(): Promise<void> {
    const buffer: number[] = []
    console.log('[Scale] readLoop running...')

    try {
      while (this.readLoopActive && this.reader) {
        const { value, done } = await this.reader.read()
        if (done) { console.log('[Scale] reader done'); break }

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
            if (weight !== null) this.weightCallbacks.forEach((cb) => cb(weight))
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
    if (this.pollInterval) { clearInterval(this.pollInterval); this.pollInterval = null }
    this.connectionCallbacks.forEach((cb) => cb(false))

    while (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++
      await new Promise((resolve) => setTimeout(resolve, Math.pow(2, this.reconnectAttempts - 1) * 1000))
      try {
        if (this.port) {
          await this.port.open({ baudRate: this.confirmedBaud ?? 9600 })
          this.reconnectAttempts = 0
          this.connectionCallbacks.forEach((cb) => cb(true))
          this.startReadLoop()
          this.startPolling()
          return
        }
      } catch { /* retry */ }
    }
    this.connectionCallbacks.forEach((cb) => cb(false))
  }
}
