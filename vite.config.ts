import { defineConfig } from 'vitest/config'
import type { Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

/**
 * The single most important security control in this app.
 *
 * `connect-src 'self'` means the page can only open network connections
 * (fetch / XHR / WebSocket / sendBeacon) to its own origin. Because the
 * production origin is a static host with no data endpoints, there is
 * physically nowhere for your financial data to be sent. Anyone can verify
 * this in DevTools → Network.
 *
 * The File API used to read statements is NOT a network operation and is
 * unaffected by this policy.
 */
const CSP = [
  "default-src 'self'",
  "connect-src 'self'",
  "img-src 'self' data:",
  // Many React chart/UI libs inject inline <style> tags. Inline styles cannot
  // exfiltrate data, so this is a safe relaxation; scripts stay locked down.
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self'",
  "font-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ')

// `frame-ancestors` is ignored in a <meta> tag, so it lives only in the HTTP
// header version of the policy (emitted to the Cloudflare Pages `_headers` file).
const CSP_HEADER = `${CSP}; frame-ancestors 'none'`

// Static-host response headers. Cloudflare Pages reads `_headers` from the
// build output. This is the canonical, strongest place to set the policy;
// the <meta> tag mirrors it so the guarantee is also visible in page source.
const HEADERS_FILE = `# Security headers for PrivateBudget (Cloudflare Pages reads this file).
/*
  Content-Security-Policy: ${CSP_HEADER}
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: no-referrer
  Permissions-Policy: accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()
  Cross-Origin-Opener-Policy: same-origin
`

/**
 * Production-only security plugin:
 *  - injects the strict CSP into index.html (visible, self-documenting), and
 *  - emits a `_headers` file so the static host serves the same policy as a
 *    real HTTP header (plus header-only protections like frame-ancestors).
 */
function securityHeaders(): Plugin {
  return {
    name: 'security-headers',
    apply: 'build',
    transformIndexHtml(html) {
      return html.replace(
        '</title>',
        `</title>\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`,
      )
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: '_headers', source: HEADERS_FILE })
    },
  }
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    securityHeaders(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'PrivateBudget',
        short_name: 'PrivateBudget',
        description:
          'Private, local-first budgeting. Your data never leaves your device.',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        icons: [{ src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml' }],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
    include: ['src/**/*.test.ts'], // unit tests only; e2e/ is Playwright's
  },
})
