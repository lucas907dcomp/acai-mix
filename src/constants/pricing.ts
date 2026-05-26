/**
 * Pricing constants and pure helpers.
 *
 * EPIC-10 / Story 10.1 — adds the fixed-price "Casquinha" add-on
 * (R$ 1,00) to açaí-by-weight sales. The value is hardcoded by
 * product decision (AC9) — no configuration UI is exposed for it.
 */

export const CASQUINHA_PRICE = 1.0 as const

/**
 * Computes the final sale amount in BRL for an açaí-by-weight sale.
 *
 * Uses integer-cents math to avoid float drift on the base (weight *
 * price-per-gram) calculation, matching the existing approach in
 * `saleStore.captureWeight`. The casquinha add-on is added as a
 * whole-real value and the result is rounded to 2 decimals.
 *
 * @param weightG       weight in grams (>= 0)
 * @param pricePerGram  price per gram in BRL (e.g. 0.065 = R$ 0,065/g)
 * @param hasCasquinha  whether the +R$ 1,00 add-on is applied
 * @returns amount in BRL with 2 decimal places
 */
export function calcSaleAmount(
  weightG: number,
  pricePerGram: number,
  hasCasquinha: boolean,
): number {
  const pricePerKgCents = Math.round(pricePerGram * 100_000)
  const baseCents = Math.round((weightG * pricePerKgCents) / 1_000)
  const casquinhaCents = hasCasquinha ? Math.round(CASQUINHA_PRICE * 100) : 0
  return (baseCents + casquinhaCents) / 100
}
