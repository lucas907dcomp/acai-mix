import type { IScaleProvider, Unsubscribe } from './IScaleProvider'

// UPX Wind D3 — continuous streaming mode, 9600 8N1
// Packet: STX (0x02) + 5 ASCII digits + ETX (0x03) = 7 bytes
// "IIIII" = scale unstable (ignored)
const BAUD_RATE = 9600
const PACKET_LENGTH = 7
const STX = 0x02
const ETX = 0x03
const WATCHDOG_TIMEOUT_MS = 10_000
const WATCHDOG_INTERVAL_MS = 3_000

export class SerialScaleProvider implements IScaleProvider {
  readonly type = 'serial' as const

  private weightCallbacks = new Set<(grams: number) => void>()
  private connectionCallbacks = new Set<(connected: boolean) => void>()
  private port: SerialPort | null = null
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null
  private readLoopActive = false
  private reconnectAttempts = 0
  private isReconnecting = false
  private storedPortInfo: SerialPortInfo | null = null
  private lastDataTimestamp = 0
  private watchdogTimer: ReturnType<typeof setInterval> | null = null

  private readonly onSerialConnect = (event: SerialConnectionEvent) => {
    void this.handleSerialDeviceReconnect(event)
  }

  constructor() {
    if ('serial' in navigator) {
      navigator.serial.addEventListener('connect', this.onSerialConnect)
    }
  }

  async connect(): Promise<void> {
    if (!('serial' in navigator)) {
      throw new Error('Web Serial API não suportada. Use Chrome ou Edge no desktop.')
    }

    this.port = await navigator.serial.requestPort()
    this.storedPortInfo = this.port.getInfo()

    // Wait for any previous session to fully release the port
    await new Promise((resolve) => setTimeout(resolve, 500))

    await this.openPort()
    this.port.addEventListener('disconnect', () => this.handleDisconnect())
    this.reconnectAttempts = 0
    this.isReconnecting = false
    this.connectionCallbacks.forEach((cb) => cb(true))
    this.startReadLoop()
    this.startWatchdog()
  }

  private async openPort(): Promise<void> {
    if (!this.port) return
    // Port already open — skip to avoid InvalidStateError
    if (this.port.readable) return
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
    this.isReconnecting = false
    this.readLoopActive = false
    this.stopWatchdog()
    if ('serial' in navigator) {
      navigator.serial.removeEventListener('connect', this.onSerialConnect)
    }
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
    if (this.readLoopActive) return
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

        this.lastDataTimestamp = Date.now()
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
    } catch (err) {
      // Framing error or reader failure without a disconnect event (common with CH340)
      if (this.readLoopActive) {
        console.warn('[Scale] Erro no readLoop, iniciando reconexão:', err)
        void this.handleDisconnect()
      }
    } finally {
      this.readLoopActive = false
      this.reader?.releaseLock()
      this.reader = null
    }
  }

  private parsePacket(buffer: number[]): number | null {
    if (buffer[0] !== STX) return null
    if (buffer[6] !== ETX) return null
    const weightStr = String.fromCharCode(...buffer.slice(1, 6))
    const grams = parseInt(weightStr, 10)
    return isNaN(grams) ? null : grams
  }

  private handleDisconnect(): void {
    if (this.isReconnecting) return
    this.isReconnecting = true
    this.readLoopActive = false
    this.stopWatchdog()
    this.connectionCallbacks.forEach((cb) => cb(false))
    console.warn('[Scale] Balança desconectada, aguardando reconexão...')
    void this.reconnectLoop()
  }

  private async reconnectLoop(): Promise<void> {
    // Tries to reopen the existing port (works for software glitches and framing errors)
    // Physical replug is handled separately by onSerialConnect / handleSerialDeviceReconnect
    while (this.port && this.isReconnecting) {
      this.reconnectAttempts++
      const delay = this.reconnectAttempts <= 3
        ? Math.pow(2, this.reconnectAttempts - 1) * 1000
        : 10_000
      await new Promise((resolve) => setTimeout(resolve, delay))
      try {
        if (!this.port || !this.isReconnecting) return
        await this.openPort()
        this.isReconnecting = false
        this.reconnectAttempts = 0
        this.connectionCallbacks.forEach((cb) => cb(true))
        this.startReadLoop()
        this.startWatchdog()
        return
      } catch { /* port still unavailable, keep trying */ }
    }
  }

  // Called when any USB serial device is plugged into the PC
  private async handleSerialDeviceReconnect(event: SerialConnectionEvent): Promise<void> {
    if (!this.isReconnecting || !this.storedPortInfo) return

    // event.port is the reconnected SerialPort (event.target is navigator.serial — wrong)
    const reconnectedPort = event.port
    if (!reconnectedPort) return

    const info = reconnectedPort.getInfo()
    const isSameDevice =
      info.usbVendorId !== undefined &&
      info.usbVendorId === this.storedPortInfo.usbVendorId &&
      info.usbProductId === this.storedPortInfo.usbProductId

    if (!isSameDevice) return

    console.log('[Scale] Dispositivo USB reconectado, reabrindo porta...')
    try {
      this.port = reconnectedPort
      this.port.addEventListener('disconnect', () => this.handleDisconnect())
      await this.openPort()
      this.isReconnecting = false
      this.reconnectAttempts = 0
      this.connectionCallbacks.forEach((cb) => cb(true))
      this.startReadLoop()
      this.startWatchdog()
    } catch (err) {
      console.error('[Scale] Falhou ao reabrir após reconexão USB:', err)
    }
  }

  private startWatchdog(): void {
    this.stopWatchdog()
    this.lastDataTimestamp = Date.now()
    this.watchdogTimer = setInterval(() => {
      if (!this.readLoopActive) return
      if (Date.now() - this.lastDataTimestamp > WATCHDOG_TIMEOUT_MS) {
        console.warn('[Scale] Watchdog: sem dados por 10s, reconectando...')
        this.handleDisconnect()
      }
    }, WATCHDOG_INTERVAL_MS)
  }

  private stopWatchdog(): void {
    if (this.watchdogTimer !== null) {
      clearInterval(this.watchdogTimer)
      this.watchdogTimer = null
    }
  }
}
