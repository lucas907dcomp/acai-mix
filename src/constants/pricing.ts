/**
 * Pricing constants and pure helpers.
 *
 * EPIC-10 / Story 10.1 — adiciona o adicional "Casquinha" às vendas de açaí
 * por peso. Nasceu fixo em R$ 1,00 por decisão de produto (AC9), quando havia
 * uma loja só.
 *
 * 19/08/2026 — passou a variar por loja (locations.casquinha_price): a AçaiMix
 * Barra cobra R$ 2,00. O valor abaixo continua sendo o padrão de quem não
 * define o seu, o que preserva o comportamento anterior à coluna.
 */

/** Preço usado quando a loja não define o seu — o valor de sempre. */
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
 * @param hasCasquinha  whether the casquinha add-on is applied
 * @param casquinhaPrice preço da casquinha nesta loja (default: CASQUINHA_PRICE)
 * @returns amount in BRL with 2 decimal places
 */
export function calcSaleAmount(
  weightG: number,
  pricePerGram: number,
  hasCasquinha: boolean,
  casquinhaPrice: number = CASQUINHA_PRICE,
): number {
  const pricePerKgCents = Math.round(pricePerGram * 100_000)
  const baseCents = Math.round((weightG * pricePerKgCents) / 1_000)
  const casquinhaCents = hasCasquinha ? Math.round(casquinhaPrice * 100) : 0
  return (baseCents + casquinhaCents) / 100
}
