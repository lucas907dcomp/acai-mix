import { useState } from 'react'
import { toast } from 'sonner'
import { Skeleton } from '@/components/ui/skeleton'
import { UnitSaleModal } from '@/components/pdv/UnitSaleModal'
import { usePdvProducts } from '@/hooks/usePdvProducts'
import { formatCurrency } from '@/stores/saleStore'
import { listarCategorias, categoriaDe } from '@/lib/categorias'
import { cn } from '@/lib/utils'
import type { Product } from '@/types'

/**
 * Grid of active unit-type product buttons shown in the PDV below the
 * açaí-by-weight flow (Story 10.4 / EPIC-10).
 *
 * Tapping a card opens UnitSaleModal for that product. The açaí flow
 * (ScaleConnectionStatus → WeightDisplay → PriceDisplay → PaymentMethodSelector
 * → ConfirmSaleButton) is completely untouched. O toggle da casquinha mora
 * dentro do PriceDisplay.
 */
export function UnitProductsGrid() {
  const { data: products, isLoading, error, refetch } = usePdvProducts()
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [aba, setAba] = useState<string | null>(null)

  async function handleProductClick(product: Product) {
    // Edge case: product may have been deactivated since last render.
    // Re-validate by refetching before opening modal (AC-F4.9).
    const result = await refetch()
    const fresh = result.data?.find((p) => p.id === product.id)
    if (!fresh || !fresh.active) {
      toast.error('Este produto foi desativado. Catálogo atualizado.')
      return
    }
    setSelectedProduct(fresh)
  }

  if (isLoading) {
    return (
      <div className="space-y-2">
        <p className="text-xs font-medium text-[#9d7bc8] uppercase tracking-wider">
          Produtos avulsos
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl bg-[#2d1550]" />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-2">
        <p className="text-xs font-medium text-[#9d7bc8] uppercase tracking-wider">
          Produtos avulsos
        </p>
        <p className="text-xs text-red-400">Erro ao carregar produtos. Tente novamente.</p>
      </div>
    )
  }

  if (!products || products.length === 0) {
    return (
      <div className="space-y-2">
        <p className="text-xs font-medium text-[#9d7bc8] uppercase tracking-wider">
          Produtos avulsos
        </p>
        <p className="text-xs text-[#4a3570] italic">
          Nenhum produto cadastrado. Configure em{' '}
          <span className="text-[#9d7bc8]">Configurações</span>.
        </p>
      </div>
    )
  }

  // Loja sem categoria cadastrada: sem abas, a grade de sempre.
  const categorias = listarCategorias(products)
  // A aba some se o último produto dela for desativado: volta para a primeira.
  const abaAtiva = aba && categorias.includes(aba) ? aba : categorias[0]
  const visiveis = abaAtiva ? products.filter((p) => categoriaDe(p) === abaAtiva) : products

  return (
    <>
      <div className="space-y-2">
        {/* Com abas o título sai: em 1280x720 ele fazia o painel rolar. */}
        {categorias.length === 0 && (
          <p className="text-xs font-medium text-[#9d7bc8] uppercase tracking-wider">
            Produtos avulsos
          </p>
        )}
        {categorias.length > 0 && (
          <div className="grid grid-cols-3 gap-1.5" role="group" aria-label="Categorias" data-categorias>
            {categorias.map((c) => (
              <button
                key={c}
                onClick={() => setAba(c)}
                aria-pressed={c === abaAtiva}
                className={cn(
                  'h-9 px-1.5 rounded-lg border text-xs font-semibold truncate transition-colors',
                  c === abaAtiva
                    ? 'bg-[#4c1e8c] border-[#4c1e8c] text-white'
                    : 'bg-[#0f0720] border-[#2d1550] text-[#9d7bc8] hover:border-[#4c1e8c] hover:text-white'
                )}
              >
                {c}
              </button>
            ))}
          </div>
        )}
        {/* Com abas: 2 colunas, para o fim do nome (mista, Ninho) não ser cortado. */}
        <div className={cn('grid grid-cols-2 gap-2', categorias.length === 0 && 'sm:grid-cols-3')}>
          {visiveis.map((product) => (
            <button
              key={product.id}
              onClick={() => handleProductClick(product)}
              className={cn(
                'flex flex-col items-start gap-1 rounded-xl bg-[#1a0b2e] border border-[#2d1550] px-3 text-left hover:bg-[#2d1550] hover:border-[#4c1e8c] transition-colors min-h-[4rem]',
                categorias.length > 0 ? 'py-2 justify-center' : 'py-3'
              )}
            >
              <span className="text-sm font-medium text-white leading-tight line-clamp-2">
                {product.name}
              </span>
              <span className="text-xs text-[#10b981] font-semibold">
                {formatCurrency(product.unit_price ?? 0)}
              </span>
            </button>
          ))}
        </div>
      </div>

      {selectedProduct && (
        <UnitSaleModal
          product={selectedProduct}
          open={selectedProduct !== null}
          onClose={() => setSelectedProduct(null)}
        />
      )}
    </>
  )
}
