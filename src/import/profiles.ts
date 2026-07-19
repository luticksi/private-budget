import { db } from '../db'
import type { ImportProfile } from '../db/schema'
import { normalizeHeader } from './csv'
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
  // Compared normalized so a profile survives a bank re-punctuating a header
  // ("Trans. Date" becoming "Trans Date"); `mapCsvRows` resolves cells the
  // same way, so a match here always maps.
  const headers = new Set(table.headers.map(normalizeHeader))
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
    if (
      required.length === 0 ||
      !required.every((h) => headers.has(normalizeHeader(h)))
    )
      continue
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
  {
    name: 'Chase (credit card)',
    institution: 'Chase',
    fileType: 'csv',
    delimiter: ',',
    hasHeader: true,
    // Chase is the reason sign convention can't be guessed from account type:
    // unlike Amex and Discover, it exports charges as *negative*.
    columnMap: {
      date: 'Transaction Date',
      description: 'Description',
      amount: 'Amount',
    },
    matchHeaders: ['Post Date', 'Category', 'Type', 'Memo'],
    dateFormat: 'MM/DD/YYYY',
    signConvention: 'negativeIsOutflow',
    isBuiltin: true,
  },
  {
    name: 'Chase (checking)',
    institution: 'Chase',
    fileType: 'csv',
    delimiter: ',',
    hasHeader: true,
    columnMap: {
      date: 'Posting Date',
      description: 'Description',
      amount: 'Amount',
      balance: 'Balance',
    },
    matchHeaders: ['Details', 'Type'],
    dateFormat: 'MM/DD/YYYY',
    signConvention: 'negativeIsOutflow',
    isBuiltin: true,
  },
  {
    name: 'Discover',
    institution: 'Discover',
    fileType: 'csv',
    delimiter: ',',
    hasHeader: true,
    columnMap: { date: 'Trans. Date', description: 'Description', amount: 'Amount' },
    matchHeaders: ['Post Date', 'Category'],
    dateFormat: 'MM/DD/YYYY',
    signConvention: 'positiveIsOutflow',
    isBuiltin: true,
  },
  {
    name: 'Ally Bank',
    institution: 'Ally',
    fileType: 'csv',
    delimiter: ',',
    hasHeader: true,
    columnMap: { date: 'Date', description: 'Description', amount: 'Amount' },
    matchHeaders: ['Time', 'Type'],
    dateFormat: 'YYYY-MM-DD',
    signConvention: 'negativeIsOutflow',
    isBuiltin: true,
  },
]

const PROFILES_SEED_FLAG = 'seed:profiles:v2'

/**
 * Seed the built-in import profiles. Idempotent and safe to call on every app
 * start: profiles are added by name, so a user who already has v1's Amex
 * profile (possibly edited) keeps it and only gains the new ones.
 */
export async function ensureProfilesSeeded(): Promise<void> {
  if (await db.meta.get(PROFILES_SEED_FLAG)) return
  const now = Date.now()
  await db.transaction('rw', db.importProfiles, db.meta, async () => {
    if (await db.meta.get(PROFILES_SEED_FLAG)) return
    const existing = new Set((await db.importProfiles.toArray()).map((p) => p.name))
    const missing = BUILTIN_PROFILES.filter((p) => !existing.has(p.name))
    if (missing.length) {
      await db.importProfiles.bulkAdd(missing.map((p) => ({ ...p, createdAt: now })))
    }
    await db.meta.put({ key: PROFILES_SEED_FLAG, value: now })
  })
}
