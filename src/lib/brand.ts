export const BRAND_KEY = 'pdv-brand'

/** Marca da última loja que logou neste aparelho, ou 'PDV'. */
export function lastBrand(): string {
  try {
    return localStorage.getItem(BRAND_KEY) || 'PDV'
  } catch {
    return 'PDV'
  }
}
