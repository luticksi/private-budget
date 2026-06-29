import { describe, it, expect } from 'vitest'
import { matchRule, categorizeWith } from './engine'
import type { CategoryKind, Rule } from '../db/schema'

const mkRule = (over: Partial<Rule>): Rule => ({
  field: 'rawDescription',
  match: 'contains',
  pattern: 'x',
  categoryId: 1,
  priority: 10,
  source: 'builtin',
  enabled: true,
  createdAt: 0,
  ...over,
})

const input = {
  normalizedMerchant: '',
  rawDescription: 'STARBUCKS #123 SEATTLE',
  amountCents: -575,
  isCreditAccount: false,
}

describe('matchRule', () => {
  it('supports contains / startsWith / equals / regex (case-insensitive)', () => {
    expect(matchRule(mkRule({ match: 'contains', pattern: 'starbucks' }), input)).toBe(true)
    expect(matchRule(mkRule({ match: 'startsWith', pattern: 'star' }), input)).toBe(true)
    expect(
      matchRule(mkRule({ match: 'equals', pattern: 'starbucks' }), {
        normalizedMerchant: 'Starbucks',
        rawDescription: 'irrelevant',
        amountCents: -100,
        isCreditAccount: false,
      }),
    ).toBe(false) // equals checks the whole description here
    expect(matchRule(mkRule({ match: 'regex', pattern: '^STAR' }), input)).toBe(true)
  })

  it('returns false for an invalid regex instead of throwing', () => {
    expect(matchRule(mkRule({ match: 'regex', pattern: '[' }), input)).toBe(false)
  })
})

describe('categorizeWith', () => {
  it('returns the category of the first matching rule (highest priority wins)', () => {
    const rules = [
      mkRule({ pattern: 'starbucks', categoryId: 2, priority: 100 }),
      mkRule({ pattern: 'starbucks', categoryId: 1, priority: 10 }),
    ].sort((a, b) => b.priority - a.priority)
    expect(categorizeWith(rules, input)).toBe(2)
  })

  it('returns null when nothing matches', () => {
    expect(categorizeWith([mkRule({ pattern: 'nope' })], input)).toBeNull()
  })

  it('applies an income rule only to a genuine bank deposit', () => {
    const kinds = new Map<number, CategoryKind>([[5, 'income']])
    const rule = mkRule({ pattern: 'payroll', categoryId: 5 })
    const deposit = {
      normalizedMerchant: '',
      rawDescription: 'ACME PAYROLL DIRECT DEP',
      amountCents: 250000,
      isCreditAccount: false,
    }
    const cardInflow = { ...deposit, isCreditAccount: true } // e.g. a credit-card payment
    const outflow = { ...deposit, amountCents: -250000, isCreditAccount: false }

    expect(categorizeWith([rule], deposit, kinds)).toBe(5)
    expect(categorizeWith([rule], cardInflow, kinds)).toBeNull()
    expect(categorizeWith([rule], outflow, kinds)).toBeNull()
    // Without a kinds map the guard is inactive (back-compat).
    expect(categorizeWith([rule], cardInflow)).toBe(5)
  })
})
