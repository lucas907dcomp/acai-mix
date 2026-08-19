import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { CASQUINHA_PRICE } from '@/constants/pricing'

/**
 * Preço da casquinha nesta loja (locations.casquinha_price).
 *
 * Era R$ 1,00 fixo no código, o que valia com uma loja só. A AçaiMix Barra
 * cobra R$ 2,00.
 *
 * Qualquer falha cai em CASQUINHA_PRICE (R$ 1,00) — coluna inexistente, rede
 * fora, valor inválido. Este número entra no valor cobrado do cliente, então
 * o fallback é o preço que já era praticado, nunca um palpite.
 */
export function useCasquinhaPrice(): number {
  const locationId = useAuthStore((s) => s.profile?.location_id)

  const { data } = useQuery<number>({
    queryKey: ['casquinha-price', locationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('locations')
        .select('casquinha_price')
        .eq('id', locationId!)
        .single()

      if (error) {
        console.warn('[Casquinha] Não consegui ler o preço, usando padrão:', error.message)
        return CASQUINHA_PRICE
      }

      const preco = Number((data as { casquinha_price?: number } | null)?.casquinha_price)
      return Number.isFinite(preco) && preco > 0 ? preco : CASQUINHA_PRICE
    },
    enabled: !!locationId,
    staleTime: 10 * 60_000,
  })

  return data ?? CASQUINHA_PRICE
}
