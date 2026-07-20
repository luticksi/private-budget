import { db } from '../db'

/**
 * Merchants the user never wants the "apply this category to N other X
 * transactions?" prompt for. Checks are the classic case: a bank exports every
 * check with the same descriptor (e.g. "DDA CHECK"), so they all normalize to
 * one merchant — and a single accidental "yes" mass-recategorizes every check
 * under one category.
 *
 * Stored as a meta row so it rides along with backup/restore automatically.
 * Matching is case-insensitive substring, so a short entry like "check" covers
 * "Dda Check" without the user having to reproduce the exact normalized name.
 */

const META_KEY = 'neverPromptMerchants'

export async function getNeverPromptMerchants(): Promise<string[]> {
  const row = await db.meta.get(META_KEY)
  return Array.isArray(row?.value)
    ? (row.value as unknown[]).filter((s): s is string => typeof s === 'string')
    : []
}

export async function setNeverPromptMerchants(list: string[]): Promise<void> {
  await db.meta.put({ key: META_KEY, value: normalizeList(list) })
}

/** Trim, drop blanks, and de-duplicate (case-insensitively) a list of entries. */
export function normalizeList(list: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of list) {
    const trimmed = raw.trim()
    if (!trimmed) continue
    const key = trimmed.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(trimmed)
  }
  return out
}

/**
 * True when this merchant should skip the bulk-apply prompt — i.e. it contains
 * any never-prompt entry (case-insensitive).
 */
export function isNeverPrompt(merchant: string, list: readonly string[]): boolean {
  const m = merchant.trim().toLowerCase()
  if (!m) return false
  return list.some((entry) => {
    const e = entry.trim().toLowerCase()
    return e !== '' && m.includes(e)
  })
}
