# PrivateBudget

**A budgeting app that physically cannot see your money.**

You upload your bank and credit-card statements, and PrivateBudget consolidates
and categorizes your spending — telling you things like *"you spent $312 on food
last month, $84 of it at Blue Bottle."* The difference from every other
budgeting app: **all of this happens on your own device.** Your financial data
is never uploaded, synced, sold, or seen by us, and the code is open source so
you don't have to take our word for it.

🌐 [privatebudget.org](https://privatebudget.org)

---

## The mission

Mainstream budgeting apps ask you to connect your bank logins and hand over full
read access to your entire financial life, which then lives on someone else's
servers — to be mined, leaked, or sold. For a lot of people that's a deal-breaker,
and reasonably so.

PrivateBudget is built on the opposite principle: **privacy you can verify, not
privacy you're asked to trust.** Rather than *promising* we won't misuse your
data, the app is engineered so that it *can't* — there is no server to send your
data to, and the entire app is open source and reproducible so anyone can confirm
exactly what it does.

If a feature would ever require your financial data to leave your device, it
doesn't belong in the free, core app. That constraint is the whole point.

---

## How your privacy is guaranteed (and how to verify it)

These aren't policy promises — they're technical properties you can check
yourself in your browser's developer tools.

| Guarantee | How it works | How you verify it |
|---|---|---|
| **Your data never leaves your device** | Statements are read with the browser's File API and stored in **IndexedDB**, a database on your machine. There is no backend that holds data. | Open DevTools → **Network** and use the app. You'll see only same-origin static files load, and **zero** requests carrying your data. |
| **The app can't phone home** | A strict **Content-Security-Policy** (`connect-src 'self'`) blocks the page from opening any network connection except to its own static origin — which has no data endpoints. Served both as an HTTP header and a visible `<meta>` tag. | View source to see the `<meta>` CSP; check the response headers to see the same policy enforced by the server. |
| **No trackers or third-party code** | Zero analytics, zero third-party scripts, self-hosted fonts and assets. The CSP forbids loading from anywhere else. | The in-app badge shows a live count of cross-origin requests — it stays at **0**. |
| **Works completely offline** | An installable **PWA** with an offline service worker. | Turn off Wi-Fi. The app keeps working — proof nothing it needs comes from a server. |
| **Open source & auditable** | All code is public; the production build is reproducible. | Read the code. Rebuild it. Compare it to what's deployed. |
| **It's your data** | One-click JSON **export/restore**, and a "wipe everything" button. No lock-in. | Export your data and read the file — it's plain JSON. |

The in-app **"How your data stays private"** page walks through each of these and
shows the live network monitor.

---

## Features

- **CSV import** with a smart wizard: it auto-detects your bank's column layout,
  date format, and how amounts are signed, and remembers it as a reusable
  per-bank **profile** for next time.
- **Automatic deduplication** when you re-import overlapping statements — without
  collapsing genuine same-day repeat purchases.
- **Merchant normalization**: `SQ *BLUE BOTTLE 0123 OAKLAND CA` → `Blue Bottle`.
- **Rule-based categorization** with a built-in starter dictionary that **learns
  from your edits** — categorize a merchant once and it offers to apply that to
  every matching transaction and remember it. Fully deterministic and editable.
- **Transfer detection** so a credit-card payment from checking isn't
  double-counted as spending.
- **Spending by category** with drill-down: category → sub-category → individual
  **merchant** → transactions.
- **Monthly trends** (income vs. spending), **top merchants**, and a dashboard.
- **Backup & restore** to move your data between devices.

### Where your data lives — and how to keep it safe

Because nothing is stored on a server, your data lives **only in this browser, on
this device**, in IndexedDB. That's the privacy guarantee — but it also means
**you are responsible for keeping it.** A few things worth knowing:

- **It is not synced** across devices or even across browsers on the same machine
  (your data in Chrome won't appear in Firefox).
- **It survives** normal use, refreshes, and restarting your browser or computer.
  To reduce the chance the browser auto-evicts it when disk space is low, the app
  requests *persistent storage* on startup (you can see the status under
  **Settings → "Your data on this device"**).
- **It can be erased** if you: clear your browser's **"cookies and other site
  data"** for the site (note: clearing *only* cached files does **not** remove it,
  but the "Clear browsing data" dialog usually clears both together), browse in
  private/incognito mode, use an extension that wipes site data on exit, or
  reset/uninstall the browser.

**So: back up regularly.** In **Settings** you can:

- **Download backup** — exports everything to a single plain-JSON file you can
  store anywhere (cloud drive, USB stick, etc.).
- **Restore from a backup** — load that file on a new device or browser, or after
  a clear, to get all your accounts, transactions, categories, and rules back.

> The backup file is **unencrypted JSON**, so treat it like the sensitive
> financial data it is and store it somewhere safe. Optional at-rest encryption
> is on the roadmap.

### Roadmap

Subscription / recurring-charge audit ("you have 14 subscriptions totaling
$187/mo"), price-hike detection, budgets & alerts, OFX/QFX and best-effort PDF
import, and optional at-rest encryption. The parser layer is already pluggable
([`src/import/types.ts`](src/import/types.ts)) so new formats slot in without
rework.

---

## Tech stack

Vite · React · TypeScript · [Dexie](https://dexie.org) (IndexedDB) ·
[PapaParse](https://www.papaparse.com) (CSV) · [Recharts](https://recharts.org)
· Tailwind CSS · `vite-plugin-pwa`. Money is handled as integer cents (never
floating point) to avoid rounding errors.

Tests: Vitest (unit/integration) and Playwright (end-to-end).

---

## Development

```bash
npm install
npm run dev        # start the dev server
npm run build      # typecheck + production build (outputs to dist/)
npm run preview    # preview the production build locally
npm test           # unit & integration tests (Vitest)
npm run e2e        # end-to-end tests (Playwright)
```

A synthetic [`public/sample-statement.csv`](public/sample-statement.csv) is
included so you can try the import flow immediately.

---

## Deployment (Cloudflare Pages)

PrivateBudget is a static site, which is what keeps the no-backend guarantee
intact. Recommended setup:

- **Build command:** `npm run build`
- **Build output directory:** `dist`

The build automatically emits a [`_headers`](vite.config.ts) file into `dist`,
which Cloudflare Pages uses to serve the security headers (full CSP including
`frame-ancestors 'none'`, `X-Frame-Options: DENY`, `X-Content-Type-Options`,
`Referrer-Policy`, `Permissions-Policy`, and `Cross-Origin-Opener-Policy`). No
manual dashboard configuration is required — but after the first deploy you can
confirm the headers with:

```bash
curl -sI https://privatebudget.org | grep -i -E "content-security-policy|x-frame-options"
```

> Keep hosting static. The privacy guarantee depends on there being no server
> that can receive your data.

---

## Funding

PrivateBudget is free and open source, funded by donations via
[Donorbox](https://donorbox.org/private-budget). The donate link opens
Donorbox in a new tab rather than embedding it, so no third-party code ever runs
inside the app and the strict no-network guarantee is never weakened.

## License

[MIT](LICENSE)
