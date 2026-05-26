import { useState } from 'react'
import { toast } from 'sonner'
import { Skeleton } from '@/components/ui/skeleton'
import { UnitSaleModal } from '@/components/pdv/UnitSaleModal'
import { usePdvProducts } from '@/hooks/usePdvProducts'
import { formatCurrency } from '@/stores/saleStore'
import type { Product } from '@/types'

/**
 * Grid of active unit-type product buttons shown in the PDV below the
 * açaí-by-weight flow (Story 10.4 / EPIC-10).
 *
 * Tapping a card opens UnitSaleModal for that product. The açaí flow
 * (ScaleConnectionStatus → WeightDisplay → PriceDisplay → CasquinhaToggle
 * → PaymentMethodSelector → ConfirmSaleButton) is completely untouched.
 */
export function UnitProductsGrid() {
  const { data: products, isLoading, error, refetch } = usePdvProducts()
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)

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

  return (
    <>
      <div className="space-y-2">
        <p className="text-xs font-medium text-[#9d7bc8] uppercase tracking-wider">
          Produtos avulsos
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {products.map((product) => (
            <button
              key={product.id}
              onClick={() => handleProductClick(product)}
              className="flex flex-col items-start gap-1 rounded-xl bg-[#1a0b2e] border border-[#2d1550] px-3 py-3 text-left hover:bg-[#2d1550] hover:border-[#4c1e8c] transition-colors min-h-[4rem]"
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
