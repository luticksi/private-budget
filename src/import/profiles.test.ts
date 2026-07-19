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
    const count = await db.importProfiles.count()
    await ensureProfilesSeeded()
    expect(await db.importProfiles.count()).toBe(count)
  })

  it('does not duplicate a profile the user already has', async () => {
    await db.importProfiles.add({
      name: 'Discover',
      fileType: 'csv',
      hasHeader: true,
      columnMap: { date: 'Trans. Date', description: 'Description', amount: 'Amount' },
      dateFormat: 'MM/DD/YYYY',
      signConvention: 'positiveIsOutflow',
      createdAt: Date.now(),
    })
    await ensureProfilesSeeded()
    expect(await db.importProfiles.where('name').equals('Discover').count()).toBe(1)
  })

  // Each issuer pins the sign convention that detection can't infer for it.
  const cases: Array<[string, string[], string]> = [
    [
      'Chase (credit card)',
      ['Transaction Date', 'Post Date', 'Description', 'Category', 'Type', 'Amount', 'Memo'],
      'negativeIsOutflow',
    ],
    [
      'Chase (checking)',
      ['Details', 'Posting Date', 'Description', 'Amount', 'Type', 'Balance', 'Check or Slip #'],
      'negativeIsOutflow',
    ],
    [
      'Discover',
      ['Trans. Date', 'Post Date', 'Description', 'Amount', 'Category'],
      'positiveIsOutflow',
    ],
    ['Ally Bank', ['Date', 'Time', 'Amount', 'Type', 'Description'], 'negativeIsOutflow'],
  ]

  it.each(cases)('matches the %s export', async (name, headers, signConvention) => {
    await ensureProfilesSeeded()
    const match = await findMatchingProfile(table(headers))
    expect(match?.name).toBe(name)
    expect(match?.signConvention).toBe(signConvention)
  })

  it('matches a profile despite drifted header punctuation', async () => {
    await ensureProfilesSeeded()
    // Discover's "Trans. Date" without the period.
    const match = await findMatchingProfile(
      table(['Trans Date', 'Post Date', 'Description', 'Amount', 'Category']),
    )
    expect(match?.name).toBe('Discover')
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
