import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '../db'
import { ensureProfilesSeeded, findMatchingProfile } from './profiles'
import type { RawTable } from './types'

const table = (headers: string[]): RawTable => ({
  headers,
  rows: [],
  delimiter: ',',
  hasHeader: true,
})

// Both Amex exports carry these columns; the "extended" file adds more.
const amexBasic = table(['Date', 'Description', 'Card Member', 'Account #', 'Amount'])
const amexExtended = table([
  'Date',
  'Description',
  'Card Member',
  'Account #',
  'Amount',
  'Extended Details',
  'Reference',
  'Category',
])
const genericExport = table(['Date', 'Description', 'Amount'])

describe('built-in import profiles', () => {
  beforeEach(async () => {
    await db.importProfiles.clear()
    await db.meta.clear()
  })

  it('seeds an Amex profile that matches both Amex export shapes', async () => {
    await ensureProfilesSeeded()
    for (const t of [amexBasic, amexExtended]) {
      const match = await findMatchingProfile(t)
      expect(match?.institution).toBe('American Express')
      expect(match?.signConvention).toBe('positiveIsOutflow')
      expect(match?.dateFormat).toBe('MM/DD/YYYY')
      expect(match?.columnMap).toMatchObject({
        date: 'Date',
        description: 'Description',
        amount: 'Amount',
      })
    }
  })

  it('does not hijack a non-Amex Date/Description/Amount file', async () => {
    await ensureProfilesSeeded()
    expect(await findMatchingProfile(genericExport)).toBeUndefined()
  })

  it('is idempotent', async () => {
    await ensureProfilesSeeded()
    await ensureProfilesSeeded()
    expect(await db.importProfiles.count()).toBe(1)
  })
})

describe('findMatchingProfile specificity', () => {
  beforeEach(async () => {
    await db.importProfiles.clear()
    await db.meta.clear()
  })

  it('prefers the profile with more required headers', async () => {
    const now = Date.now()
    await db.importProfiles.bulkAdd([
      {
        name: 'Generic',
        fileType: 'csv',
        hasHeader: true,
        columnMap: { date: 'Date', description: 'Description', amount: 'Amount' },
        dateFormat: 'MM/DD/YYYY',
        signConvention: 'negativeIsOutflow',
        createdAt: now,
      },
      {
        name: 'American Express',
        fileType: 'csv',
        hasHeader: true,
        columnMap: { date: 'Date', description: 'Description', amount: 'Amount' },
        matchHeaders: ['Card Member', 'Account #'],
        dateFormat: 'MM/DD/YYYY',
        signConvention: 'positiveIsOutflow',
        createdAt: now,
      },
    ])
    const match = await findMatchingProfile(amexBasic)
    expect(match?.name).toBe('American Express')
  })
})
