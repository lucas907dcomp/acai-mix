import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SerialScaleProvider } from '../SerialScaleProvider'

// --- Mock Web Serial API ---

function makePacket(grams: number): Uint8Array {
  const padded = String(grams).padStart(6, '0')
  return new Uint8Array([
    0x02,
    ...Array.from(padded).map((c) => c.charCodeAt(0)),
    'g'.charCodeAt(0),
    0x0d,
    0x0a,
  ])
}

function makeReadableStream(chunks: Uint8Array[]) {
  let index = 0
  return {
    getReader: () => ({
      read: vi.fn().mockImplementation(async () => {
        if (index < chunks.length) return { value: chunks[index++], done: false }
        return { value: undefined, done: true }
      }),
      cancel: vi.fn().mockResolvedValue(undefined),
      releaseLock: vi.fn(),
    }),
  }
}

function makeMockPort(chunks: Uint8Array[]) {
  return {
    open: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    setSignals: vi.fn().mockResolvedValue(undefined),
    readable: makeReadableStream(chunks),
    addEventListener: vi.fn(),
  }
}

beforeEach(() => {
  Object.defineProperty(globalThis, 'navigator', {
    value: {
      serial: {
        requestPort: vi.fn(),
      },
    },
    writable: true,
  })
})

describe('SerialScaleProvider', () => {
  it('tem type "serial"', () => {
    const provider = new SerialScaleProvider()
    expect(provider.type).toBe('serial')
  })

  it('lança erro descritivo se Web Serial API não está disponível', async () => {
    Object.defineProperty(globalThis, 'navigator', { value: {}, writable: true })
    const provider = new SerialScaleProvider()
    await expect(provider.connect()).rejects.toThrow('Web Serial API não suportada')
  })

  it('parseia pacote UPX Wind D3 e emite peso em gramas', async () => {
    const port = makeMockPort([makePacket(750)])
    ;(navigator.serial.requestPort as ReturnType<typeof vi.fn>).mockResolvedValue(port)

    const provider = new SerialScaleProvider()
    const onWeight = vi.fn()
    provider.onWeight(onWeight)
    await provider.connect()

    // Allow async read loop to process
    await new Promise((r) => setTimeout(r, 10))

    expect(onWeight).toHaveBeenCalledWith(750)
  })

  it('emite connected:true ao conectar e false ao desconectar', async () => {
    const port = makeMockPort([])
    ;(navigator.serial.requestPort as ReturnType<typeof vi.fn>).mockResolvedValue(port)

    const provider = new SerialScaleProvider()
    const onConnection = vi.fn()
    provider.onConnectionChange(onConnection)

    await provider.connect()
    expect(onConnection).toHaveBeenCalledWith(true)

    provider.disconnect()
    expect(onConnection).toHaveBeenCalledWith(false)
  })

  it('ignora bytes inválidos sem lançar exceção', async () => {
    const invalid = new Uint8Array([0xff, 0x00, 0x00])
    const port = makeMockPort([invalid])
    ;(navigator.serial.requestPort as ReturnType<typeof vi.fn>).mockResolvedValue(port)

    const provider = new SerialScaleProvider()
    const onWeight = vi.fn()
    provider.onWeight(onWeight)

    await expect(provider.connect()).resolves.not.toThrow()
    await new Promise((r) => setTimeout(r, 10))
    expect(onWeight).not.toHaveBeenCalled()
  })
})
