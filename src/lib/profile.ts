import { supabase } from '@/lib/supabase'

/**
 * Busca as lojas vinculadas a um usuário `owner` via `user_locations`.
 * Usado por useAuth.ts e AuthProvider.tsx (EPIC-11 / Story 11.3) —
 * extraído para evitar duplicar a query de join em dois lugares.
 */
export async function fetchOwnerLocations(userId: string): Promise<{ id: string; name: string }[]> {
  const { data, error } = await supabase
    .from('user_locations')
    .select('locations(id, name)')
    .eq('user_id', userId)

  if (error || !data) return []

  return data
    .map((row) => row.locations)
    .filter((loc): loc is { id: string; name: string } => loc !== null)
}
