import Papa from 'papaparse'
import { parseAmountToCents } from '../money/cents'
import { parseDate } from './dates'
import type {
  MapResult,
  MappingConfig,
  ParsedTransaction,
  RawTable,
  SkippedRow,
  StatementParser,
} from './types'

/** True if a cell looks like a number/money value (and not a date). */
function looksNumeric(cell: string): boolean {
  const v = cell.trim()
  if (!v) return false
  if (/[A-Za-z/]/.test(v)) return false // exclude text and date-like "01/02/2020"
  return parseAmountToCents(v) !== null
}

/** True if a cell looks like a date. */
function looksDate(cell: string): boolean {
  return /^\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4}/.test(cell.trim())
}

/** Heuristic: a row is a header if no cell looks like data. */
function isHeaderRow(row: string[]): boolean {
  return !row.some((c) => looksNumeric(c) || looksDate(c))
}

/** How far into the file we'll look for the real header row. */
const MAX_PREAMBLE_ROWS = 20

/** Delimiters to retry with when Papa's auto-detection produces one column. */
const FALLBACK_DELIMITERS = [',', ';', '\t', '|']

/** The most common row width — the shape of the actual data table. */
function modalWidth(rows: string[][]): number {
  const counts = new Map<number, number>()
  for (const r of rows) counts.set(r.length, (counts.get(r.length) ?? 0) + 1)
  let best = 0
  let bestCount = -1
  for (const [width, count] of counts) {
    // Ties go to the wider shape: a preamble line is never wider than the table.
    if (count > bestCount || (count === bestCount && width > best)) {
      best = width
      bestCount = count
    }
  }
  return best
}

/**
 * Find where the real table starts. Statement exports often carry a few
 * metadata lines ("Account: ****1234", a date range, a blank line) above the
 * header, which would otherwise be read as the header itself. The table starts
 * at the first row that has the table's shape and is followed by another row of
 * the same shape.
 */
function findTableStart(rows: string[][], width: number): number {
  const limit = Math.min(rows.length, MAX_PREAMBLE_ROWS)
  for (let i = 0; i < limit; i++) {
    if (rows[i].length !== width) continue
    if (i + 1 < rows.length && rows[i + 1].length !== width) continue
    return i
  }
  return 0
}

/**
 * Drop trailing summary lines ("Total,1234.56"). A row only qualifies if it is
 * both narrower than the table and nearly empty — a truncated *data* row still
 * carries a date, a description and an amount, and `mapCsvRows` reports
 * anything it can't parse rather than losing it silently.
 */
function findTableEnd(rows: string[][], width: number, start: number): number {
  const isFooter = (row: string[]) =>
    row.length < width && row.filter((c) => c.trim() !== '').length <= 2
  let end = rows.length
  while (end > start + 1 && isFooter(rows[end - 1])) end--
  return end
}

function parseText(text: string, delimiter?: string): string[][] {
  const res = Papa.parse<string[]>(text, {
    skipEmptyLines: 'greedy',
    ...(delimiter ? { delimiter } : {}),
  })
  return (res.data as string[][]).filter((r) => r.length > 0)
}

/**
 * Read CSV text into a generic table, discarding preamble and footer lines.
 * Exported separately from `previewCsv` so the parsing is testable without a
 * File object.
 */
export function previewCsvText(text: string, delimiterHint?: string): RawTable {
  let delimiter = delimiterHint ?? ''
  let data = parseText(text, delimiterHint)
  if (!data.length) throw new Error('The file appears to be empty.')

  if (!delimiter) {
    const auto = Papa.parse<string[]>(text, { skipEmptyLines: 'greedy', preview: 5 })
    delimiter = auto.meta.delimiter || ','
  }

  // If auto-detection failed to split the file (or split a preamble line
  // instead of the table), retry each candidate and keep the widest table.
  if (modalWidth(data) <= 1) {
    for (const d of FALLBACK_DELIMITERS) {
      const attempt = parseText(text, d)
      if (modalWidth(attempt) > modalWidth(data)) {
        data = attempt
        delimiter = d
      }
    }
  }

  const width = modalWidth(data)
  const start = findTableStart(data, width)
  const end = findTableEnd(data, width, start)

  const preambleRows = data.slice(0, start)
  const footerRows = data.slice(end)
  const tableRows = data.slice(start, end)

  const hasHeader = tableRows.length > 0 && isHeaderRow(tableRows[0])
  const headerRow = hasHeader ? tableRows[0] : null
  const bodyRows = hasHeader ? tableRows.slice(1) : tableRows

  const headers = Array.from(
    { length: width },
    (_, i) => headerRow?.[i]?.trim() || `Column ${i + 1}`,
  )
  const rows = bodyRows.map((r) => Array.from({ length: width }, (_, i) => (r[i] ?? '').trim()))

  return {
    headers,
    rows,
    delimiter,
    hasHeader,
    ...(preambleRows.length ? { preambleRows } : {}),
    ...(footerRows.length ? { footerRows } : {}),
  }
}

export async function previewCsv(file: File): Promise<RawTable> {
  const text = await file.text()
  return previewCsvText(text)
}

/** Compare header names ignoring case and punctuation ("Trans. Date" = "Trans Date"). */
export const normalizeHeader = (h: string): string =>
  h.toLowerCase().replace(/[^a-z0-9]/g, '')

/**
 * Look up a cell by header name, falling back to a normalized comparison so a
 * saved profile keeps working when a bank tweaks its header punctuation.
 */
function cellGetter(headers: string[], row: string[]) {
  return (headerName: string): string => {
    if (!headerName) return ''
    let idx = headers.indexOf(headerName)
    if (idx === -1) {
      const target = normalizeHeader(headerName)
      idx = headers.findIndex((h) => normalizeHeader(h) === target)
    }
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

/** How many skipped rows we keep for display. */
const MAX_SKIPPED_SAMPLES = 10

export function mapCsvRows(table: RawTable, config: MappingConfig): MapResult {
  const transactions: ParsedTransaction[] = []
  const skippedRows: SkippedRow[] = []
  let skipped = 0

  table.rows.forEach((row, i) => {
    const get = cellGetter(table.headers, row)
    const dateCell = get(config.columnMap.date)
    const date = parseDate(dateCell, config.dateFormat)
    const amountCents = rowAmountCents(get, config)
    const rawDescription = get(config.columnMap.description).trim()

    if (!date || amountCents == null) {
      skipped++
      if (skippedRows.length < MAX_SKIPPED_SAMPLES) {
        const reason = !date
          ? dateCell.trim()
            ? `Date "${dateCell.trim()}" doesn't match ${config.dateFormat}`
            : 'No date value'
          : 'No readable amount'
        skippedRows.push({ rowNumber: i + 1, cells: row, reason })
      }
      return
    }

    const tx: ParsedTransaction = { date, amountCents, rawDescription }
    if (config.columnMap.balance) {
      const balanceCents = parseAmountToCents(get(config.columnMap.balance))
      if (balanceCents != null) tx.balanceCents = balanceCents
    }
    transactions.push(tx)
  })

  return { transactions, skipped, skippedRows }
}

export const csvParser: StatementParser = {
  id: 'csv',
  label: 'CSV',
  canParse: (file) => /\.csv$/i.test(file.name) || file.type === 'text/csv',
  preview: previewCsv,
  mapRows: mapCsvRows,
}
