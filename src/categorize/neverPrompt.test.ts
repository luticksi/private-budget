import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '../db'
import {
  getNeverPromptMerchants,
  setNeverPromptMerchants,
  normalizeList,
  isNeverPrompt,
} from './neverPrompt'

describe('normalizeList', () => {
  it('trims, drops blanks, and de-duplicates case-insensitively', () => {
    expect(normalizeList(['  Dda Check ', '', 'dda check', 'Rent'])).toEqual([
      'Dda Check',
      'Rent',
    ])
  })
})

describe('isNeverPrompt', () => {
  const list = ['DDA Check', 'ATM']

  it('matches on case-insensitive substring', () => {
    expect(isNeverPrompt('Dda Check', list)).toBe(true)
    expect(isNeverPrompt('dda check', list)).toBe(true)
  })

  it('matches when the merchant contains an entry', () => {
    expect(isNeverPrompt('Chase ATM Withdrawal', list)).toBe(true)
  })

  it('does not match unrelated merchants', () => {
    expect(isNeverPrompt('Trader Joe\'s', list)).toBe(false)
  })

  it('never matches a blank merchant or against a blank entry', () => {
    expect(isNeverPrompt('', list)).toBe(false)
    expect(isNeverPrompt('Anything', ['', '   '])).toBe(false)
  })
})

describe('getNeverPromptMerchants / setNeverPromptMerchants', () => {
  beforeEach(async () => {
    await db.meta.clear()
  })

  it('returns an empty list when nothing is stored', async () => {
    expect(await getNeverPromptMerchants()).toEqual([])
  })

  it('round-trips a cleaned list', async () => {
    await setNeverPromptMerchants(['  Dda Check ', 'dda check', 'ATM'])
    expect(await getNeverPromptMerchants()).toEqual(['Dda Check', 'ATM'])
  })

  it('tolerates a malformed stored value', async () => {
    await db.meta.put({ key: 'neverPromptMerchants', value: 'not an array' })
    expect(await getNeverPromptMerchants()).toEqual([])
  })
})
