import { describe, expect, it } from 'vitest'
import { contaDoDelivery } from '@/lib/delivery'
import { bytesConta } from '@/lib/imprimirConta'

describe('contaDoDelivery', () => {
  it('leva itens, troco e endereço para a conta impressa', () => {
    const conta = contaDoDelivery(
      {
        id: 'x', numero: 7, cliente_nome: 'Ana', cliente_telefone: '79999990001',
        endereco: 'Rua das Flores, 120', total: 48.8, pagamento: 'Dinheiro', troco_para: 100,
        observacao: null, status: 'novo', created_at: '2026-11-10T20:00:00Z',
        itens: [
          { nome: 'Açaí Diplomata', tamanho: 'M 500 ml', qtd: 2, preco: 22.9, obs: 'sem banana' },
          { nome: 'Água', tamanho: '500 ml', qtd: 1, preco: 3 },
        ],
      },
      'Loja'
    )
    expect(conta.mesa).toBe('DELIVERY #7')
    expect(conta.itens.map((i) => i.amount)).toEqual([45.8, 3])
    expect(conta.extras).toContain('End: Rua das Flores, 120')
    expect(conta.extras?.find((e) => e.startsWith('Pagamento'))).toMatch(/troco para R\$\s100,00/)
    const texto = new TextDecoder().decode(bytesConta(conta))
    expect(texto).toContain('2x Acai Diplomata M 500')
    expect(texto).toContain('End: Rua das Flores, 120')
  })
})
