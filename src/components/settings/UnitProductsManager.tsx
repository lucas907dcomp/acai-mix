import { useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useUnitProducts } from '@/hooks/useUnitProducts'
import { ProductCard } from './ProductCard'
import { ProductForm } from './ProductForm'
import type { Product } from '@/types'

type DialogState =
  | { mode: 'closed' }
  | { mode: 'create' }
  | { mode: 'edit'; product: Product }

export function UnitProductsManager() {
  const { data: products, isLoading, error } = useUnitProducts()
  const [dialogState, setDialogState] = useState<DialogState>({ mode: 'closed' })

  const list = useMemo(() => products ?? [], [products])

  // sort_order suggestion for new products: max existing + 10 (or 0 for empty list).
  const nextSortOrder = useMemo(() => {
    if (list.length === 0) return 0
    const max = list.reduce((acc, p) => (p.sort_order > acc ? p.sort_order : acc), 0)
    return max + 10
  }, [list])

  const existingNames = useMemo(() => list.map((p) => p.name), [list])

  const isDialogOpen = dialogState.mode !== 'closed'

  function closeDialog() {
    setDialogState({ mode: 'closed' })
  }

  return (
    <>
      <Card className="bg-[#1a0b2e] border-[#2d1550]">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-[#9d7bc8]">Produtos Avulsos</CardTitle>
          <button
            type="button"
            onClick={() => setDialogState({ mode: 'create' })}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md bg-[#4c1e8c] text-white hover:bg-[#5B2D8E] transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Novo produto
          </button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : error ? (
            <p className="text-red-400 text-sm py-6 text-center">
              Erro ao carregar produtos: {error instanceof Error ? error.message : 'desconhecido'}
            </p>
          ) : list.length === 0 ? (
            <p className="text-center text-[#9d7bc8] text-sm py-6">
              Nenhum produto avulso cadastrado ainda.
            </p>
          ) : (
            <div className="space-y-2">
              {list.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onEdit={(p) => setDialogState({ mode: 'edit', product: p })}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="bg-[#1a0b2e] border-[#2d1550] text-white">
          <DialogHeader>
            <DialogTitle className="text-white">
              {dialogState.mode === 'edit' ? 'Editar produto' : 'Novo produto avulso'}
            </DialogTitle>
            <DialogDescription className="text-[#9d7bc8]">
              {dialogState.mode === 'edit'
                ? 'Atualize os dados do produto. Para remover do PDV, use o botão Desativar na lista.'
                : 'Cadastre um produto unitário (picolé, água, refrigerante, etc.).'}
            </DialogDescription>
          </DialogHeader>
          {dialogState.mode !== 'closed' && (
            <ProductForm
              product={dialogState.mode === 'edit' ? dialogState.product : undefined}
              defaultSortOrder={nextSortOrder}
              existingNames={existingNames}
              onSuccess={closeDialog}
              onCancel={closeDialog}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
