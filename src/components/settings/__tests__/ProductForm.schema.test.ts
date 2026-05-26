// Tests the Zod schema that powers ProductForm. We intentionally extract
// and re-declare the schema here (instead of importing from the .tsx) so
// that adding JSX-dependent imports to the .tsx never breaks these pure
// schema tests. The schema MUST stay in sync — any divergence is a bug.
import { describe, it, expect } from 'vitest'
import { z } from 'zod'

// Mirror of the schema declared inside ProductForm.tsx. If the form's
// validation rules change, update both places.
const productSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Nome obrigatório')
    .max(60, 'Máximo 60 caracteres'),
  unit_price: z
    .number({ message: 'Preço obrigatório' })
    .min(0.01, 'Preço mínimo R$ 0,01')
    .max(999.99, 'Preço máximo R$ 999,99'),
  sort_order: z
    .number({ message: 'Ordem inválida' })
    .int('Ordem deve ser um número inteiro')
    .min(0, 'Ordem deve ser >= 0'),
})

describe('ProductForm Zod schema', () => {
  const validRow = { name: 'Picolé de coco', unit_price: 7.5, sort_order: 10 }

  it('accepts a valid row', () => {
    const r = productSchema.safeParse(validRow)
    expect(r.success).toBe(true)
  })

  it('rejects empty name', () => {
    const r = productSchema.safeParse({ ...validRow, name: '' })
    expect(r.success).toBe(false)
  })

  it('rejects whitespace-only name (after trim)', () => {
    const r = productSchema.safeParse({ ...validRow, name: '   ' })
    expect(r.success).toBe(false)
  })

  it('trims name on parse', () => {
    const r = productSchema.safeParse({ ...validRow, name: '  Água  ' })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.name).toBe('Água')
  })

  it('rejects name longer than 60 chars', () => {
    const long = 'a'.repeat(61)
    const r = productSchema.safeParse({ ...validRow, name: long })
    expect(r.success).toBe(false)
  })

  it('rejects unit_price below 0.01', () => {
    const r = productSchema.safeParse({ ...validRow, unit_price: 0 })
    expect(r.success).toBe(false)
  })

  it('rejects unit_price above 999.99', () => {
    const r = productSchema.safeParse({ ...validRow, unit_price: 1000 })
    expect(r.success).toBe(false)
  })

  it('rejects negative unit_price', () => {
    const r = productSchema.safeParse({ ...validRow, unit_price: -1 })
    expect(r.success).toBe(false)
  })

  it('rejects non-numeric unit_price', () => {
    const r = productSchema.safeParse({ ...validRow, unit_price: 'abc' as unknown as number })
    expect(r.success).toBe(false)
  })

  it('rejects negative sort_order', () => {
    const r = productSchema.safeParse({ ...validRow, sort_order: -1 })
    expect(r.success).toBe(false)
  })

  it('rejects non-integer sort_order', () => {
    const r = productSchema.safeParse({ ...validRow, sort_order: 1.5 })
    expect(r.success).toBe(false)
  })

  it('accepts sort_order = 0', () => {
    const r = productSchema.safeParse({ ...validRow, sort_order: 0 })
    expect(r.success).toBe(true)
  })
})

// Uniqueness is enforced outside the schema (in onSubmit) since it depends
// on the loaded list. We test the rule here as a pure helper to lock the
// case-insensitive, trim-aware behavior.
function isNameTaken(input: string, existing: string[], currentName = ''): boolean {
  const normalized = input.trim().toLowerCase()
  return existing
    .filter((n) => n.toLowerCase() !== currentName.toLowerCase())
    .some((n) => n.toLowerCase() === normalized)
}

describe('ProductForm uniqueness check', () => {
  it('flags an exact duplicate', () => {
    expect(isNameTaken('Picolé', ['Picolé', 'Água'])).toBe(true)
  })

  it('is case-insensitive', () => {
    expect(isNameTaken('PICOLÉ', ['Picolé'])).toBe(true)
  })

  it('ignores leading/trailing whitespace', () => {
    expect(isNameTaken('  Picolé  ', ['Picolé'])).toBe(true)
  })

  it('does not flag the product being edited', () => {
    expect(isNameTaken('Picolé', ['Picolé', 'Água'], 'Picolé')).toBe(false)
  })

  it('returns false when name is unique', () => {
    expect(isNameTaken('Refrigerante', ['Picolé', 'Água'])).toBe(false)
  })
})
