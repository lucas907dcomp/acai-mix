export const GRACE_DAYS = 5

/** Bloqueia depois de paid_until + carência (pago até dia 20 -> para no dia 26). NULL = nunca bloqueia. */
export function isBillingBlocked(paidUntil: string | null | undefined, now = new Date()): boolean {
  if (!paidUntil) return false
  const limit = new Date(paidUntil).getTime() + GRACE_DAYS * 86_400_000
  return Number.isFinite(limit) && now.getTime() > limit
}
