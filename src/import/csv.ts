import Papa from 'papaparse'
import { parseAmountToCents } from '../money/cents'
import { parseDate } from './dates'
import type { MapResult, MappingConfig, ParsedTransaction, RawTable, StatementParser } from './types'

/** True if a cell looks like a number/money value (and not a date). */
function looksNumeric(cell: string): boolean {
  const v = cell.trim()
  if (!v) return false
  if (/[A-Za-z/]/.test(v)) return false // exclude text and date-like "01/02/2020"
  return parseAmountToCents(v) !== null
}

/** True if a cell looks like a date. */
function looksDate(cell: string): boolean {
  return /^\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4}$/.test(cell.trim())
}

/** Heuristic: the first row is a header if no cell looks like data. */
function detectHasHeader(rows: string[][]): boolean {
  const first = rows[0]
  if (!first) return false
  return !first.some((c) => looksNumeric(c) || looksDate(c))
}

export async function previewCsv(file: File): Promise<RawTable> {
  return new Promise((resolve, reject) => {
    Papa.parse<string[]>(file, {
      skipEmptyLines: 'greedy',
      complete: (res) => {
        const data = (res.data as string[][]).filter((r) => r.length > 0)
        if (!data.length) {
          reject(new Error('The file appears to be empty.'))
          return
        }
        const delimiter = res.meta.delimiter || ','
        const hasHeader = detectHasHeader(data)
        const width = Math.max(...data.map((r) => r.length))
        const headerRow = hasHeader ? data[0] : null
        const bodyRows = hasHeader ? data.slice(1) : data

        const headers = Array.from(
          { length: width },
          (_, i) => headerRow?.[i]?.trim() || `Column ${i + 1}`,
        )
        const rows = bodyRows.map((r) =>
          Array.from({ length: width }, (_, i) => (r[i] ?? '').trim()),
        )
        resolve({ headers, rows, delimiter, hasHeader })
      },
      error: (err) => reject(err),
    })
  })
}

function cellGetter(headers: string[], row: string[]) {
  return (headerName: string): string => {
    const idx = headers.indexOf(headerName)
    return idx === -1 ? '' : (row[idx] ?? '')
  }
}

function rowAmountCents(
  get: (h: string) => string,
  config: MappingConfig,
): number | null {
  const { columnMap, signConvention } = config
  if (signConvention === 'separateColumns') {
    const debit = columnMap.debit ? parseAmountToCents(get(columnMap.debit)) : null
    const credit = columnMap.credit ? parseAmountToCents(get(columnMap.credit)) : null
    if (debit == null && credit == null) return null
    return (credit ? Math.abs(credit) : 0) - (debit ? Math.abs(debit) : 0)
  }
  if (!columnMap.amount) return null
  const raw = parseAmountToCents(get(columnMap.amount))
  if (raw == null) return null
  return signConvention === 'positiveIsOutflow' ? -raw : raw
}

export function mapCsvRows(table: RawTable, config: MappingConfig): MapResult {
  const transactions: ParsedTransaction[] = []
  let skipped = 0

  for (const row of table.rows) {
    const get = cellGetter(table.headers, row)
    const date = parseDate(get(config.columnMap.date), config.dateFormat)
    const amountCents = rowAmountCents(get, config)
    const rawDescription = get(config.columnMap.description).trim()

    if (!date || amountCents == null) {
      skipped++
      continue
    }
    transactions.push({ date, amountCents, rawDescription })
  }

  return { transactions, skipped }
}

export const csvParser: StatementParser = {
  id: 'csv',
  label: 'CSV',
  canParse: (file) => /\.csv$/i.test(file.name) || file.type === 'text/csv',
  preview: previewCsv,
  mapRows: mapCsvRows,
}
