import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { useCreateProduct, useUpdateProduct } from '@/hooks/useProductMutations'
import type { Product } from '@/types'

// ─── Schema ────────────────────────────────────────────────────────────────────

const productSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Nome obrigatório')
    .max(60, 'Máximo 60 caracteres'),
  unit_price: z
    .number({ message: 'Preço obrigatório' })
    .min(0.01, 'Preço mínimo R$ 0,01')
    .max(999.99, 'Preço máximo R$ 999,99'),
  sort_order: z
    .number({ message: 'Ordem inválida' })
    .int('Ordem deve ser um número inteiro')
    .min(0, 'Ordem deve ser >= 0'),
})

export type ProductFormValues = z.infer<typeof productSchema>

// ─── Props ─────────────────────────────────────────────────────────────────────

interface ProductFormProps {
  /** Product being edited. Undefined = create mode. */
  product?: Product
  /**
   * Suggested sort_order for new products (max existing + 10).
   * Ignored when editing.
   */
  defaultSortOrder?: number
  /** Existing names in the same location for client-side uniqueness check. */
  existingNames: string[]
  /** Called after a successful create/update so the parent can close the dialog. */
  onSuccess: () => void
  /** Called when user clicks Cancel. */
  onCancel: () => void
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function ProductForm({
  product,
  defaultSortOrder = 0,
  existingNames,
  onSuccess,
  onCancel,
}: ProductFormProps) {
  const isEditMode = !!product
  const createMutation = useCreateProduct()
  const updateMutation = useUpdateProduct()

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting, isValid },
  } = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    mode: 'onChange',
    defaultValues: {
      name: product?.name ?? '',
      unit_price: product?.unit_price ?? undefined,
      sort_order: product?.sort_order ?? defaultSortOrder,
    },
  })

  useEffect(() => {
    reset({
      name: product?.name ?? '',
      unit_price: product?.unit_price ?? undefined,
      sort_order: product?.sort_order ?? defaultSortOrder,
    })
  }, [product, defaultSortOrder, reset])

  async function onSubmit(values: ProductFormValues) {
    // Client-side uniqueness check: case-insensitive, trimmed, ignoring the
    // product being edited. RLS + a DB unique index would be a stronger guard
    // but at the time of writing the schema does not enforce it, so we check
    // here to give immediate feedback.
    const normalized = values.name.trim().toLowerCase()
    const taken = existingNames
      .filter((n) => n.toLowerCase() !== (product?.name ?? '').toLowerCase())
      .some((n) => n.toLowerCase() === normalized)

    if (taken) {
      setError('name', { type: 'manual', message: 'Já existe um produto com esse nome' })
      return
    }

    try {
      if (isEditMode) {
        await updateMutation.mutateAsync({
          id: product!.id,
          name: values.name.trim(),
          unit_price: values.unit_price,
          sort_order: values.sort_order,
        })
        toast.success('Produto atualizado com sucesso!')
      } else {
        await createMutation.mutateAsync({
          name: values.name.trim(),
          unit_price: values.unit_price,
          sort_order: values.sort_order,
          active: true,
        })
        toast.success('Produto criado com sucesso!')
      }
      onSuccess()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao salvar produto'
      // Heuristic: RLS denials surface as 'new row violates row-level security policy'
      const friendly = message.toLowerCase().includes('row-level security')
        ? 'Permissão negada. Apenas administradores podem cadastrar produtos.'
        : message
      toast.error(friendly)
    }
  }

  const inputClass =
    'w-full bg-[#0f0720] border border-[#2d1550] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#4c1e8c] focus:border-[#4c1e8c]'

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-1.5">
        <label className="text-sm text-[#9d7bc8]" htmlFor="product-name">
          Nome
        </label>
        <input
          id="product-name"
          type="text"
          maxLength={60}
          autoFocus
          {...register('name')}
          className={inputClass}
          placeholder="Ex: Picolé de coco"
        />
        {errors.name && <p className="text-red-400 text-xs">{errors.name.message}</p>}
      </div>

      <div className="space-y-1.5">
        <label className="text-sm text-[#9d7bc8]" htmlFor="product-unit-price">
          Preço unitário (R$)
        </label>
        <input
          id="product-unit-price"
          type="number"
          step="0.01"
          min="0.01"
          max="999.99"
          {...register('unit_price', { valueAsNumber: true })}
          className={inputClass}
          placeholder="0,00"
        />
        {errors.unit_price && (
          <p className="text-red-400 text-xs">{errors.unit_price.message}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <label className="text-sm text-[#9d7bc8]" htmlFor="product-sort-order">
          Ordem de exibição
        </label>
        <input
          id="product-sort-order"
          type="number"
          step="1"
          min="0"
          {...register('sort_order', { valueAsNumber: true })}
          className={inputClass}
        />
        {errors.sort_order && (
          <p className="text-red-400 text-xs">{errors.sort_order.message}</p>
        )}
        <p className="text-[#9d7bc8] text-xs">
          Menor valor aparece primeiro no PDV.
        </p>
      </div>

      <div className="flex gap-2 justify-end pt-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="px-4 py-2 text-sm rounded-lg text-[#9d7bc8] hover:bg-[#2d1550] hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={!isValid || isSubmitting}
          className="px-4 py-2 text-sm rounded-lg bg-[#4c1e8c] text-white hover:bg-[#5B2D8E] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {isSubmitting ? 'Salvando...' : isEditMode ? 'Salvar alterações' : 'Criar produto'}
        </button>
      </div>
    </form>
  )
}
