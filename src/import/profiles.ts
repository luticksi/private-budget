import { db } from '../db'
import type { ImportProfile } from '../db/schema'
import type { MappingConfig, RawTable } from './types'

/** Saved per-bank mappings so re-importing from the same bank is one click. */

export async function listProfiles(): Promise<ImportProfile[]> {
  return db.importProfiles.orderBy('name').toArray()
}

export async function saveProfile(
  name: string,
  config: MappingConfig,
  opts?: { institution?: string; defaultAccountId?: number; delimiter?: string },
): Promise<number> {
  return db.importProfiles.add({
    name,
    institution: opts?.institution,
    fileType: 'csv',
    delimiter: opts?.delimiter,
    hasHeader: true,
    columnMap: config.columnMap,
    dateFormat: config.dateFormat,
    signConvention: config.signConvention,
    defaultAccountId: opts?.defaultAccountId,
    createdAt: Date.now(),
  })
}

/**
 * Find a saved profile whose mapped columns — and any extra `matchHeaders` —
 * all exist in this file. The most specific match (most required headers) wins,
 * so an issuer-specific profile beats a generic one on the same file.
 */
export async function findMatchingProfile(
  table: RawTable,
): Promise<ImportProfile | undefined> {
  const headers = new Set(table.headers)
  const profiles = await listProfiles()
  let best: ImportProfile | undefined
  let bestScore = -1
  for (const p of profiles) {
    const { date, description, amount, debit, credit } = p.columnMap
    const required = [
      date,
      description,
      amount,
      debit,
      credit,
      ...(p.matchHeaders ?? []),
    ].filter(Boolean) as string[]
    if (required.length === 0 || !required.every((h) => headers.has(h))) continue
    if (required.length > bestScore) {
      best = p
      bestScore = required.length
    }
  }
  return best
}

export function profileToConfig(p: ImportProfile): MappingConfig {
  return {
    columnMap: p.columnMap,
    dateFormat: p.dateFormat,
    signConvention: p.signConvention,
  }
}

/**
 * Built-in import profiles seeded on first run. These cover common issuers
 * whose CSV exports are awkward to auto-detect — notably American Express,
 * whose numeric "Account #" column fools amount-detection and whose charges are
 * positive (so the sign must be inverted). `matchHeaders` keep each profile
 * from hijacking an unrelated file that happens to share generic column names.
 */
const BUILTIN_PROFILES: Array<Omit<ImportProfile, 'id' | 'createdAt'>> = [
  {
    name: 'American Express',
    institution: 'American Express',
    fileType: 'csv',
    delimiter: ',',
    hasHeader: true,
    // Both the "basic" and "extended" Amex exports share these columns; the
    // extended file's extra columns are simply ignored.
    columnMap: { date: 'Date', description: 'Description', amount: 'Amount' },
    matchHeaders: ['Card Member', 'Account #'],
    dateFormat: 'MM/DD/YYYY',
    signConvention: 'positiveIsOutflow',
    isBuiltin: true,
  },
]

const PROFILES_SEED_FLAG = 'seed:profiles:v1'

/** Seed the built-in import profiles once. Safe to call on every app start. */
export async function ensureProfilesSeeded(): Promise<void> {
  if (await db.meta.get(PROFILES_SEED_FLAG)) return
  const now = Date.now()
  await db.transaction('rw', db.importProfiles, db.meta, async () => {
    if (await db.meta.get(PROFILES_SEED_FLAG)) return
    await db.importProfiles.bulkAdd(BUILTIN_PROFILES.map((p) => ({ ...p, createdAt: now })))
    await db.meta.put({ key: PROFILES_SEED_FLAG, value: now })
  })
}
