import { describe, it, expect } from 'vitest'
import { parseDate, detectDateFormat } from './dates'
import { normalizeMerchant } from './normalizeMerchant'
import { mapCsvRows } from './csv'
import { detectMapping } from './detect'
import { computeDedupHash } from './dedup'
import type { RawTable } from './types'

describe('parseDate', () => {
  it('parses common formats to ISO', () => {
    expect(parseDate('01/02/2024', 'MM/DD/YYYY')).toBe('2024-01-02')
    expect(parseDate('2024-03-15', 'YYYY-MM-DD')).toBe('2024-03-15')
    expect(parseDate('15/03/2024', 'DD/MM/YYYY')).toBe('2024-03-15')
    expect(parseDate('Mar 5, 2024', 'MMM D, YYYY')).toBe('2024-03-05')
  })
  it('rejects invalid dates', () => {
    expect(parseDate('13/40/2024', 'MM/DD/YYYY')).toBeNull()
    expect(parseDate('not a date', 'MM/DD/YYYY')).toBeNull()
  })
})

describe('detectDateFormat', () => {
  it('detects ISO', () => {
    expect(detectDateFormat(['2024-01-02', '2024-12-31'])).toBe('YYYY-MM-DD')
  })
  it('disambiguates day-first when a value exceeds 12', () => {
    expect(detectDateFormat(['13/02/2024', '01/05/2024'])).toBe('DD/MM/YYYY')
  })
})

describe('normalizeMerchant', () => {
  it('strips processor prefixes, store numbers, and state codes', () => {
    expect(normalizeMerchant('SQ *BLUE BOTTLE 0123 OAKLAND CA')).toBe('Blue Bottle Oakland')
    expect(normalizeMerchant('TST* THE COFFEE BAR 555-1212')).toBe('The Coffee Bar')
  })
  it('handles bank noise prefixes', () => {
    expect(
      normalizeMerchant("PURCHASE AUTHORIZED ON 01/02 TRADER JOE'S #123 SF CA"),
    ).toContain("Trader Joe's")
  })
})

describe('mapCsvRows', () => {
  const table: RawTable = {
    headers: ['Date', 'Description', 'Amount'],
    rows: [
      ['01/02/2024', 'STARBUCKS #123', '-5.75'],
      ['01/03/2024', 'PAYCHECK', '2000.00'],
      ['bad', 'BROKEN ROW', 'x'],
    ],
    delimiter: ',',
    hasHeader: true,
  }

  it('maps rows and reports skipped', () => {
    const result = mapCsvRows(table, {
      columnMap: { date: 'Date', description: 'Description', amount: 'Amount' },
      dateFormat: 'MM/DD/YYYY',
      signConvention: 'negativeIsOutflow',
    })
    expect(result.transactions).toHaveLength(2)
    expect(result.skipped).toBe(1)
    expect(result.transactions[0]).toMatchObject({ date: '2024-01-02', amountCents: -575 })
    expect(result.transactions[1].amountCents).toBe(200000)
  })

  it('inverts sign for positiveIsOutflow', () => {
    const result = mapCsvRows(table, {
      columnMap: { date: 'Date', description: 'Description', amount: 'Amount' },
      dateFormat: 'MM/DD/YYYY',
      signConvention: 'positiveIsOutflow',
    })
    expect(result.transactions[0].amountCents).toBe(575)
  })

  it('handles separate debit/credit columns', () => {
    const sep: RawTable = {
      headers: ['Date', 'Description', 'Debit', 'Credit'],
      rows: [
        ['01/02/2024', 'COFFEE', '5.75', ''],
        ['01/03/2024', 'REFUND', '', '20.00'],
      ],
      delimiter: ',',
      hasHeader: true,
    }
    const result = mapCsvRows(sep, {
      columnMap: { date: 'Date', description: 'Description', debit: 'Debit', credit: 'Credit' },
      dateFormat: 'MM/DD/YYYY',
      signConvention: 'separateColumns',
    })
    expect(result.transactions[0].amountCents).toBe(-575)
    expect(result.transactions[1].amountCents).toBe(2000)
  })
})

describe('detectMapping', () => {
  it('auto-detects a single-amount layout', () => {
    const table: RawTable = {
      headers: ['Transaction Date', 'Description', 'Amount'],
      rows: [
        ['01/02/2024', 'STARBUCKS #123', '-5.75'],
        ['01/03/2024', 'PAYCHECK', '2000.00'],
      ],
      delimiter: ',',
      hasHeader: true,
    }
    const config = detectMapping(table)
    expect(config.columnMap.date).toBe('Transaction Date')
    expect(config.columnMap.description).toBe('Description')
    expect(config.columnMap.amount).toBe('Amount')
    expect(config.dateFormat).toBe('MM/DD/YYYY')
  })

  it('auto-detects separate debit/credit columns', () => {
    const table: RawTable = {
      headers: ['Date', 'Memo', 'Debit', 'Credit'],
      rows: [
        ['2024-01-02', 'COFFEE', '5.75', ''],
        ['2024-01-03', 'REFUND', '', '20.00'],
      ],
      delimiter: ',',
      hasHeader: true,
    }
    const config = detectMapping(table)
    expect(config.signConvention).toBe('separateColumns')
    expect(config.columnMap.debit).toBe('Debit')
    expect(config.columnMap.credit).toBe('Credit')
    expect(config.columnMap.description).toBe('Memo')
  })
})

describe('computeDedupHash', () => {
  it('is stable for identical input and varies with fields', () => {
    const base = { accountId: 1, date: '2024-01-02', amountCents: -575, description: 'STARBUCKS' }
    expect(computeDedupHash(base)).toBe(computeDedupHash(base))
    expect(computeDedupHash(base)).not.toBe(computeDedupHash({ ...base, amountCents: -576 }))
  })
})
