import { z } from 'zod'
import { db } from './index'

/**
 * Backup & restore. Since there is no cloud, this is how users move their data
 * between devices or keep a safety copy. The file is plain JSON the user can
 * read — nothing hidden, no lock-in.
 */

const accountSchema = z.object({
  id: z.number().optional(),
  name: z.string(),
  type: z.enum(['checking', 'savings', 'credit', 'cash', 'other']),
  institution: z.string().optional(),
  currency: z.string(),
  createdAt: z.number(),
})

const categorySchema = z.object({
  id: z.number().optional(),
  name: z.string(),
  parentId: z.number().nullable(),
  color: z.string().optional(),
  // Optional with a default so backups taken before `kind` existed still
  // restore (treated as spending until the user adjusts the group).
  kind: z.enum(['income', 'expense', 'transfer']).default('expense'),
  isSystem: z.boolean(),
})

const ruleSchema = z.object({
  id: z.number().optional(),
  field: z.enum(['normalizedMerchant', 'rawDescription']),
  match: z.enum(['contains', 'startsWith', 'equals', 'regex']),
  pattern: z.string(),
  categoryId: z.number(),
  priority: z.number(),
  source: z.enum(['builtin', 'user', 'learned']),
  enabled: z.boolean(),
  createdAt: z.number(),
})

const transactionSchema = z.object({
  id: z.number().optional(),
  accountId: z.number(),
  date: z.string(),
  amountCents: z.number(),
  currency: z.string(),
  rawDescription: z.string(),
  normalizedMerchant: z.string(),
  categoryId: z.number().nullable(),
  isTransfer: z.boolean(),
  transferGroupId: z.string().nullable().optional(),
  importBatchId: z.number(),
  dedupHash: z.string(),
  fitId: z.string().nullable().optional(),
  notes: z.string().optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
})

const importProfileSchema = z.object({
  id: z.number().optional(),
  name: z.string(),
  institution: z.string().optional(),
  fileType: z.literal('csv'),
  delimiter: z.string().optional(),
  hasHeader: z.boolean(),
  columnMap: z.object({
    date: z.string(),
    description: z.string(),
    amount: z.string().optional(),
    debit: z.string().optional(),
    credit: z.string().optional(),
  }),
  dateFormat: z.string(),
  signConvention: z.enum(['negativeIsOutflow', 'positiveIsOutflow', 'separateColumns']),
  defaultAccountId: z.number().optional(),
  createdAt: z.number(),
})

const importBatchSchema = z.object({
  id: z.number().optional(),
  profileId: z.number().nullable().optional(),
  accountId: z.number(),
  fileName: z.string(),
  importedAt: z.number(),
  rowCount: z.number(),
  addedCount: z.number(),
  duplicateCount: z.number(),
})

const metaSchema = z.object({ key: z.string(), value: z.unknown() })

const backupSchema = z.object({
  app: z.literal('privatebudget'),
  version: z.number(),
  exportedAt: z.number(),
  data: z.object({
    accounts: z.array(accountSchema),
    categories: z.array(categorySchema),
    rules: z.array(ruleSchema),
    transactions: z.array(transactionSchema),
    importProfiles: z.array(importProfileSchema),
    importBatches: z.array(importBatchSchema),
    meta: z.array(metaSchema),
  }),
})

export type BackupFile = z.infer<typeof backupSchema>

export async function exportData(): Promise<string> {
  const [accounts, categories, rules, transactions, importProfiles, importBatches, meta] =
    await Promise.all([
      db.accounts.toArray(),
      db.categories.toArray(),
      db.rules.toArray(),
      db.transactions.toArray(),
      db.importProfiles.toArray(),
      db.importBatches.toArray(),
      db.meta.toArray(),
    ])

  const backup: BackupFile = {
    app: 'privatebudget',
    version: 1,
    exportedAt: Date.now(),
    data: { accounts, categories, rules, transactions, importProfiles, importBatches, meta },
  }
  return JSON.stringify(backup, null, 2)
}

/** Trigger a browser download of the backup JSON. */
export function downloadBackup(json: string): void {
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `privatebudget-backup-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export interface RestoreResult {
  counts: Record<string, number>
}

/** Replace ALL current data with the contents of a backup file. */
export async function importData(jsonText: string): Promise<RestoreResult> {
  const parsed = backupSchema.parse(JSON.parse(jsonText))
  const d = parsed.data

  await db.transaction(
    'rw',
    [
      db.accounts,
      db.categories,
      db.rules,
      db.transactions,
      db.importProfiles,
      db.importBatches,
      db.meta,
    ],
    async () => {
      await clearAll()
      await db.accounts.bulkAdd(d.accounts)
      await db.categories.bulkAdd(d.categories)
      await db.rules.bulkAdd(d.rules)
      await db.transactions.bulkAdd(d.transactions)
      await db.importProfiles.bulkAdd(d.importProfiles)
      await db.importBatches.bulkAdd(d.importBatches)
      await db.meta.bulkPut(d.meta as { key: string; value: unknown }[])
    },
  )

  return {
    counts: {
      accounts: d.accounts.length,
      categories: d.categories.length,
      rules: d.rules.length,
      transactions: d.transactions.length,
      importProfiles: d.importProfiles.length,
      importBatches: d.importBatches.length,
    },
  }
}

async function clearAll(): Promise<void> {
  await Promise.all([
    db.accounts.clear(),
    db.categories.clear(),
    db.rules.clear(),
    db.transactions.clear(),
    db.importProfiles.clear(),
    db.importBatches.clear(),
    db.meta.clear(),
  ])
}

/** Delete everything. The caller should re-seed defaults afterward. */
export async function wipeAllData(): Promise<void> {
  await db.transaction(
    'rw',
    [
      db.accounts,
      db.categories,
      db.rules,
      db.transactions,
      db.importProfiles,
      db.importBatches,
      db.meta,
    ],
    clearAll,
  )
}
