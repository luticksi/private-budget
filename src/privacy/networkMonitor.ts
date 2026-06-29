/**
 * Network monitor — part of the app's "prove it's local" promise.
 *
 * We wrap every browser API that can send data off the device (fetch, XHR,
 * WebSocket, sendBeacon) and record each call. The Privacy page displays a
 * live count, with special emphasis on CROSS-ORIGIN requests, which should
 * always be zero. This is observable proof to complement the strict CSP.
 *
 * Note: this is a transparency aid, not the security boundary itself — the
 * CSP (`connect-src 'self'`) is what actually prevents exfiltration. A clever
 * attacker could bypass JS instrumentation, but they could not bypass the CSP.
 */

export interface NetworkRecord {
  id: number
  time: number
  kind: 'fetch' | 'xhr' | 'websocket' | 'beacon'
  method: string
  url: string
  crossOrigin: boolean
}

const records: NetworkRecord[] = []
const listeners = new Set<() => void>()
// A cached, referentially-stable snapshot for useSyncExternalStore. It only
// changes identity when a new record arrives, which prevents render loops.
let snapshot: NetworkRecord[] = []
let nextId = 1
let installed = false

function resolveUrl(input: string): string {
  try {
    return new URL(input, location.href).href
  } catch {
    return input
  }
}

function isCrossOrigin(url: string): boolean {
  try {
    return new URL(url, location.href).origin !== location.origin
  } catch {
    return true
  }
}

function record(kind: NetworkRecord['kind'], method: string, rawUrl: string) {
  const url = resolveUrl(rawUrl)
  const entry: NetworkRecord = {
    id: nextId++,
    time: Date.now(),
    kind,
    method: method.toUpperCase(),
    url,
    crossOrigin: isCrossOrigin(url),
  }
  records.push(entry)
  snapshot = records.slice()
  for (const l of listeners) l()
  if (entry.crossOrigin && import.meta.env.DEV) {
    // Surfacing this loudly in dev helps us catch accidental data leaks early.
    console.warn('[networkMonitor] cross-origin request detected:', entry)
  }
}

/** Install the wrappers. Idempotent; call once before the app renders. */
export function installNetworkMonitor(): void {
  if (installed || typeof window === 'undefined') return
  installed = true

  const originalFetch = window.fetch.bind(window)
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : input.url
    record('fetch', init?.method ?? 'GET', url)
    return originalFetch(input, init)
  }

  const OriginalXHR = window.XMLHttpRequest
  class MonitoredXHR extends OriginalXHR {
    private _method = 'GET'
    private _url = ''
    open(
      method: string,
      url: string | URL,
      async = true,
      username?: string | null,
      password?: string | null,
    ): void {
      this._method = method
      this._url = typeof url === 'string' ? url : url.href
      super.open(method, url, async, username, password)
    }
    send(body?: Document | XMLHttpRequestBodyInit | null): void {
      record('xhr', this._method, this._url)
      super.send(body)
    }
  }
  window.XMLHttpRequest = MonitoredXHR as unknown as typeof XMLHttpRequest

  if ('WebSocket' in window) {
    const OriginalWS = window.WebSocket
    class MonitoredWS extends OriginalWS {
      constructor(url: string | URL, protocols?: string | string[]) {
        record('websocket', 'WS', typeof url === 'string' ? url : url.href)
        super(url, protocols)
      }
    }
    window.WebSocket = MonitoredWS as unknown as typeof WebSocket
  }

  if (navigator.sendBeacon) {
    const originalBeacon = navigator.sendBeacon.bind(navigator)
    navigator.sendBeacon = (url: string | URL, data?: BodyInit | null) => {
      record('beacon', 'POST', typeof url === 'string' ? url : url.href)
      return originalBeacon(url, data)
    }
  }
}

/** Stable snapshot getter for useSyncExternalStore. */
export function getNetworkSnapshot(): NetworkRecord[] {
  return snapshot
}

/** Stable subscribe function for useSyncExternalStore. */
export function subscribeNetwork(onChange: () => void): () => void {
  listeners.add(onChange)
  return () => {
    listeners.delete(onChange)
  }
}
