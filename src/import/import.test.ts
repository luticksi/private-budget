import { describe, it, expect } from 'vitest'
import { parseDate, detectDateFormat, stripTime } from './dates'
import { normalizeMerchant } from './normalizeMerchant'
import { mapCsvRows, previewCsvText } from './csv'
import { checkSignConvention, detectMapping } from './detect'
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
  it('accepts unpadded month and day for padded formats', () => {
    // Huntington exports "6/29/26" under what is otherwise MM/DD/YY.
    expect(parseDate('6/29/26', 'MM/DD/YY')).toBe('2026-06-29')
    expect(parseDate('1/2/2024', 'MM/DD/YYYY')).toBe('2024-01-02')
    expect(parseDate('2024-3-5', 'YYYY-MM-DD')).toBe('2024-03-05')
    // Mixed padding within one column still parses under a single format.
    expect(parseDate('06/29/26', 'MM/DD/YY')).toBe('2026-06-29')
  })
})

describe('stripTime', () => {
  it('drops a trailing time from date-time values', () => {
    expect(stripTime('2026-07-01T14:03:22Z')).toBe('2026-07-01')
    expect(stripTime('2026-07-01 14:03:22 UTC')).toBe('2026-07-01')
    expect(stripTime('07/01/2026 2:03 PM')).toBe('07/01/2026')
    expect(stripTime('2026-07-01')).toBe('2026-07-01')
  })
})

describe('parseDate with timestamps', () => {
  it('parses date-time cells with a date-only format', () => {
    expect(parseDate('2026-07-01T14:03:22Z', 'YYYY-MM-DD')).toBe('2026-07-01')
    expect(parseDate('07/01/2026 2:03 PM', 'MM/DD/YYYY')).toBe('2026-07-01')
  })
})

describe('detectDateFormat', () => {
  it('detects ISO', () => {
    expect(detectDateFormat(['2024-01-02', '2024-12-31'])).toBe('YYYY-MM-DD')
  })
  it('disambiguates day-first when a value exceeds 12', () => {
    expect(detectDateFormat(['13/02/2024', '01/05/2024'])).toBe('DD/MM/YYYY')
  })
  it('detects an unpadded two-digit-year column', () => {
    expect(detectDateFormat(['6/29/26', '6/30/26', '7/1/26'])).toBe('MM/DD/YY')
  })
  it('detects a format despite a stray unparseable value', () => {
    // A footer or label in the date column used to disqualify every format.
    const values = [
      ...Array.from({ length: 19 }, (_, i) => `2024-01-${String(i + 1).padStart(2, '0')}`),
      'Total',
    ]
    expect(detectDateFormat(values)).toBe('YYYY-MM-DD')
  })
  it('still prefers the format that explains more of the column', () => {
    expect(detectDateFormat(['13/02/2024', '20/02/2024', '01/05/2024'])).toBe('DD/MM/YYYY')
  })
  it('detects a format from timestamped values', () => {
    expect(detectDateFormat(['2026-07-01T14:03:22Z', '2026-07-02T09:00:00Z'])).toBe(
      'YYYY-MM-DD',
    )
  })
})

