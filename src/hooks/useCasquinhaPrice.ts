import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { useSaleStore } from '@/stores/saleStore'
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
 *
 * O hook também empurra o preço para o saleStore, e isso não é efeito colateral
 * gratuito: o store é quem calcula o valor cobrado, não é componente e não pode
 * usar hook, então alguém precisa levar o número até lá. Essa ponte existia
 * dentro do CasquinhaToggle, um componente que nunca chegou a ser montado — o
 * rótulo lia este hook e mostrava "+R$ 2,00" enquanto o total somava o R$ 1,00
 * parado no store. Sincronizando aqui, qualquer tela que mostre o preço já
 * deixa o cálculo com o mesmo valor: não dá para exibir um número e cobrar
 * outro.
 */
export function useCasquinhaPrice(): number {
  const locationId = useAuthStore((s) => s.profile?.location_id)
  const setCasquinhaPrice = useSaleStore((s) => s.setCasquinhaPrice)

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

  const price = data ?? CASQUINHA_PRICE

  useEffect(() => {
    setCasquinhaPrice(price)
  }, [price, setCasquinhaPrice])

  return price
}
