import { useMemo, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { Page, EmptyState } from '../components/Page'
import { formatCents } from '../money/cents'
import { CANDIDATE_FORMATS } from '../import/dates'
import { previewCsv, mapCsvRows } from '../import/csv'
import { detectMapping } from '../import/detect'
import { findMatchingProfile, profileToConfig, saveProfile } from '../import/profiles'
import { commitImport, type CommitResult } from '../import/commit'
import type { MappingConfig, RawTable } from '../import/types'
import type { SignConvention } from '../db/schema'

const selectCls =
  'rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:border-sky-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100'

export function Import() {
  const accounts = useLiveQuery(() => db.accounts.orderBy('name').toArray(), [])
  const fileRef = useRef<HTMLInputElement>(null)

  const [accountId, setAccountId] = useState<number | null>(null)
  const [fileName, setFileName] = useState('')
  const [table, setTable] = useState<RawTable | null>(null)
  const [config, setConfig] = useState<MappingConfig | null>(null)
  const [profileId, setProfileId] = useState<number | null>(null)
  const [profileNote, setProfileNote] = useState<string | null>(null)
  const [profileName, setProfileName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<CommitResult | null>(null)

  const account = accounts?.find((a) => a.id === accountId) ?? null

  const mapped = useMemo(
    () => (table && config ? mapCsvRows(table, config) : null),
    [table, config],
  )

  async function onFile(file: File) {
    setError(null)
    setResult(null)
    setFileName(file.name)
    try {
      const parsed = await previewCsv(file)
      setTable(parsed)
      const match = await findMatchingProfile(parsed)
      if (match) {
        setConfig(profileToConfig(match))
        setProfileId(match.id ?? null)
        setProfileNote(`Using saved profile "${match.name}".`)
      } else {
        setConfig(detectMapping(parsed, { accountType: account?.type }))
        setProfileId(null)
        setProfileNote(null)
      }
    } catch (e) {
      setTable(null)
      setConfig(null)
      setError(e instanceof Error ? e.message : 'Could not read this file.')
    }
  }

  function update(patch: Partial<MappingConfig>) {
    setConfig((c) => (c ? { ...c, ...patch } : c))
  }
  function updateColumn(patch: Partial<MappingConfig['columnMap']>) {
    setConfig((c) => (c ? { ...c, columnMap: { ...c.columnMap, ...patch } } : c))
  }

  async function onImport() {
    if (!account || !table || !config || !mapped) return
    setBusy(true)
    setError(null)
    try {
      if (profileName.trim() && profileId == null) {
        await saveProfile(profileName.trim(), config, {
          institution: account.institution,
          defaultAccountId: account.id,
        })
      }
      const res = await commitImport({
        accountId: account.id!,
        currency: account.currency,
        fileName,
        profileId,
        transactions: mapped.transactions,
      })
      setResult(res)
      reset()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed.')
    } finally {
      setBusy(false)
    }
  }

  function reset() {
    setTable(null)
    setConfig(null)
    setProfileId(null)
    setProfileNote(null)
    setProfileName('')
    setFileName('')
    if (fileRef.current) fileRef.current.value = ''
  }

  if (accounts && accounts.length === 0) {
    return (
      <Page title="Import a statement">
        <EmptyState>
          First,{' '}
          <Link to="/accounts" className="font-medium text-sky-600 hover:underline dark:text-sky-400">
            add an account
          </Link>{' '}
          to import statements into.
        </EmptyState>
      </Page>
    )
  }

  const isSeparate = config?.signConvention === 'separateColumns'

  return (
    <Page
      title="Import a statement"
      description="Upload a CSV export from your bank or credit card. The file is read in your browser and never uploaded anywhere."
    >
      {result && (
        <div className="mb-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
          Imported <strong>{result.added}</strong> transaction(s)
          {result.duplicates > 0 && <> · skipped {result.duplicates} duplicate(s)</>}.{' '}
          <Link to="/transactions" className="font-medium underline">
            View transactions
          </Link>
        </div>
      )}
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{error}</div>
      )}

      {/* Step 1: account */}
      <div className="mb-4 flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Import into</span>
        <select
          className={selectCls}
          value={accountId ?? ''}
          onChange={(e) => setAccountId(e.target.value ? Number(e.target.value) : null)}
        >
          <option value="">Select an account…</option>
          {accounts?.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} ({a.currency})
            </option>
          ))}
        </select>
      </div>

      {/* Step 2: file */}
      <div
        className="mb-4 rounded-xl border-2 border-dashed border-slate-300 bg-white p-8 text-center dark:border-slate-700 dark:bg-slate-900"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault()
          const f = e.dataTransfer.files?.[0]
          if (f) void onFile(f)
        }}
      >
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void onFile(f)
          }}
        />
        <p className="text-sm text-slate-600 dark:text-slate-300">
          {fileName ? (
            <>
              Selected: <strong>{fileName}</strong>
            </>
          ) : (
            'Drag a CSV here, or'
          )}
        </p>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={!accountId}
          className="mt-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Choose CSV file…
        </button>
        {!accountId && (
          <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">Select an account first.</p>
        )}
      </div>

      {/* Step 3: mapping */}
      {table && config && (
        <div className="space-y-4">
          {profileNote && (
            <div className="rounded-lg bg-sky-50 px-4 py-2 text-sm text-sky-800 dark:bg-sky-950 dark:text-sky-300">
              {profileNote}
            </div>
          )}

          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">
              Map the columns
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Date column">
                <ColumnSelect
                  headers={table.headers}
                  value={config.columnMap.date}
                  onChange={(v) => updateColumn({ date: v })}
                />
              </Field>
              <Field label="Date format">
                <select
                  className={selectCls}
                  value={config.dateFormat}
                  onChange={(e) => update({ dateFormat: e.target.value })}
                >
                  {CANDIDATE_FORMATS.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Description column">
                <ColumnSelect
                  headers={table.headers}
                  value={config.columnMap.description}
                  onChange={(v) => updateColumn({ description: v })}
                />
              </Field>

              <Field label="Amount columns">
                <select
                  className={selectCls}
                  value={isSeparate ? 'separate' : 'single'}
                  onChange={(e) =>
                    update(
                      e.target.value === 'separate'
                        ? {
                            signConvention: 'separateColumns',
                            columnMap: {
                              ...config.columnMap,
                              debit: config.columnMap.debit ?? table.headers[0],
                              credit: config.columnMap.credit ?? table.headers[1],
                            },
                          }
                        : { signConvention: 'negativeIsOutflow' },
                    )
                  }
                >
                  <option value="single">Single amount column</option>
                  <option value="separate">Separate debit / credit</option>
                </select>
              </Field>

              {isSeparate ? (
                <>
                  <Field label="Debit (money out)">
                    <ColumnSelect
                      headers={table.headers}
                      value={config.columnMap.debit ?? ''}
                      onChange={(v) => updateColumn({ debit: v })}
                    />
                  </Field>
                  <Field label="Credit (money in)">
                    <ColumnSelect
                      headers={table.headers}
                      value={config.columnMap.credit ?? ''}
                      onChange={(v) => updateColumn({ credit: v })}
                    />
                  </Field>
                </>
              ) : (
                <>
                  <Field label="Amount column">
                    <ColumnSelect
                      headers={table.headers}
                      value={config.columnMap.amount ?? ''}
                      onChange={(v) => updateColumn({ amount: v })}
                    />
                  </Field>
                  <Field label="Sign convention">
                    <select
                      className={selectCls}
                      value={config.signConvention}
                      onChange={(e) =>
                        update({ signConvention: e.target.value as SignConvention })
                      }
                    >
                      <option value="negativeIsOutflow">Negative = money out</option>
                      <option value="positiveIsOutflow">Positive = money out</option>
                    </select>
                  </Field>
                </>
              )}
            </div>
          </div>

          {/* Preview */}
          {mapped && (
            <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">
                Preview — {mapped.transactions.length} transaction(s) ready
                {mapped.skipped > 0 && (
                  <span className="font-normal text-slate-500 dark:text-slate-400">
                    {' '}
                    · {mapped.skipped} row(s) skipped (unparseable date/amount)
                  </span>
                )}
              </h2>
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase text-slate-400 dark:text-slate-500">
                  <tr>
                    <th className="py-1 font-medium">Date</th>
                    <th className="py-1 font-medium">Description</th>
                    <th className="py-1 text-right font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {mapped.transactions.slice(0, 8).map((t, i) => (
                    <tr key={i}>
                      <td className="py-1 text-slate-500 dark:text-slate-400">{t.date}</td>
                      <td className="py-1">{t.rawDescription}</td>
                      <td
                        className={`py-1 text-right ${
                          t.amountCents < 0
                            ? 'text-slate-900 dark:text-slate-100'
                            : 'text-emerald-600 dark:text-emerald-400'
                        }`}
                      >
                        {formatCents(t.amountCents, account?.currency ?? 'USD')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Save profile + import */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            {profileId == null ? (
              <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                Save these settings as a profile:
                <input
                  className={selectCls}
                  placeholder="e.g. Chase Checking CSV"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                />
              </label>
            ) : (
              <span className="text-sm text-slate-500 dark:text-slate-400">Using a saved profile.</span>
            )}
            <button
              onClick={onImport}
              disabled={busy || !mapped || mapped.transactions.length === 0}
              className="rounded-lg bg-sky-600 px-5 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
            >
              {busy ? 'Importing…' : `Import ${mapped?.transactions.length ?? 0} transaction(s)`}
            </button>
          </div>
        </div>
      )}
    </Page>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</span>
      {children}
    </label>
  )
}

function ColumnSelect({
  headers,
  value,
  onChange,
}: {
  headers: string[]
  value: string
  onChange: (v: string) => void
}) {
  return (
    <select
      className={selectCls}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">—</option>
      {headers.map((h) => (
        <option key={h} value={h}>
          {h}
        </option>
      ))}
    </select>
  )
}
