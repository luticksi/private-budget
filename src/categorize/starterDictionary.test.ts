import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '../db'
import { CATEGORY_TREE, ensureSeeded } from '../db/seed'
import { STARTER_DICTIONARY, ensureRulesSeeded } from './starterDictionary'
import { categorizeWith, loadCategoryKinds, loadEnabledRules } from './engine'

const TREE_NAMES = new Set(
  CATEGORY_TREE.flatMap((p) => [p.name, ...(p.children ?? [])]),
)

describe('STARTER_DICTIONARY integrity', () => {
  it('maps every entry to a category that exists in the default tree', () => {
    for (const entry of STARTER_DICTIONARY) {
      expect(TREE_NAMES, `unknown category "${entry.category}" for pattern "${entry.pattern}"`).toContain(entry.category)
    }
  })

  it('has only valid regex patterns', () => {
    for (const entry of STARTER_DICTIONARY) {
      if (entry.match !== 'regex') continue
      expect(() => new RegExp(entry.pattern, 'i'), `invalid regex "${entry.pattern}"`).not.toThrow()
    }
  })

  it('has no duplicate (match, pattern) pairs', () => {
    const seen = new Set<string>()
    for (const entry of STARTER_DICTIONARY) {
      const key = `${entry.match ?? 'contains'}:${entry.pattern.toLowerCase()}`
      expect(seen.has(key), `duplicate entry "${key}"`).toBe(false)
      seen.add(key)
    }
  })
})

describe('seeding', () => {
  beforeEach(async () => {
    await Promise.all([db.rules.clear(), db.categories.clear(), db.meta.clear()])
    await ensureSeeded()
  })

  it('seeds one rule per dictionary entry, idempotently', async () => {
    await ensureRulesSeeded()
    expect(await db.rules.count()).toBe(STARTER_DICTIONARY.length)
    await ensureRulesSeeded()
    expect(await db.rules.count()).toBe(STARTER_DICTIONARY.length)
  })

  it('re-running after a flag bump only adds missing rules', async () => {
    await ensureRulesSeeded()
    const before = await db.rules.count()
    // Simulate a version bump: the flag is gone but every pattern already
    // exists, so re-seeding must not duplicate anything.
    await db.meta.where('key').startsWith('seed:rules:').delete()
    await ensureRulesSeeded()
    expect(await db.rules.count()).toBe(before)
  })
})

describe('categorization spot checks', () => {
  beforeEach(async () => {
    await Promise.all([db.rules.clear(), db.categories.clear(), db.meta.clear()])
    await ensureSeeded()
    await ensureRulesSeeded()
  })

  async function categoryOf(rawDescription: string, amountCents = -1000): Promise<string | null> {
    const [rules, kinds] = await Promise.all([loadEnabledRules(), loadCategoryKinds()])
    const id = categorizeWith(
      rules,
      { normalizedMerchant: '', rawDescription, amountCents, isCreditAccount: false },
      kinds,
    )
    if (id == null) return null
    return (await db.categories.get(id))?.name ?? null
  }

  it('resolves brand/overlap collisions correctly', async () => {
    expect(await categoryOf('UBER *EATS 8005928996')).toBe('Food Delivery')
    expect(await categoryOf('UBER *TRIP HELP.UBER.COM')).toBe('Rideshare & Taxi')
    expect(await categoryOf('COSTCO GAS #0143')).toBe('Gas')
    expect(await categoryOf('COSTCO WHSE #0143')).toBe('Groceries')
    expect(await categoryOf('T-MOBILE*AUTO PAY')).toBe('Internet & Phone')
    expect(await categoryOf('MOBIL GAS 7742')).toBe('Gas')
    expect(await categoryOf('MICROSOFT*XBOX GAME PASS')).toBe('Games')
    expect(await categoryOf('AMAZON PRIME*A12BC PMTS')).toBe('Memberships')
    expect(await categoryOf('AMZN MKTP US*Z999')).toBe('Online Shopping')
  })

  it('avoids substring false positives', async () => {
    expect(await categoryOf('TOWN PHARMACY #12')).toBe('Pharmacy') // not Macy's
    expect(await categoryOf("MARCO'S PIZZA 8123")).toBe('Restaurants') // not ARCO
    expect(await categoryOf('VIVALDI STRINGS LLC')).toBeNull() // not ALDI
    expect(await categoryOf('WORKING WHEELS')).toBeNull() // not ORKIN
  })

  it('uses generic keyword fallbacks only when no brand matches', async () => {
    expect(await categoryOf('LUIGI PIZZERIA NYC')).toBe('Restaurants')
    expect(await categoryOf('MAIN ST PARKING GARAGE')).toBe('Parking & Tolls')
    expect(await categoryOf('SUNSET NAILS & SPA')).toBe('Personal Care')
    expect(await categoryOf('TST* THE LOCAL KITCHEN')).toBe('Restaurants')
  })

  it('guards income categories behind genuine deposits', async () => {
    expect(await categoryOf('IRS TREAS 310 TAX REF', 120000)).toBe('Refunds & Reimbursements')
    expect(await categoryOf('IRS USATAXPYMT', -120000)).toBe('Taxes')
    expect(await categoryOf('GUSTO PAYROLL', 250000)).toBe('Salary')
  })
})
