import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '../db'
import { ensureSeeded } from '../db/seed'
import { detectTransfers } from './detect'
import type { Transaction } from '../db/schema'

function mk(accountId: number, date: string, amountCents: number, desc: string): Transaction {
  return {
    accountId,
    date,
    amountCents,
    currency: 'USD',
    rawDescription: desc,
    normalizedMerchant: desc,
    categoryId: null,
    isTransfer: false,
    importBatchId: 0,
    dedupHash: `${accountId}-${date}-${amountCents}`,
    createdAt: 0,
    updatedAt: 0,
  }
}

describe('detectTransfers', () => {
  beforeEach(async () => {
    await Promise.all([db.transactions.clear(), db.accounts.clear()])
    await ensureSeeded()
  })

  it('pairs an outflow with a matching inflow in another account', async () => {
    const checking = await db.accounts.add({
      name: 'Checking',
      type: 'checking',
      currency: 'USD',
      createdAt: Date.now(),
    })
    const card = await db.accounts.add({
      name: 'Card',
      type: 'credit',
      currency: 'USD',
      createdAt: Date.now(),
    })
    await db.transactions.bulkAdd([
      mk(checking, '2024-01-10', -50000, 'PAYMENT TO CARD'),
      mk(card, '2024-01-11', 50000, 'PAYMENT THANK YOU'),
      mk(checking, '2024-01-12', -1200, 'COFFEE'),
    ])

    const pairs = await detectTransfers()
    expect(pairs).toBe(1)
    expect(await db.transactions.filter((t) => t.isTransfer).count()).toBe(2)
    // The genuine spend is untouched.
    const coffee = await db.transactions.filter((t) => t.amountCents === -1200).first()
    expect(coffee?.isTransfer).toBe(false)
  })

  it('does not pair amounts within the same account', async () => {
    const acct = await db.accounts.add({
      name: 'Solo',
      type: 'checking',
      currency: 'USD',
      createdAt: Date.now(),
    })
    await db.transactions.bulkAdd([
      mk(acct, '2024-01-10', -50000, 'OUT'),
      mk(acct, '2024-01-11', 50000, 'IN'),
    ])
    expect(await detectTransfers()).toBe(0)
  })
})
