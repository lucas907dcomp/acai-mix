export function getQuickValues(amount: number): number[] {
  const next5 = Math.ceil(amount / 5) * 5
  const next10 = Math.ceil(amount / 10) * 10
  const next20 = Math.ceil(amount / 20) * 20
  const candidates = [next5, next10, next20, 50, 100]
  return Array.from(new Set(candidates.filter((v) => v >= amount)))
    .sort((a, b) => a - b)
    .slice(0, 5)
}
