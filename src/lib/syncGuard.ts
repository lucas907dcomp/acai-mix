/**
 * DA-4 (EPIC-11): bloqueia a troca de loja enquanto houver vendas
 * offline pendentes de sincronização, mesmo padrão de guarda já usado
 * em `syncStore.cancelPending` (EPIC-09). Sem dependências — arquivo
 * isolado de propósito para ser testável sem puxar a cadeia de stores
 * (Supabase client, Dexie/IndexedDB).
 */
export function shouldBlockLocationSwitch(pendingCount: number, isSyncing: boolean): boolean {
  return pendingCount > 0 || isSyncing
}
