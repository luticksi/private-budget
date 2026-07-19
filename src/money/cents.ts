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

/** Currency symbols that may sit next to a number without changing its value. */
const CURRENCY_SYMBOLS = '$€£¥₹¢₽₩'

/**
 * A bare number once symbols and spaces are gone: digits, optionally broken up
 * by `.`/`,` groups. Anything else (`12:34:56`, `1-2`, `12/34`) is not money.
 */
const NUMERIC = /^\d+(?:[.,]\d+)*$/

/**
 * Parse a value from a statement into integer cents. Handles currency symbols
 * and ISO codes, thousands separators, European decimals,
 * parentheses-as-negative, leading/trailing minus signs, and the trailing
 * `CR`/`DR` markers some banks use instead of a sign. Returns null if it can't
 * be parsed — including for values that merely *contain* digits, so that
 * ids, times, and dates are never mistaken for amounts.
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
    s = s.slice(1, -1).trim()
  }

  // Trailing CR/DR marker: DR (debit) is money out, CR (credit) is money in.
  const marker = /\s*\b(CR|DR)\b\.?$/i.exec(s)
  if (marker) {
    if (marker[1].toUpperCase() === 'DR') negative = true
    s = s.slice(0, marker.index).trim()
  }

  // ISO currency code on either side, e.g. "USD 42.00" or "42.00 EUR".
  s = s.replace(/^[A-Za-z]{3}\s+/, '').replace(/\s+[A-Za-z]{3}$/, '').trim()

  if (s.startsWith('-')) {
    negative = true
    s = s.slice(1)
  } else if (s.endsWith('-')) {
    negative = true
    s = s.slice(0, -1)
  } else if (s.startsWith('+')) {
    s = s.slice(1)
  }

  // Strip currency symbols and internal spaces, then require what's left to be
  // a plain number. Unknown characters make the value unparseable rather than
  // being silently removed.
  s = s.replace(new RegExp(`[${CURRENCY_SYMBOLS}\\s]`, 'g'), '')
  if (!NUMERIC.test(s)) return null

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
