import { describe, it, expect } from 'vitest'
import { parseAmountToCents, formatCents, sumCents } from './cents'

describe('parseAmountToCents', () => {
  it('parses plain decimals', () => {
    expect(parseAmountToCents('12.34')).toBe(1234)
    expect(parseAmountToCents('0.99')).toBe(99)
    expect(parseAmountToCents('100')).toBe(10000)
  })

  it('handles currency symbols and thousands separators', () => {
    expect(parseAmountToCents('$1,234.56')).toBe(123456)
    expect(parseAmountToCents('1,234,567.89')).toBe(123456789)
    expect(parseAmountToCents('USD 42.00')).toBe(4200)
  })

  it('treats parentheses as negative', () => {
    expect(parseAmountToCents('(12.34)')).toBe(-1234)
    expect(parseAmountToCents('($1,000.00)')).toBe(-100000)
  })

  it('handles leading and trailing minus signs', () => {
    expect(parseAmountToCents('-12.34')).toBe(-1234)
    expect(parseAmountToCents('12.34-')).toBe(-1234)
  })

  it('handles european-style decimals', () => {
    expect(parseAmountToCents('1.234,56')).toBe(123456)
    expect(parseAmountToCents('1234,56')).toBe(123456)
  })

  it('treats a lone 3-digit group as thousands', () => {
    expect(parseAmountToCents('1,234')).toBe(123400)
  })

  it('accepts numeric input', () => {
    expect(parseAmountToCents(12.34)).toBe(1234)
    expect(parseAmountToCents(-5)).toBe(-500)
  })

  it('returns null for empty or junk input', () => {
    expect(parseAmountToCents('')).toBeNull()
    expect(parseAmountToCents('   ')).toBeNull()
    expect(parseAmountToCents(null)).toBeNull()
    expect(parseAmountToCents(undefined)).toBeNull()
    expect(parseAmountToCents('abc')).toBeNull()
  })
})

describe('formatCents', () => {
  it('formats positive and negative amounts', () => {
    expect(formatCents(123456)).toMatch(/1,234\.56/)
    expect(formatCents(123456)).toContain('$')
    const neg = formatCents(-99)
    expect(neg).toContain('-')
    expect(neg).toMatch(/0\.99/)
  })
})

describe('sumCents', () => {
  it('sums signed integer cents', () => {
    expect(sumCents([100, 200, -50])).toBe(250)
    expect(sumCents([])).toBe(0)
  })
})
