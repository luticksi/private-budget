import type { ReactNode } from 'react'
import { Page } from '../components/Page'
import { useNetworkRecords } from '../privacy/useNetworkRecords'

export function Privacy() {
  const records = useNetworkRecords()
  const crossOrigin = records.filter((r) => r.crossOrigin)

  return (
    <Page
      title="How your data stays private"
      description="PrivateBudget is built so that your financial data physically cannot leave your device. Here's how — and how to verify it yourself."
    >
      <div className="space-y-6">
        <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Live network activity (this session)
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            We watch every outbound request the app makes. Requests to a{' '}
            <em>different</em> origin would mean your data could be leaving —
            that number should always be zero.
          </p>
          <div className="mt-4 flex gap-4">
            <Stat label="Total requests" value={records.length} />
            <Stat
              label="Cross-origin requests"
              value={crossOrigin.length}
              danger={crossOrigin.length > 0}
            />
          </div>
          {crossOrigin.length > 0 && (
            <ul className="mt-3 list-inside list-disc text-sm text-red-600 dark:text-red-400">
              {crossOrigin.map((r) => (
                <li key={r.id}>
                  {r.kind} {r.method} → {r.url}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-3 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
          <Claim title="It all stays in your browser">
            Your statements are read with the browser's File API and stored in
            IndexedDB — a database that lives on your device. Nothing is uploaded.
          </Claim>
          <Claim title="The app cannot phone home">
            A strict Content-Security-Policy (<code>connect-src 'self'</code>)
            blocks the app from opening connections to anywhere but its own
            static origin, which has no place to store data.
          </Claim>
          <Claim title="No trackers, no analytics">
            There are no third-party scripts, fonts, or analytics. The badge in
            the header reflects this in real time.
          </Claim>
          <Claim title="Open source &amp; verifiable">
            The code is public and the build is reproducible, so you can confirm
            the site you're using matches the code you can read.
          </Claim>
          <Claim title="Verify it yourself">
            Open your browser's DevTools → Network tab and use the app. You'll
            see only same-origin static files load, and zero requests carrying
            your data. You can even turn off Wi-Fi — the app keeps working.
          </Claim>
        </section>

        <section className="space-y-3 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Data retention &amp; storage
          </h2>
          <Claim title="Your data lives only on this device">
            All accounts, transactions, categories, and rules are stored in
            IndexedDB — a database built into your browser. Nothing is ever
            uploaded. If you use a different browser, a different device, or
            incognito mode, you start with a fresh database.
          </Claim>
          <Claim title="What &ldquo;persistent storage&rdquo; means">
            By default, IndexedDB is <em>best-effort</em>: the browser may
            silently delete it when your device runs low on disk space. The app
            requests <em>persistent storage</em> on startup, which asks the
            browser to protect this site&rsquo;s data from automatic eviction —
            the same treatment it gives installed apps. You can see whether
            persistence is granted under{' '}
            <strong>Settings &rarr; Your data on this device</strong>.
          </Claim>
          <Claim title="What happens if you block the storage prompt">
            If your browser shows a permission popup and you deny it — or if
            the browser quietly declines — the app falls back to plain
            best-effort IndexedDB. Your data is still fully there and works
            normally. The only difference is the browser <em>could</em>{' '}
            reclaim that space under heavy disk pressure, without warning.
            You can re-request persistent storage at any time from Settings.
          </Claim>
          <Claim title="What &ldquo;persistent&rdquo; does not protect against">
            Persistent storage only prevents silent automatic eviction. It does{' '}
            <strong>not</strong> protect your data if you manually clear your
            browser&rsquo;s site data, cookies, or cached files — that always
            erases IndexedDB regardless. The same applies if you uninstall the
            browser, reset your device, or use an extension that wipes data on
            exit.
          </Claim>
          <Claim title="Keep a backup">
            The safest guarantee is a regular backup. Settings &rarr;{' '}
            <strong>Download backup</strong> exports everything to a single
            plain-JSON file you can store anywhere — cloud drive, USB stick,
            or another device. Restore it at any time to recover all accounts,
            transactions, categories, and rules.
          </Claim>
        </section>
      </div>
    </Page>
  )
}

function Stat({
  label,
  value,
  danger,
}: {
  label: string
  value: number
  danger?: boolean
}) {
  return (
    <div className="rounded-lg border border-slate-200 px-4 py-3 dark:border-slate-800">
      <div
        className={`text-2xl font-semibold ${
          danger ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'
        }`}
      >
        {value}
      </div>
      <div className="text-xs text-slate-500 dark:text-slate-400">{label}</div>
    </div>
  )
}

function Claim({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <h3 className="font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
      <p className="mt-1 text-slate-600 dark:text-slate-300">{children}</p>
    </div>
  )
}
