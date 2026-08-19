import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import type { ScaleMode } from '@/providers/scale/SerialScaleProvider'

/**
 * Como a balança desta loja conversa.
 *
 *   'continuous' — Urano UPX (loja 1): transmite o peso sozinha.
 *   'polling'    — Toledo Prix (loja 2): só responde quando recebe ENQ.
 *
 * Sai de `locations.scale_mode`.
 *
 * Toda falha cai em 'continuous' de propósito — coluna que ainda não existe
 * (migration não aplicada), rede fora, loja sem perfil carregado. 'continuous'
 * é o comportamento que já roda em produção, então o pior caso desta função é
 * a balança se comportar exatamente como antes. Nunca o contrário: começar a
 * escrever ENQ numa balança que não espera isso seria mudar, sem querer, uma
 * loja que está vendendo.
 */
export function useScaleMode(): ScaleMode {
  const locationId = useAuthStore((s) => s.profile?.location_id)

  const { data } = useQuery<ScaleMode>({
    queryKey: ['scale-mode', locationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('locations')
        .select('scale_mode')
        .eq('id', locationId!)
        .single()

      if (error) {
        console.warn('[Scale] Não consegui ler scale_mode, assumindo contínuo:', error.message)
        return 'continuous'
      }

      // Comparação explícita: qualquer valor inesperado vira 'continuous'.
      const modo = (data as { scale_mode?: string } | null)?.scale_mode
      return modo === 'polling' ? 'polling' : 'continuous'
    },
    enabled: !!locationId,
    staleTime: 10 * 60_000,
  })

  return data ?? 'continuous'
}
