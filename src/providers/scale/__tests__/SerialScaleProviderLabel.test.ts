import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { SerialScaleProvider } from '../SerialScaleProvider'
import { useScaleStore } from '@/stores/scaleStore'

// Bytes reais da Urano US 20/2 POP-S da Iris, medidos em 24/11/2026.
const REAL =
  '08 02 03 03 02 03 01 02 00 14 44 41 54 41 3A 20 20 30 30 2F 30 30 2F 30 30 20 56 41 4C 49 44 2E 3A 20 30 30 2F 30 30 2F 30 30 20 20 20 20 20 20 54 41 52 41 3A 20 20 20 30 2E 30 30 30 6B 67 20 20 20 20 20 20 20 50 45 53 4F 20 4C 3A 20 20 30 2E 31 33 38 6B 67 20 20 20 20 20 20 52 24 2F 6B ' +
  '67 3A 20 20 20 20 20 34 39 2E 39 30 20 20 20 20 20 20 54 4F 54 41 4C 20 52 24 3A 20 20 20 20 20 20 36 2E 38 39 32 30 30 30 30 30 30 30 30 36 38 39 03 09 02 01 03'
const bytes = new Uint8Array(REAL.split(' ').map((h) => parseInt(h, 16)))
const com = (peso: string) => {
  const s = String.fromCharCode(...bytes).replace('0.138', peso)
  return new Uint8Array([...s].map((c) => c.charCodeAt(0)))
}

function portaCom(chunks: Uint8Array[]) {
  let i = 0
  const write = vi.fn().mockResolvedValue(undefined)
  const port = {
    open: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    setSignals: vi.fn().mockResolvedValue(undefined),
    getInfo: vi.fn().mockReturnValue({}),
    readable: {
      getReader: () => ({
        read: async () => (i < chunks.length ? { value: chunks[i++], done: false } : new Promise(() => {})),
        cancel: vi.fn().mockResolvedValue(undefined),
        releaseLock: vi.fn(),
      }),
    },
    writable: { getWriter: () => ({ write, close: vi.fn(), releaseLock: vi.fn() }) },
    addEventListener: vi.fn(),
  }
  return { port, write }
}

async function ler(chunks: Uint8Array[]) {
  const { port, write } = portaCom(chunks)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(navigator.serial.requestPort as any).mockResolvedValue(port)
  const provider = new SerialScaleProvider('label')
  const pesos: number[] = []
  const conexao: boolean[] = []
  provider.onWeight((g) => pesos.push(g))
  provider.onConnectionChange((c) => conexao.push(c))
  const p = provider.connect()
  await vi.advanceTimersByTimeAsync(700)
  await p
  return { provider, pesos, conexao, write }
}

beforeEach(() => {
  vi.useFakeTimers()
  Object.defineProperty(globalThis, 'navigator', {
    value: { serial: { requestPort: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn() } },
    writable: true,
  })
})
afterEach(() => vi.useRealTimers())

describe('SerialScaleProvider — modo label (Urano POP-S)', () => {
  it('lê o peso líquido do pacote real, sem escrever na porta', async () => {
    const { provider, pesos, write } = await ler([bytes])
    expect(pesos).toEqual([138])
    expect(write).not.toHaveBeenCalled()
    await provider.disconnect()
  })

  it('lê o pacote picado byte a byte, uma vez só', async () => {
    const { provider, pesos } = await ler([...bytes].map((b) => new Uint8Array([b])))
    expect(pesos).toEqual([138])
    await provider.disconnect()
  })

  it('lê pesagens seguidas e acima de 10 kg', async () => {
    const { provider, pesos } = await ler([com('0.138'), com('1.205'), com('12.340')])
    expect(pesos).toEqual([138, 1205, 12340])
    await provider.disconnect()
  })

  it('silêncio não derruba a conexão; peso não capturado some em 15 s', async () => {
    const { provider, pesos, conexao } = await ler([bytes])
    await vi.advanceTimersByTimeAsync(13_000)
    expect(pesos).toEqual([138])
    await vi.advanceTimersByTimeAsync(52_000)
    expect(conexao).toEqual([true])
    expect(pesos).toEqual([138, 0])
    await provider.disconnect()
  })
})

describe('consumeWeight', () => {
  const provider = (singleShot: boolean) =>
    ({ type: 'serial', singleShot }) as unknown as SerialScaleProvider

  it('gasta o peso na balança de envio único e não mexe nas outras', () => {
    const s = useScaleStore.getState()
    s.setProvider(provider(true))
    s.updateWeight(138)
    s.consumeWeight()
    expect(useScaleStore.getState().currentWeightGrams).toBe(0)

    s.setProvider(provider(false))
    s.updateWeight(138)
    s.consumeWeight()
    expect(useScaleStore.getState().currentWeightGrams).toBe(138)
  })
})
