import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '../db'
import { commitImport } from './commit'
import type { ParsedTransaction } from './types'

async function clear() {
  await Promise.all([db.transactions.clear(), db.importBatches.clear(), db.accounts.clear()])
}

const SAMPLE: ParsedTransaction[] = [
  { date: '2024-01-02', amountCents: -575, rawDescription: 'BLUE BOTTLE' },
  { date: '2024-01-03', amountCents: 250000, rawDescription: 'PAYCHECK' },
  // Two genuine same-day, same-amount repeats:
  { date: '2024-01-04', amountCents: -500, rawDescription: 'COFFEE' },
  { date: '2024-01-04', amountCents: -500, rawDescription: 'COFFEE' },
]

describe('commitImport', () => {
  beforeEach(clear)

  it('adds all rows on first import, keeping genuine same-day repeats', async () => {
    const accountId = await db.accounts.add({
      name: 'Test',
      type: 'checking',
      currency: 'USD',
      createdAt: Date.now(),
    })
    const res = await commitImport({
      accountId,
      currency: 'USD',
      fileName: 'a.csv',
      transactions: SAMPLE,
    })
    expect(res.added).toBe(4)
    expect(res.duplicates).toBe(0)
    expect(await db.transactions.count()).toBe(4)
  })

  it('skips already-imported rows on overlapping re-import', async () => {
    const accountId = await db.accounts.add({
      name: 'Test',
      type: 'checking',
      currency: 'USD',
      createdAt: Date.now(),
    })
    await commitImport({ accountId, currency: 'USD', fileName: 'a.csv', transactions: SAMPLE })

    // Re-import the same file plus one new row.
    const second = await commitImport({
      accountId,
      currency: 'USD',
      fileName: 'b.csv',
      transactions: [
        ...SAMPLE,
        { date: '2024-01-05', amountCents: -1000, rawDescription: 'NEW THING' },
      ],
    })
    expect(second.added).toBe(1)
    expect(second.duplicates).toBe(4)
    expect(await db.transactions.count()).toBe(5)
  })

  it('normalizes the merchant when storing', async () => {
    const accountId = await db.accounts.add({
      name: 'Test',
      type: 'checking',
      currency: 'USD',
      createdAt: Date.now(),
    })
    await commitImport({
      accountId,
      currency: 'USD',
      fileName: 'a.csv',
      transactions: [
        { date: '2024-01-02', amountCents: -575, rawDescription: 'SQ *BLUE BOTTLE 0123 OAKLAND CA' },
      ],
    })
    const tx = await db.transactions.toArray()
    expect(tx[0].normalizedMerchant).toBe('Blue Bottle Oakland')
  })
})
