import type { Product } from '@/types'

export const SEM_CATEGORIA = 'Outros'

/**
 * Categorias na ordem em que aparecem (sort_order do 1º produto de cada uma);
 * produtos soltos entram em "Outros". Lista vazia = loja sem categoria, grade única.
 */
export function listarCategorias(produtos: Pick<Product, 'category'>[]): string[] {
  const nomes = [...new Set(produtos.map((p) => p.category).filter((c): c is string => !!c))]
  if (nomes.length === 0) return []
  const temSolto = produtos.some((p) => !p.category)
  return temSolto && !nomes.includes(SEM_CATEGORIA) ? [...nomes, SEM_CATEGORIA] : nomes
}

export const categoriaDe = (p: Pick<Product, 'category'>) => p.category || SEM_CATEGORIA
