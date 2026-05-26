import { useMutation } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { queryClient } from '@/lib/queryClient'
import { useAuthStore } from '@/stores/authStore'
import type { Product } from '@/types'

interface CreateProductInput {
  name: string
  unit_price: number
  sort_order: number
  active?: boolean
}

interface UpdateProductInput {
  id: string
  name?: string
  unit_price?: number
  sort_order?: number
  active?: boolean
}

function invalidateProductQueries(locationId: string | undefined) {
  if (!locationId) return
  queryClient.invalidateQueries({ queryKey: ['products', 'unit', locationId] })
  // Story 10.4 PDV cache — keep in sync even before that story ships.
  queryClient.invalidateQueries({ queryKey: ['products', 'pdv', locationId] })
}

/**
 * Creates a new unit-type product for the current location.
 * Always sets product_type='unit'. Açaí (weight product) is managed elsewhere.
 *
 * Sets created_by = auth.uid() so the audit columns added in Story 10.2 are populated.
 */
export function useCreateProduct() {
  const locationId = useAuthStore((s) => s.profile?.location_id)

  return useMutation<Product, Error, CreateProductInput>({
    mutationFn: async (input) => {
      if (!locationId) throw new Error('Location ID not available')
      const { data: { user } } = await supabase.auth.getUser()

      const { data, error } = await supabase
        .from('products')
        .insert({
          name: input.name,
          unit_price: input.unit_price,
          sort_order: input.sort_order,
          active: input.active ?? true,
          product_type: 'unit',
          location_id: locationId,
          created_by: user?.id ?? null,
          updated_by: user?.id ?? null,
          // price_per_gram is NOT NULL with CHECK (price_per_gram > 0) in the
          // base schema (migration 001) and Story 10.2 (migration 010) did not
          // relax it for unit products. We pass a sentinel 0.0001 so the
          // constraint is satisfied — the value is ignored by the PDV for
          // unit-type products (which use unit_price instead). If the schema
          // is ever updated to allow NULL for unit products, drop this field.
          price_per_gram: 0.0001,
        })
        .select()
        .single()

      if (error) throw error
      return data as unknown as Product
    },
    onSuccess: () => {
      invalidateProductQueries(locationId)
    },
  })
}

/**
 * Updates an existing unit product. Only the fields provided are sent to the
 * server (partial update). `updated_by` is always set so the audit columns
 * added in Story 10.2 are populated.
 *
 * IMPORTANT: This hook does NOT delete products. The sales.product_id FK is
 * ON DELETE RESTRICT — to remove a product from the catalog, set active=false.
 */
export function useUpdateProduct() {
  const locationId = useAuthStore((s) => s.profile?.location_id)

  return useMutation<Product, Error, UpdateProductInput>({
    mutationFn: async ({ id, ...patch }) => {
      const { data: { user } } = await supabase.auth.getUser()

      const updatePayload: {
        updated_by: string | null
        name?: string
        unit_price?: number
        sort_order?: number
        active?: boolean
      } = {
        updated_by: user?.id ?? null,
        ...(patch.name !== undefined && { name: patch.name }),
        ...(patch.unit_price !== undefined && { unit_price: patch.unit_price }),
        ...(patch.sort_order !== undefined && { sort_order: patch.sort_order }),
        ...(patch.active !== undefined && { active: patch.active }),
      }

      const { data, error } = await supabase
        .from('products')
        .update(updatePayload)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data as unknown as Product
    },
    onSuccess: () => {
      invalidateProductQueries(locationId)
    },
  })
}
