import { db } from '../db'

/**
 * Auto-learning. When a user manually categorizes a merchant, we remember it as
 * a high-priority "learned" rule and can apply it to all matching transactions.
 */

/** Create or update a learned rule mapping a merchant to a category. */
export async function upsertLearnedRule(
  merchant: string,
  categoryId: number,
): Promise<void> {
  const pattern = merchant.trim().toLowerCase()
  if (!pattern) return

  const existing = await db.rules
    .filter(
      (r) =>
        r.source === 'learned' &&
        r.field === 'normalizedMerchant' &&
        r.match === 'equals' &&
        r.pattern === pattern,
    )
    .first()

  if (existing) {
    await db.rules.update(existing.id!, { categoryId, enabled: true })
  } else {
    await db.rules.add({
      field: 'normalizedMerchant',
      match: 'equals',
      pattern,
      categoryId,
      priority: 100, // learned rules outrank the built-in dictionary
      source: 'learned',
      enabled: true,
      createdAt: Date.now(),
    })
  }
}

/** Set the category on every transaction sharing this normalized merchant. */
export async function applyMerchantCategory(
  merchant: string,
  categoryId: number | null,
): Promise<number> {
  return db.transactions
    .where('normalizedMerchant')
    .equals(merchant)
    .modify({ categoryId, updatedAt: Date.now() })
}

export async function countByMerchant(merchant: string): Promise<number> {
  return db.transactions.where('normalizedMerchant').equals(merchant).count()
}
