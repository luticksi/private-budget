import { db } from '../db'
import { categoryIdByName } from '../db/seed'
import type { Transaction } from '../db/schema'

/**
 * Transfer detection. When a user imports both, say, a checking account and a
 * credit-card account, a "payment to credit card" outflow in checking is the
 * same money as the payment inflow in the credit-card account. Counting both
 * as spending would be wrong, so we pair them up and flag both as transfers
 * (excluded from spending totals).
 *
 * Heuristic: an outflow in one account is paired with an inflow of equal
 * magnitude in a *different* account within a few days. Greedy first match.
 */

function daysBetween(a: string, b: string): number {
  const ms = Math.abs(new Date(a).getTime() - new Date(b).getTime())
  return ms / 86_400_000
}

function newGroupId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `tg_${Math.random().toString(36).slice(2)}`
}

export async function detectTransfers(windowDays = 4): Promise<number> {
  const txs = await db.transactions.filter((t) => !t.isTransfer).toArray()
  const inflowsByMagnitude = new Map<number, Transaction[]>()
  for (const t of txs) {
    if (t.amountCents > 0) {
      const mag = Math.abs(t.amountCents)
      const list = inflowsByMagnitude.get(mag) ?? []
      list.push(t)
      inflowsByMagnitude.set(mag, list)
    }
  }

  const used = new Set<number>()
  const pairs: Array<{ outId: number; inId: number; groupId: string }> = []

  for (const out of txs) {
    if (out.amountCents >= 0 || used.has(out.id!)) continue
    const mag = Math.abs(out.amountCents)
    const candidates = inflowsByMagnitude.get(mag) ?? []
    const match = candidates.find(
      (c) =>
        !used.has(c.id!) &&
        c.accountId !== out.accountId &&
        daysBetween(out.date, c.date) <= windowDays,
    )
    if (match) {
      used.add(out.id!)
      used.add(match.id!)
      pairs.push({ outId: out.id!, inId: match.id!, groupId: newGroupId() })
    }
  }

  if (!pairs.length) return 0

  const transferCategoryId = (await categoryIdByName('Credit Card Payment')) ?? null
  await db.transaction('rw', db.transactions, async () => {
    for (const p of pairs) {
      for (const id of [p.outId, p.inId]) {
        await db.transactions.update(id, {
          isTransfer: true,
          transferGroupId: p.groupId,
          categoryId: transferCategoryId,
          updatedAt: Date.now(),
        })
      }
    }
  })

  return pairs.length
}
