import type { ColumnMap, SignConvention } from '../db/schema'

/** A single transaction extracted from a statement, before it's stored. */
export interface ParsedTransaction {
  date: string // ISO "YYYY-MM-DD"
  amountCents: number // signed: negative = outflow, positive = inflow
  rawDescription: string
  fitId?: string
  balanceCents?: number
}

/** A statement parsed into a generic table (used by tabular formats like CSV). */
export interface RawTable {
  headers: string[]
  rows: string[][]
  delimiter: string
  hasHeader: boolean
}

/** The bits of an ImportProfile needed to turn a RawTable into transactions. */
export interface MappingConfig {
  columnMap: ColumnMap
  dateFormat: string
  signConvention: SignConvention
}

/**
 * Pluggable statement parser. CSV implements the tabular path (`preview` +
 * `mapRows`). Future self-describing formats (OFX/QFX, PDF) would implement
 * `parse` instead and skip the column-mapping step.
 */
export interface StatementParser {
  id: string
  label: string
  canParse(file: File): boolean
  /** Tabular formats: read the file into a generic table for mapping. */
  preview?(file: File): Promise<RawTable>
  /** Tabular formats: apply a mapping to produce transactions. */
  mapRows?(table: RawTable, config: MappingConfig): MapResult
  /** Self-describing formats: parse straight to transactions. */
  parse?(file: File): Promise<ParsedTransaction[]>
}

export interface MapResult {
  transactions: ParsedTransaction[]
  /** Rows that couldn't be parsed (bad/blank date or amount). */
  skipped: number
}
