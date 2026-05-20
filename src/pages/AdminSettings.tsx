import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { useProduct } from '@/hooks/useProduct'
import { useLocationData } from '@/hooks/useLocationData'
import { PriceHistory } from '@/components/settings/PriceHistory'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

// ─── Schemas ──────────────────────────────────────────────────────────────────

const priceSchema = z.object({
  price_per_kg: z
    .number()
    .min(1, 'Preço mínimo: R$1,00/kg')
    .max(1000, 'Preço máximo: R$1.000,00/kg'),
})
type PriceForm = z.infer<typeof priceSchema>

const locationSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(100, 'Máximo 100 caracteres'),
  address: z.string().max(200, 'Máximo 200 caracteres').optional(),
})
type LocationForm = z.infer<typeof locationSchema>

// ─── PriceCard ─────────────────────────────────────────────────────────────────

function PriceCard() {
  const queryClient = useQueryClient()
  const profile = useAuthStore((s) => s.profile)
  const { data: product, isLoading } = useProduct()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty, isValid },
  } = useForm<PriceForm>({ resolver: zodResolver(priceSchema), mode: 'onChange' })

  useEffect(() => {
    if (product) reset({ price_per_kg: product.price_per_gram * 1000 })
  }, [product, reset])

  async function onSubmit(values: PriceForm) {
    if (!product) return
    const { error } = await supabase
      .from('products')
      .update({ price_per_gram: values.price_per_kg / 1000 })
      .eq('id', product.id)
    if (error) {
      toast.error('Erro ao salvar preço. Tente novamente.')
      return
    }
    queryClient.invalidateQueries({ queryKey: ['product', profile?.location_id] })
    queryClient.invalidateQueries({ queryKey: ['price-per-gram', profile?.location_id] })
    queryClient.invalidateQueries({ queryKey: ['price-history', product.id] })
    toast.success('Preço atualizado com sucesso!')
    reset(values)
  }

  return (
    <Card className="bg-[#1a0b2e] border-[#2d1550]">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-[#9d7bc8]">Preço do Açaí</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm text-[#9d7bc8]" htmlFor="price_per_kg">
                Preço por quilo (R$/kg)
              </label>
              <input
                id="price_per_kg"
                type="number"
                step="0.01"
                min="1"
                max="1000"
                {...register('price_per_kg', { valueAsNumber: true })}
                className="w-full bg-[#0f0720] border border-[#2d1550] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#4c1e8c] focus:border-[#4c1e8c]"
              />
              {errors.price_per_kg && (
                <p className="text-red-400 text-xs">{errors.price_per_kg.message}</p>
              )}
              <p className="text-[#9d7bc8] text-xs">
                Ex: 65,00 = R$65,00/kg
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={!isDirty || !isValid || isSubmitting}
                className="px-4 py-2 text-sm rounded-lg bg-[#4c1e8c] text-white hover:bg-[#5B2D8E] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {isSubmitting ? 'Salvando...' : 'Salvar'}
              </button>
              <button
                type="button"
                onClick={() => reset({ price_per_kg: product ? product.price_per_gram * 1000 : undefined })}
                disabled={!isDirty}
                className="px-4 py-2 text-sm rounded-lg text-[#9d7bc8] hover:bg-[#2d1550] hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Cancelar
              </button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  )
}

// ─── LocationCard ──────────────────────────────────────────────────────────────

function LocationCard() {
  const queryClient = useQueryClient()
  const profile = useAuthStore((s) => s.profile)
  const isAdmin = profile?.role === 'admin'
  const { data: location, isLoading } = useLocationData()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty, isValid },
  } = useForm<LocationForm>({ resolver: zodResolver(locationSchema), mode: 'onChange' })

  useEffect(() => {
    if (location) reset({ name: location.name, address: location.address ?? '' })
  }, [location, reset])

  async function onSubmit(values: LocationForm) {
    if (!location) return
    const { error } = await supabase
      .from('locations')
      .update({ name: values.name, address: values.address || null })
      .eq('id', location.id)
    if (error) {
      toast.error('Erro ao salvar informações da loja.')
      return
    }
    queryClient.invalidateQueries({ queryKey: ['location', profile?.location_id] })
    toast.success('Informações da loja atualizadas!')
    reset(values)
  }

  return (
    <Card className="bg-[#1a0b2e] border-[#2d1550]">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-[#9d7bc8]">Informações da Loja</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm text-[#9d7bc8]" htmlFor="loc-name">
                Nome da loja
              </label>
              <input
                id="loc-name"
                type="text"
                disabled={!isAdmin}
                {...register('name')}
                className="w-full bg-[#0f0720] border border-[#2d1550] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#4c1e8c] focus:border-[#4c1e8c] disabled:opacity-50 disabled:cursor-not-allowed"
              />
              {errors.name && <p className="text-red-400 text-xs">{errors.name.message}</p>}
            </div>
            <div className="space-y-1.5">
              <label className="text-sm text-[#9d7bc8]" htmlFor="loc-address">
                Endereço <span className="text-xs">(opcional)</span>
              </label>
              <input
                id="loc-address"
                type="text"
                disabled={!isAdmin}
                {...register('address')}
                className="w-full bg-[#0f0720] border border-[#2d1550] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#4c1e8c] focus:border-[#4c1e8c] disabled:opacity-50 disabled:cursor-not-allowed"
              />
              {errors.address && <p className="text-red-400 text-xs">{errors.address.message}</p>}
            </div>
            {isAdmin && (
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={!isDirty || !isValid || isSubmitting}
                  className="px-4 py-2 text-sm rounded-lg bg-[#4c1e8c] text-white hover:bg-[#5B2D8E] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {isSubmitting ? 'Salvando...' : 'Salvar'}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    reset({ name: location?.name, address: location?.address ?? '' })
                  }
                  disabled={!isDirty}
                  className="px-4 py-2 text-sm rounded-lg text-[#9d7bc8] hover:bg-[#2d1550] hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Cancelar
                </button>
              </div>
            )}
          </form>
        )}
      </CardContent>
    </Card>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminSettings() {
  const { data: product } = useProduct()

  return (
    <div className="p-6 space-y-6 max-w-2xl mx-auto">
      <h1 className="text-xl font-semibold text-white">Configurações</h1>
      <PriceCard />
      <LocationCard />
      {product && <PriceHistory productId={product.id} />}
    </div>
  )
}
