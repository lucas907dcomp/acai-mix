import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { SerialScaleProvider } from '../SerialScaleProvider'

// Modo 'polling' — Toledo Prix 3 Fit/2 (loja 2).
//
// A Toledo fica muda até receber ENQ (0x05). O que estes testes protegem:
//   1. em 'polling' o ENQ realmente sai pela porta;
//   2. em 'continuous' a porta NUNCA é escrita — é o que garante que a loja
//      que já está vendendo não sente a mudança;
//   3. porta sem writable não derruba a conexão.

const ENQ = 0x05

function makePacket(grams: number): Uint8Array {
  const padded = String(grams).padStart(5, '0')
  return new Uint8Array([0x02, ...Array.from(padded).map((c) => c.charCodeAt(0)), 0x03])
}

function makeReadableStream(chunks: Uint8Array[]) {
  let index = 0
  return {
    getReader: () => ({
      read: vi.fn().mockImplementation(async () => {
        if (index < chunks.length) return { value: chunks[index++], done: false }
        return new Promise(() => {}) // segura o loop aberto, como uma porta viva
      }),
      cancel: vi.fn().mockResolvedValue(undefined),
      releaseLock: vi.fn(),
    }),
  }
}

function makeMockPort(chunks: Uint8Array[], comWritable = true) {
  const escritos: number[][] = []
  const writer = {
    write: vi.fn().mockImplementation(async (data: Uint8Array) => {
      escritos.push(Array.from(data))
    }),
    close: vi.fn().mockResolvedValue(undefined),
    releaseLock: vi.fn(),
  }

  const port = {
    open: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    setSignals: vi.fn().mockResolvedValue(undefined),
    getInfo: vi.fn().mockReturnValue({ usbVendorId: 0x067b, usbProductId: 0x23a3 }),
    readable: makeReadableStream(chunks),
    writable: comWritable ? { getWriter: () => writer } : undefined,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }

  return { port, writer, escritos }
}

beforeEach(() => {
  Object.defineProperty(globalThis, 'navigator', {
    value: {
      serial: {
        requestPort: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      },
    },
    writable: true,
  })
})

afterEach(() => {
  vi.clearAllTimers()
  vi.useRealTimers()
})

describe('SerialScaleProvider — modo polling (Toledo)', () => {
  it('manda ENQ assim que conecta, sem esperar um ciclo', async () => {
    const { port, escritos } = makeMockPort([])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(navigator.serial.requestPort as any).mockResolvedValue(port)

    const provider = new SerialScaleProvider('polling')
    await provider.connect()
    await vi.waitFor(() => expect(escritos.length).toBeGreaterThan(0))

    expect(escritos[0]).toEqual([ENQ])
    await provider.disconnect()
  })

  it('continua perguntando de tempos em tempos', async () => {
    vi.useFakeTimers()
    const { port, escritos } = makeMockPort([])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(navigator.serial.requestPort as any).mockResolvedValue(port)

    const provider = new SerialScaleProvider('polling')
    const conectando = provider.connect()
    await vi.advanceTimersByTimeAsync(600)
    await conectando
    await vi.advanceTimersByTimeAsync(1000)

    // ~250ms por pergunta: em 1s tem que ter mandado mais de uma
    expect(escritos.length).toBeGreaterThan(1)
    expect(escritos.every((e) => e[0] === ENQ)).toBe(true)
    vi.useRealTimers()
  })

  it('lê o peso da resposta igual ao modo contínuo', async () => {
    const { port } = makeMockPort([makePacket(56)])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(navigator.serial.requestPort as any).mockResolvedValue(port)

    const provider = new SerialScaleProvider('polling')
    const pesos: number[] = []
    provider.onWeight((g) => pesos.push(g))
    await provider.connect()
    await vi.waitFor(() => expect(pesos).toContain(56))

    await provider.disconnect()
  })

  it('não derruba a conexão quando a porta não é gravável', async () => {
    const { port } = makeMockPort([makePacket(120)], false)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(navigator.serial.requestPort as any).mockResolvedValue(port)

    const provider = new SerialScaleProvider('polling')
    const conexoes: boolean[] = []
    const pesos: number[] = []
    provider.onConnectionChange((c) => conexoes.push(c))
    provider.onWeight((g) => pesos.push(g))

    await expect(provider.connect()).resolves.not.toThrow()
    expect(conexoes).toContain(true)
    // segue lendo, mesmo sem conseguir perguntar
    await vi.waitFor(() => expect(pesos).toContain(120))

    await provider.disconnect()
  })

  it('para de perguntar depois do disconnect', async () => {
    vi.useFakeTimers()
    const { port, escritos } = makeMockPort([])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(navigator.serial.requestPort as any).mockResolvedValue(port)

    const provider = new SerialScaleProvider('polling')
    const conectando = provider.connect()
    await vi.advanceTimersByTimeAsync(600)
    await conectando
    await vi.advanceTimersByTimeAsync(500)

    await provider.disconnect()
    const depoisDoDisconnect = escritos.length
    await vi.advanceTimersByTimeAsync(2000)

    expect(escritos.length).toBe(depoisDoDisconnect)
    vi.useRealTimers()
  })
})

describe('SerialScaleProvider — modo contínuo (loja em produção)', () => {
  it('NUNCA escreve na porta', async () => {
    vi.useFakeTimers()
    const { port, escritos, writer } = makeMockPort([makePacket(250)])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(navigator.serial.requestPort as any).mockResolvedValue(port)

    const provider = new SerialScaleProvider('continuous')
    const conectando = provider.connect()
    await vi.advanceTimersByTimeAsync(600)
    await conectando
    await vi.advanceTimersByTimeAsync(3000)

    expect(escritos).toEqual([])
    expect(writer.write).not.toHaveBeenCalled()
    vi.useRealTimers()
  })

  it('sem argumento nenhum, o padrão é contínuo — comportamento de antes', async () => {
    vi.useFakeTimers()
    const { port, escritos } = makeMockPort([makePacket(250)])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(navigator.serial.requestPort as any).mockResolvedValue(port)

    const provider = new SerialScaleProvider()
    const conectando = provider.connect()
    await vi.advanceTimersByTimeAsync(600)
    await conectando
    await vi.advanceTimersByTimeAsync(2000)

    expect(escritos).toEqual([])
    vi.useRealTimers()
  })
})
