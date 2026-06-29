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

/** Find a saved profile whose mapped columns all exist in this file. */
export async function findMatchingProfile(
  table: RawTable,
): Promise<ImportProfile | undefined> {
  const headers = new Set(table.headers)
  const profiles = await listProfiles()
  return profiles.find((p) => {
    const { date, description, amount, debit, credit } = p.columnMap
    const required = [date, description, amount, debit, credit].filter(Boolean) as string[]
    return required.length > 0 && required.every((h) => headers.has(h))
  })
}

export function profileToConfig(p: ImportProfile): MappingConfig {
  return {
    columnMap: p.columnMap,
    dateFormat: p.dateFormat,
    signConvention: p.signConvention,
  }
}
