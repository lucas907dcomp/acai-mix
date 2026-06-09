// Minimal Web Serial API type declarations
// Full spec: https://wicg.github.io/serial/

interface SerialPortInfo {
  usbVendorId?: number
  usbProductId?: number
}

interface SerialOptions {
  baudRate: number
  dataBits?: number
  stopBits?: number
  parity?: 'none' | 'even' | 'odd'
  bufferSize?: number
  flowControl?: 'none' | 'hardware'
}

interface SerialPort extends EventTarget {
  readonly readable: ReadableStream<Uint8Array> | null
  readonly writable: WritableStream<Uint8Array> | null
  open(options: SerialOptions): Promise<void>
  close(): Promise<void>
  getInfo(): SerialPortInfo
}

// event.port holds the SerialPort that was connected/disconnected
// event.target points to navigator.serial — do NOT use it to get the port
interface SerialConnectionEvent extends Event {
  readonly port: SerialPort
}

interface Serial extends EventTarget {
  requestPort(options?: { filters?: SerialPortFilter[] }): Promise<SerialPort>
  getPorts(): Promise<SerialPort[]>
  addEventListener(type: 'connect' | 'disconnect', listener: (event: SerialConnectionEvent) => void): void
  removeEventListener(type: 'connect' | 'disconnect', listener: (event: SerialConnectionEvent) => void): void
}

interface SerialPortFilter {
  usbVendorId?: number
  usbProductId?: number
}

interface Navigator {
  readonly serial: Serial
}