describe('previewCsvText', () => {
  it('skips metadata lines above the header', () => {
    const csv = [
      'Account Statement',
      'Account: ****1234',
      'Period: 01/01/2024 - 01/31/2024',
      '',
      'Date,Description,Amount',
      '01/02/2024,COFFEE,-5.75',
      '01/03/2024,PAYCHECK,2000.00',
    ].join('\n')
    const table = previewCsvText(csv)
    expect(table.headers).toEqual(['Date', 'Description', 'Amount'])
    expect(table.rows).toHaveLength(2)
    expect(table.preambleRows).toHaveLength(3)
  })

  it('drops a narrow trailing summary line', () => {
    const csv = [
      'Date,Description,Amount',
      '01/02/2024,COFFEE,-5.75',
      '01/03/2024,PAYCHECK,2000.00',
      'Total,1994.25',
    ].join('\n')
    const table = previewCsvText(csv)
    expect(table.rows).toHaveLength(2)
    expect(table.footerRows).toHaveLength(1)
  })

  it('reads a semicolon-delimited file', () => {
    const csv = ['Date;Description;Amount', '01/02/2024;COFFEE;-5,75'].join('\n')
    const table = previewCsvText(csv)
    expect(table.headers).toEqual(['Date', 'Description', 'Amount'])
    expect(table.rows[0]).toEqual(['01/02/2024', 'COFFEE', '-5,75'])
  })

  it('keeps a headerless file as data', () => {
    const csv = ['01/02/2024,COFFEE,-5.75', '01/03/2024,PAYCHECK,2000.00'].join('\n')
    const table = previewCsvText(csv)
    expect(table.hasHeader).toBe(false)
    expect(table.rows).toHaveLength(2)
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

  it('falls back to the memo column when the description is blank', () => {
    const withMemo: RawTable = {
      headers: ['Date', 'Description', 'Type', 'Amount'],
      rows: [
        ['05/04/2026', 'WINDSTREAM', 'ACH DEBIT', '-82.92'],
        ['05/04/2026', '', 'DDA CHECK', '-3300.00'],
        ['05/04/2026', '', 'IOD INTEREST PAID', '2.30'],
      ],
      delimiter: ',',
      hasHeader: true,
    }
    const result = mapCsvRows(withMemo, {
      columnMap: { date: 'Date', description: 'Description', memo: 'Type', amount: 'Amount' },
      dateFormat: 'MM/DD/YYYY',
      signConvention: 'negativeIsOutflow',
    })
    // A present description wins; the memo is still kept alongside it.
    expect(result.transactions[0]).toMatchObject({
      rawDescription: 'WINDSTREAM',
      memo: 'ACH DEBIT',
    })
    // A blank description falls back to the memo for the working description.
    expect(result.transactions[1]).toMatchObject({
      rawDescription: 'DDA CHECK',
      memo: 'DDA CHECK',
    })
    expect(result.transactions[2].rawDescription).toBe('IOD INTEREST PAID')
  })

  it('maps a check-number column, treating "0" as no check', () => {
    const withChecks: RawTable = {
      headers: ['Date', 'Check', 'Description', 'Type', 'Amount'],
      rows: [
        ['05/04/2026', '1490', '', 'DDA CHECK', '-3300.00'],
        ['05/06/2026', '1491', '', 'FED IMAGE CHECK', '-80.00'],
        ['05/04/2026', '0', 'WINDSTREAM', 'ACH DEBIT', '-82.92'],
      ],
      delimiter: ',',
      hasHeader: true,
    }
    const result = mapCsvRows(withChecks, {
      columnMap: {
        date: 'Date',
        description: 'Description',
        memo: 'Type',
        checkNumber: 'Check',
        amount: 'Amount',
      },
      dateFormat: 'MM/DD/YYYY',
      signConvention: 'negativeIsOutflow',
    })
    expect(result.transactions[0].checkNumber).toBe('1490')
    expect(result.transactions[1].checkNumber).toBe('1491')
    // "0" is a non-check row, so no check number is attached.
    expect(result.transactions[2].checkNumber).toBeUndefined()
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

  // The Amex "basic" export: a numeric "Account #" column sits next to "Amount".
  const amex: RawTable = {
    headers: ['Date', 'Description', 'Card Member', 'Account #', 'Amount'],
    rows: [
      ['06/26/2026', 'RACEWAY 6821 MOODY AL', 'JARED G MOORE', '-41004', '34.21'],
      ['06/25/2026', 'CVS PHARMACY MOODY AL', 'SARA K MOORE', '-42010', '67.36'],
      ['06/24/2026', 'AUTOPAY PAYMENT - THANK YOU', 'JARED G MOORE', '-41004', '-1746.44'],
    ],
    delimiter: ',',
    hasHeader: true,
  }

  it('does not mistake an integer "Account #" column for an amount column', () => {
    const config = detectMapping(amex)
    // Single amount column, not a false debit/credit split off "Account #".
    expect(config.signConvention).not.toBe('separateColumns')
    expect(config.columnMap.amount).toBe('Amount')
    expect(config.columnMap.debit).toBeUndefined()
    expect(config.columnMap.date).toBe('Date')
    expect(config.columnMap.description).toBe('Description')
    expect(config.dateFormat).toBe('MM/DD/YYYY')
  })

  it('reads Amex charges as positive-is-outflow from its payment row', () => {
    expect(detectMapping(amex, { accountType: 'credit' }).signConvention).toBe(
      'positiveIsOutflow',
    )
    // A non-credit account keeps the negative-is-outflow default.
    expect(detectMapping(amex, { accountType: 'checking' }).signConvention).toBe(
      'negativeIsOutflow',
    )
  })

  // Chase is the counterexample to the old "credit account ⇒ charges positive"
  // rule: it exports charges negative, so assuming by account type inverted
  // every amount in the file.
  const chaseCredit: RawTable = {
    headers: ['Transaction Date', 'Post Date', 'Description', 'Category', 'Type', 'Amount', 'Memo'],
    rows: [
      ['01/02/2024', '01/03/2024', 'STARBUCKS #123', 'Food & Drink', 'Sale', '-5.75', ''],
      ['01/04/2024', '01/05/2024', 'SHELL OIL', 'Gas', 'Sale', '-42.10', ''],
      ['01/06/2024', '01/07/2024', 'AMAZON.COM', 'Shopping', 'Sale', '-88.20', ''],
      ['01/10/2024', '01/10/2024', 'Payment Thank You - Web', '', 'Payment', '1200.00', ''],
    ],
    delimiter: ',',
    hasHeader: true,
  }

  const discover: RawTable = {
    headers: ['Trans. Date', 'Post Date', 'Description', 'Amount', 'Category'],
    rows: [
      ['01/02/2024', '01/03/2024', 'STARBUCKS #123', '5.75', 'Restaurants'],
      ['01/04/2024', '01/05/2024', 'SHELL OIL', '42.10', 'Gasoline'],
      ['01/06/2024', '01/07/2024', 'AMAZON.COM', '88.20', 'Merchandise'],
      ['01/10/2024', '01/10/2024', 'DIRECTPAY FULL BALANCE', '-136.05', 'Payments'],
    ],
    delimiter: ',',
    hasHeader: true,
  }

  it('keeps Chase credit charges as negative-is-outflow', () => {
    const config = detectMapping(chaseCredit, { accountType: 'credit' })
    expect(config.signConvention).toBe('negativeIsOutflow')
    expect(config.columnMap.amount).toBe('Amount')
    // Spending must come out negative, not positive.
    const { transactions } = mapCsvRows(chaseCredit, config)
    expect(transactions[0].amountCents).toBe(-575)
    expect(transactions[3].amountCents).toBe(120000)
  })

  it('reads Discover charges as positive-is-outflow', () => {
    const config = detectMapping(discover, { accountType: 'credit' })
    expect(config.signConvention).toBe('positiveIsOutflow')
    const { transactions } = mapCsvRows(discover, config)
    expect(transactions[0].amountCents).toBe(-575)
    expect(transactions[3].amountCents).toBe(13605)
  })

  it('falls back to majority-of-rows when no payment row is present', () => {
    const noPayment: RawTable = { ...discover, rows: discover.rows.slice(0, 3) }
    expect(detectMapping(noPayment, { accountType: 'credit' }).signConvention).toBe(
      'positiveIsOutflow',
    )
  })
})

describe('checkSignConvention', () => {
  const tx = (amountCents: number, rawDescription: string) => ({ amountCents, rawDescription })

  it('flags a card whose payments look like money out', () => {
    const warning = checkSignConvention(
      [
        tx(575, 'STARBUCKS'),
        tx(4210, 'SHELL OIL'),
        tx(8820, 'AMAZON.COM'),
        tx(-120000, 'Payment Thank You - Web'),
      ],
      'negativeIsOutflow',
      'credit',
    )
    expect(warning?.suggested).toBe('positiveIsOutflow')
  })

  it('flags a statement with no spending at all', () => {
    const warning = checkSignConvention(
      [tx(575, 'A'), tx(4210, 'B'), tx(8820, 'C'), tx(1000, 'D')],
      'negativeIsOutflow',
      'checking',
    )
    expect(warning?.suggested).toBe('positiveIsOutflow')
  })

  it('tolerates a lopsided but plausible month on a non-card account', () => {
    // 80% inflow is unusual, not wrong — a savings account can look like this,
    // so the warning stays quiet rather than crying wolf.
    expect(
      checkSignConvention(
        [tx(575, 'A'), tx(4210, 'B'), tx(8820, 'C'), tx(1000, 'D'), tx(-50, 'E')],
        'negativeIsOutflow',
        'checking',
      ),
    ).toBeNull()
  })

  it('stays quiet on a normal statement', () => {
    expect(
      checkSignConvention(
        [tx(-575, 'A'), tx(-4210, 'B'), tx(-8820, 'C'), tx(200000, 'PAYCHECK')],
        'negativeIsOutflow',
        'checking',
      ),
    ).toBeNull()
  })

  it('stays quiet for separate debit/credit columns', () => {
    expect(
      checkSignConvention(
        [tx(575, 'A'), tx(4210, 'B'), tx(8820, 'C'), tx(1000, 'D')],
        'separateColumns',
        'checking',
      ),
    ).toBeNull()
  })
})

describe('computeDedupHash', () => {
  it('is stable for identical input and varies with fields', () => {
    const base = { accountId: 1, date: '2024-01-02', amountCents: -575, description: 'STARBUCKS' }
    expect(computeDedupHash(base)).toBe(computeDedupHash(base))
    expect(computeDedupHash(base)).not.toBe(computeDedupHash({ ...base, amountCents: -576 }))
  })

  it('keeps the pre-check-number hash when no check number is present', () => {
    // Existing transactions have no check number; their hash must be unchanged
    // so a re-import still recognizes them as duplicates.
    const base = { accountId: 1, date: '2024-01-02', amountCents: -575, description: 'STARBUCKS' }
    expect(computeDedupHash({ ...base, checkNumber: undefined })).toBe(computeDedupHash(base))
    expect(computeDedupHash({ ...base, checkNumber: '' })).toBe(computeDedupHash(base))
  })

  it('distinguishes same-day, same-amount checks by check number', () => {
    const check = { accountId: 1, date: '2024-05-04', amountCents: -330000, description: 'DDA CHECK' }
    expect(computeDedupHash({ ...check, checkNumber: '1490' })).not.toBe(
      computeDedupHash({ ...check, checkNumber: '1491' }),
    )
    // A check number also separates a check from an otherwise-identical row.
    expect(computeDedupHash({ ...check, checkNumber: '1490' })).not.toBe(
      computeDedupHash(check),
    )
  })
})
