import { db } from '../db'
import type { Transaction } from '../db/schema'
import { loadEnabledRules, categorizeWith, loadCategoryKinds } from '../categorize/engine'
import { computeDedupHash } from './dedup'
import { normalizeMerchant } from './normalizeMerchant'
import type { ParsedTransaction } from './types'

export interface CommitInput {
  accountId: number
  currency: string
  fileName: string
  profileId?: number | null
  transactions: ParsedTransaction[]
}

export interface CommitResult {
  batchId: number
  added: number
  duplicates: number
}

/**
 * Store parsed transactions: normalize the merchant, compute a dedup hash,
 * skip transactions that were already imported, auto-categorize the rest, and
 * record an import batch.
 */
export async function commitImport(input: CommitInput): Promise<CommitResult> {
  const { accountId, currency, fileName, profileId, transactions } = input
  const [rules, categoryKinds, account] = await Promise.all([
    loadEnabledRules(),
    loadCategoryKinds(),
    db.accounts.get(accountId),
  ])
  const isCreditAccount = account?.type === 'credit'
  const now = Date.now()

  return db.transaction('rw', db.transactions, db.importBatches, async () => {
    // Count how many times each dedup hash already exists for this account.
    const existing = await db.transactions.where('accountId').equals(accountId).toArray()
    const existingCounts = new Map<string, number>()
    for (const t of existing) {
      existingCounts.set(t.dedupHash, (existingCounts.get(t.dedupHash) ?? 0) + 1)
    }

    const batchId = await db.importBatches.add({
      accountId,
      fileName,
      profileId: profileId ?? null,
      importedAt: now,
      rowCount: transactions.length,
      addedCount: 0,
      duplicateCount: 0,
    })

    const seen = new Map<string, number>()
    const toAdd: Transaction[] = []
    let duplicates = 0

    for (const p of transactions) {
      const normalizedMerchant = normalizeMerchant(p.rawDescription)
      const dedupHash = computeDedupHash({
        accountId,
        date: p.date,
        amountCents: p.amountCents,
        description: p.rawDescription,
        checkNumber: p.checkNumber,
      })

      // Skip a hash only up to the number of times it already exists, so
      // genuine same-day repeats survive a first-time import.
      const already = existingCounts.get(dedupHash) ?? 0
      const seenSoFar = seen.get(dedupHash) ?? 0
      seen.set(dedupHash, seenSoFar + 1)
      if (seenSoFar < already) {
        duplicates++
        continue
      }

      toAdd.push({
        accountId,
        date: p.date,
        amountCents: p.amountCents,
        currency,
        rawDescription: p.rawDescription,
        normalizedMerchant,
        categoryId: categorizeWith(
          rules,
          {
            normalizedMerchant,
            rawDescription: p.rawDescription,
            amountCents: p.amountCents,
            isCreditAccount,
          },
          categoryKinds,
        ),
        isTransfer: false,
        transferGroupId: null,
        importBatchId: batchId,
        dedupHash,
        fitId: p.fitId ?? null,
        balanceCents: p.balanceCents ?? null,
        memo: p.memo ?? null,
        checkNumber: p.checkNumber ?? null,
        createdAt: now,
        updatedAt: now,
      })
    }

    if (toAdd.length) await db.transactions.bulkAdd(toAdd)
    await db.importBatches.update(batchId, {
      addedCount: toAdd.length,
      duplicateCount: duplicates,
    })

    return { batchId, added: toAdd.length, duplicates }
  })
}
