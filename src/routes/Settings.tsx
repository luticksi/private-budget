import { useEffect, useRef, useState, type ReactNode } from 'react'
import { exportData, downloadBackup, importData, wipeAllData } from '../db/backup'
import { ensureSeeded } from '../db/seed'
import { recategorizeUncategorized } from '../categorize/engine'
import { detectTransfers } from '../transfers/detect'
import {
  getStorageEstimate,
  isStoragePersisted,
  requestPersistentStorage,
  formatBytes,
} from '../storage/persist'
import { Page } from '../components/Page'

export function Settings() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [persisted, setPersisted] = useState<boolean | null>(null)
  const [usage, setUsage] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      setPersisted(await isStoragePersisted())
      const est = await getStorageEstimate()
      if (est) setUsage(formatBytes(est.usage))
    })()
  }, [status])

  async function onRequestPersist() {
    const ok = await requestPersistentStorage()
    setPersisted(ok)
    setStatus(
      ok
        ? 'Your browser will now keep this data and not auto-evict it.'
        : "Your browser declined persistent storage. Your data is still here — just back it up regularly.",
    )
  }

  async function onExport() {
    setError(null)
    downloadBackup(await exportData())
    setStatus('Backup downloaded.')
  }

  async function onImportFile(file: File) {
    setError(null)
    setStatus(null)
    try {
      const text = await file.text()
      const ok = confirm(
        'Restoring will REPLACE all current data with the contents of this backup. Continue?',
      )
      if (!ok) return
      const result = await importData(text)
      setStatus(
        `Restored ${result.counts.transactions} transactions across ${result.counts.accounts} account(s).`,
      )
    } catch (e) {
      setError(
        e instanceof Error
          ? `Could not restore this file: ${e.message}`
          : 'Could not restore this file.',
      )
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function onWipe() {
    setError(null)
    if (!confirm('Permanently delete ALL data on this device? This cannot be undone.')) return
    if (!confirm('Are you absolutely sure? Everything will be erased.')) return
    await wipeAllData()
    await ensureSeeded()
    setStatus('All data erased. Default categories restored.')
  }

  async function onDetectTransfers() {
    setError(null)
    const pairs = await detectTransfers()
    setStatus(
      pairs > 0
        ? `Found and flagged ${pairs} transfer(s) so they won't count as spending.`
        : 'No new transfers found.',
    )
  }

  async function onRecategorize() {
    setError(null)
    const changed = await recategorizeUncategorized()
    setStatus(`Categorized ${changed} previously-uncategorized transaction(s).`)
  }

  return (
    <Page
      title="Settings"
      description="Back up your data, restore it on another device, or wipe everything. Your data only exists on this device, so keeping a backup is a good idea."
    >
      <div className="space-y-4">
        {status && (
          <div className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {status}
          </div>
        )}
        {error && (
          <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        <Card
          title="Your data on this device"
          body="Everything is stored in this browser only — it isn't synced to other devices or browsers, and clearing your browser's site data will erase it. Keep a backup. The app asks your browser to keep this data and avoid auto-evicting it."
        >
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <span className="text-slate-600">
              Persistent storage:{' '}
              <strong className={persisted ? 'text-emerald-600' : 'text-amber-600'}>
                {persisted == null ? '…' : persisted ? 'on' : 'off'}
              </strong>
            </span>
            {usage && <span className="text-slate-500">Using {usage}</span>}
            {persisted === false && (
              <button
                onClick={onRequestPersist}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Request persistent storage
              </button>
            )}
          </div>
        </Card>

        <Card
          title="Tools"
          body="Re-run categorization on uncategorized transactions, or detect transfers between your accounts (e.g. credit-card payments) so they aren't double-counted as spending."
        >
          <div className="flex flex-wrap gap-3">
            <button
              onClick={onRecategorize}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Re-apply categorization rules
            </button>
            <button
              onClick={onDetectTransfers}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Detect transfers
            </button>
          </div>
        </Card>

        <Card
          title="Back up your data"
          body="Download a single JSON file containing everything. It's plain text you can read and keep anywhere."
        >
          <button
            onClick={onExport}
            className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700"
          >
            Download backup
          </button>
        </Card>

        <Card
          title="Restore from a backup"
          body="Replace everything on this device with a previously downloaded backup file."
        >
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void onImportFile(f)
            }}
          />
          <button
            onClick={() => fileRef.current?.click()}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Choose backup file…
          </button>
        </Card>

        <Card
          title="Danger zone"
          body="Erase all accounts, transactions, categories, and rules from this device."
        >
          <button
            onClick={onWipe}
            className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
          >
            Erase all data
          </button>
        </Card>
      </div>
    </Page>
  )
}

function Card({
  title,
  body,
  children,
}: {
  title: string
  body: string
  children: ReactNode
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="font-semibold text-slate-900">{title}</h2>
      <p className="mb-3 mt-1 text-sm text-slate-500">{body}</p>
      {children}
    </div>
  )
}
