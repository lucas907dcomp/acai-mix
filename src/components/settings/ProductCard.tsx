import { useState } from 'react'
import { toast } from 'sonner'
import { Pencil } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { useUpdateProduct } from '@/hooks/useProductMutations'
import type { Product } from '@/types'

const priceFmt = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

interface ProductCardProps {
  product: Product
  onEdit: (product: Product) => void
}

export function ProductCard({ product, onEdit }: ProductCardProps) {
  const updateMutation = useUpdateProduct()
  const [pendingToggle, setPendingToggle] = useState(false)

  const isActive = product.active
  const priceLabel =
    product.unit_price != null ? priceFmt.format(Number(product.unit_price)) : 'R$ 0,00'

  async function toggleActive() {
    const nextActive = !isActive
    const verb = nextActive ? 'reativar' : 'desativar'
    const confirmed = window.confirm(
      `Deseja ${verb} o produto "${product.name}"?\n\n` +
        (nextActive
          ? 'Ele voltará a aparecer no PDV.'
          : 'Ele deixará de aparecer no PDV, mas o histórico de vendas é preservado.')
    )
    if (!confirmed) return

    setPendingToggle(true)
    try {
      await updateMutation.mutateAsync({ id: product.id, active: nextActive })
      toast.success(nextActive ? 'Produto reativado.' : 'Produto desativado.')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao atualizar produto'
      const friendly = message.toLowerCase().includes('row-level security')
        ? 'Permissão negada. Apenas administradores podem alterar produtos.'
        : message
      toast.error(friendly)
    } finally {
      setPendingToggle(false)
    }
  }

  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-lg border border-[#2d1550] bg-[#0f0720] px-4 py-3 transition-opacity ${
        isActive ? '' : 'opacity-60'
      }`}
    >
      <div className="flex flex-col min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-white text-sm font-medium truncate">{product.name}</span>
          <Badge
            variant={isActive ? 'default' : 'secondary'}
            className={
              isActive
                ? 'bg-green-700/40 text-green-300 border-green-700/60 hover:bg-green-700/40'
                : 'bg-[#2d1550] text-[#9d7bc8] border-[#2d1550] hover:bg-[#2d1550]'
            }
          >
            {isActive ? 'Ativo' : 'Inativo'}
          </Badge>
        </div>
        <div className="text-[#9d7bc8] text-xs mt-1">
          {priceLabel}
          <span className="mx-1.5">·</span>
          Ordem: {product.sort_order}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={() => onEdit(product)}
          className="p-2 rounded-md text-[#9d7bc8] hover:bg-[#2d1550] hover:text-white transition-colors"
          aria-label={`Editar ${product.name}`}
          title="Editar"
        >
          <Pencil className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={toggleActive}
          disabled={pendingToggle}
          className={`px-3 py-1.5 text-xs rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
            isActive
              ? 'text-[#9d7bc8] hover:bg-[#2d1550] hover:text-white'
              : 'text-green-300 hover:bg-green-700/30'
          }`}
        >
          {pendingToggle ? '...' : isActive ? 'Desativar' : 'Reativar'}
        </button>
      </div>
    </div>
  )
}
