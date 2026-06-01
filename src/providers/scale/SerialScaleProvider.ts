import type { IScaleProvider, Unsubscribe } from './IScaleProvider'

// UPX Wind D3 — continuous streaming mode, 9600 8N1
// Packet: STX (0x02) + 5 ASCII digits + ETX (0x03) = 7 bytes
// "IIIII" = scale unstable (ignored)
const BAUD_RATE = 9600
const PACKET_LENGTH = 7
const STX = 0x02
const ETX = 0x03

// If no valid packet arrives within this window the connection is considered
// stale and a reconnect is forced. The scale streams continuously, so 6 s
// with no data means either the USB was silently killed or the port locked up.
const WATCHDOG_MS = 6_000

export class SerialScaleProvider implements IScaleProvider {
  readonly type = 'serial' as const

  private weightCallbacks = new Set<(grams: number) => void>()
  private connectionCallbacks = new Set<(connected: boolean) => void>()
  private port: SerialPort | null = null
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null
  private readLoopActive = false
  private reconnectAttempts = 0
  private watchdogTimer: ReturnType<typeof setTimeout> | null = null

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
    this.resetWatchdog()
  }

  private async openPort(): Promise<void> {
    if (!this.port) return
    try {
      await this.port.open({ baudRate: BAUD_RATE, dataBits: 8, stopBits: 1, parity: 'none' })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (this.port as any).setSignals({ dataTerminalReady: true, requestToSend: false })
    } catch {
      // Port may still be locked — wait and retry once
      await new Promise((resolve) => setTimeout(resolve, 1000))
      await this.port.open({ baudRate: BAUD_RATE, dataBits: 8, stopBits: 1, parity: 'none' })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (this.port as any).setSignals({ dataTerminalReady: true, requestToSend: false })
    }
  }

  async disconnect(): Promise<void> {
    this.clearWatchdog()
    this.readLoopActive = false
    if (this.reader) {
      try { await this.reader.cancel() } catch { /* ignore */ }
      this.reader = null
    }
    if (this.port) {
      try { await this.port.close() } catch { /* ignore */ }
      this.port = null
    }
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
    if (!this.port?.readable) return
    this.reader = this.port.readable.getReader()
    this.readLoopActive = true
    this.readLoop()
  }

  private async readLoop(): Promise<void> {
    const buffer: number[] = []
    let exitedCleanly = false

    try {
      while (this.readLoopActive && this.reader) {
        const { value, done } = await this.reader.read()
        if (done) { exitedCleanly = true; break }

        for (const byte of value) {
          buffer.push(byte)
          if (buffer.length > PACKET_LENGTH) buffer.shift()
          if (buffer.length === PACKET_LENGTH) {
            const weight = this.parsePacket(buffer)
            if (weight !== null) {
              this.weightCallbacks.forEach((cb) => cb(weight))
              this.resetWatchdog()
            }
          }
        }
      }
    } catch {
      // Read error — port likely died without firing a 'disconnect' event
    } finally {
      this.reader?.releaseLock()
      this.reader = null
    }

    // Loop exited while we're supposed to be connected → force reconnect.
    // This catches USB suspend / port lockup cases where the browser never
    // fires the 'disconnect' event.
    if (!exitedCleanly && this.readLoopActive && this.port) {
      this.handleDisconnect()
    }
  }

  private parsePacket(buffer: number[]): number | null {
    if (buffer[0] !== STX) return null
    if (buffer[6] !== ETX) return null
    const weightStr = String.fromCharCode(...buffer.slice(1, 6))
    const grams = parseInt(weightStr, 10)
    return isNaN(grams) ? null : grams
  }

  // ── Watchdog ───────────────────────────────────────────────────────────────
  // The scale streams packets continuously. If nothing arrives for WATCHDOG_MS
  // the USB connection has silently died (common with Windows USB power saving).

  private resetWatchdog(): void {
    this.clearWatchdog()
    this.watchdogTimer = setTimeout(() => {
      if (this.readLoopActive && this.port) {
        this.handleDisconnect()
      }
    }, WATCHDOG_MS)
  }

  private clearWatchdog(): void {
    if (this.watchdogTimer !== null) {
      clearTimeout(this.watchdogTimer)
      this.watchdogTimer = null
    }
  }

  // ── Reconnection ───────────────────────────────────────────────────────────

  private async handleDisconnect(): Promise<void> {
    this.clearWatchdog()
    this.readLoopActive = false
    this.connectionCallbacks.forEach((cb) => cb(false))

    // After a physical USB disconnect the old SerialPort object is invalid.
    // navigator.serial.getPorts() returns a fresh reference once the device
    // re-enumerates. We keep trying until disconnect() is called explicitly.
    while (this.port) {
      this.reconnectAttempts++
      const delay = this.reconnectAttempts <= 3
        ? Math.pow(2, this.reconnectAttempts - 1) * 1000
        : 10_000
      await new Promise((resolve) => setTimeout(resolve, delay))

      try {
        if (!this.port) return

        // Prefer a freshly enumerated port over the stale object.
        // getPorts() only returns ports the user has already granted access to.
        const available = await navigator.serial.getPorts()
        if (available.length > 0) {
          this.port = available[0]
        }

        await this.openPort()
        this.reconnectAttempts = 0
        this.connectionCallbacks.forEach((cb) => cb(true))
        this.startReadLoop()
        this.resetWatchdog()
        return
      } catch { /* porta ainda indisponível, tenta de novo */ }
    }
  }
}
