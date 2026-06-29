/**
 * Deduplication key. When statements with overlapping date ranges are
 * imported, the same transaction must not be added twice. We derive a stable
 * hash from the fields that identify a transaction within one account.
 *
 * Note: genuine same-day, same-amount repeats (e.g. two $5 coffees) are NOT
 * collapsed — the import pipeline only skips a hash up to the number of times
 * it already exists, so first-time imports keep every row.
 */

/** FNV-1a 32-bit hash, returned as a short base-36 string. */
function fnv1a(str: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(36)
}

export function computeDedupHash(parts: {
  accountId: number
  date: string
  amountCents: number
  description: string
}): string {
  const key = [
    parts.accountId,
    parts.date,
    parts.amountCents,
    parts.description.trim().toLowerCase().replace(/\s+/g, ' '),
  ].join('|')
  return fnv1a(key)
}
