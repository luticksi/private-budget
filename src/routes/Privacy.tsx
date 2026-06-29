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
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-900">
            Live network activity (this session)
          </h2>
          <p className="mt-1 text-sm text-slate-500">
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
            <ul className="mt-3 list-inside list-disc text-sm text-red-600">
              {crossOrigin.map((r) => (
                <li key={r.id}>
                  {r.kind} {r.method} → {r.url}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-3 text-sm leading-relaxed text-slate-700">
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
    <div className="rounded-lg border border-slate-200 px-4 py-3">
      <div
        className={`text-2xl font-semibold ${
          danger ? 'text-red-600' : 'text-emerald-600'
        }`}
      >
        {value}
      </div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  )
}

function Claim({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="font-semibold text-slate-900">{title}</h3>
      <p className="mt-1 text-slate-600">{children}</p>
    </div>
  )
}
