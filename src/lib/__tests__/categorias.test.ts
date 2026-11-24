import { describe, it, expect } from 'vitest'
import { listarCategorias, categoriaDe } from '../categorias'

describe('listarCategorias', () => {
  it('loja sem categoria não ganha abas', () => {
    expect(listarCategorias([{ category: null }, {}])).toEqual([])
  })

  it('mantém a ordem e põe os soltos em Outros, no fim', () => {
    const p = [{ category: 'Copo' }, { category: null }, { category: 'Bebidas' }, { category: 'Copo' }]
    expect(listarCategorias(p)).toEqual(['Copo', 'Bebidas', 'Outros'])
    expect(p.map(categoriaDe)).toEqual(['Copo', 'Outros', 'Bebidas', 'Copo'])
  })

  it('não duplica Outros criado à mão', () => {
    expect(listarCategorias([{ category: 'Outros' }, { category: null }])).toEqual(['Outros'])
  })
})
