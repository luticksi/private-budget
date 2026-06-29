/**
 * Money is always stored and computed as signed integer cents — never floats —
 * to avoid rounding drift. Display formatting is the only place we divide by 100.
 */

/** Normalize a numeric string's separators to a plain `1234.56` form. */
function normalizeDecimal(s: string): string {
  const hasComma = s.includes(',')
  const hasDot = s.includes('.')

  if (hasComma && hasDot) {
    // Both present: the separator that appears last is the decimal point.
    const decimalSep = s.lastIndexOf(',') > s.lastIndexOf('.') ? ',' : '.'
    const thousandsSep = decimalSep === ',' ? '.' : ','
    s = s.split(thousandsSep).join('')
    return decimalSep === ',' ? s.replace(',', '.') : s
  }

  const sep = hasComma ? ',' : hasDot ? '.' : ''
  if (!sep) return s

  const occurrences = s.split(sep).length - 1
  if (occurrences > 1) {
    // e.g. "1,234,567" — must be a thousands separator.
    return s.split(sep).join('')
  }

  // A single separator is ambiguous. If exactly three digits follow it,
  // treat it as a thousands separator ("1,234"); otherwise a decimal point.
  const after = s.slice(s.lastIndexOf(sep) + 1)
  if (after.length === 3) return s.split(sep).join('')
  return sep === ',' ? s.replace(',', '.') : s
}

/**
 * Parse a value from a statement into integer cents. Handles currency symbols,
 * thousands separators, European decimals, parentheses-as-negative, and
 * leading/trailing minus signs. Returns null if it can't be parsed.
 */
export function parseAmountToCents(
  input: string | number | null | undefined,
): number | null {
  if (input == null) return null
  if (typeof input === 'number') {
    return Number.isFinite(input) ? Math.round(input * 100) : null
  }

  let s = input.trim()
  if (s === '') return null

  let negative = false
  if (/^\(.*\)$/.test(s)) {
    negative = true
    s = s.slice(1, -1)
  }
  if (s.startsWith('-')) {
    negative = true
    s = s.slice(1)
  } else if (s.endsWith('-')) {
    negative = true
    s = s.slice(0, -1)
  } else if (s.startsWith('+')) {
    s = s.slice(1)
  }

  s = s.replace(/[^\d.,]/g, '') // strip currency symbols, spaces, etc.
  if (s === '') return null

  const value = Number(normalizeDecimal(s))
  if (!Number.isFinite(value)) return null

  const cents = Math.round(value * 100)
  return negative ? -cents : cents
}

/** Format integer cents as a localized currency string. */
export function formatCents(
  cents: number,
  currency = 'USD',
  opts?: { signDisplay?: 'auto' | 'never' | 'always' | 'exceptZero' },
): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    signDisplay: opts?.signDisplay ?? 'auto',
  }).format(cents / 100)
}

export function sumCents(values: number[]): number {
  return values.reduce((acc, v) => acc + v, 0)
}

export const absCents = (cents: number): number => Math.abs(cents)
