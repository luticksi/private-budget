/**
 * Storage durability helpers.
 *
 * IndexedDB is normally "best-effort" storage that a browser may evict when
 * disk space runs low. Requesting *persistent* storage asks the browser not to
 * evict our data automatically. This does NOT protect against a user manually
 * clearing site data — which is why regular backups (Settings) still matter.
 */

export async function requestPersistentStorage(): Promise<boolean> {
  if (!navigator.storage?.persist) return false
  if (await navigator.storage.persisted()) return true
  try {
    return await navigator.storage.persist()
  } catch {
    return false
  }
}

export async function isStoragePersisted(): Promise<boolean> {
  try {
    return (await navigator.storage?.persisted?.()) ?? false
  } catch {
    return false
  }
}

/**
 * `StorageManager.estimate().usage` reports usage for the *entire origin*: our
 * IndexedDB data plus the service worker's Cache Storage (the PWA precache of
 * all app assets) plus browser-added padding to defeat storage fingerprinting.
 * For a small dataset the cache + padding dwarf the actual data, so `usage`
 * badly overstates "your data on this device".
 *
 * Chromium exposes a per-store breakdown in the non-standard `usageDetails`;
 * we surface `usageDetails.indexedDB` as the data figure when available and
 * fall back to the whole-origin `usage` otherwise.
 */
export async function getStorageEstimate(): Promise<{
  usage: number
  quota: number
  dataUsage: number
} | null> {
  if (!navigator.storage?.estimate) return null
  try {
    const e = await navigator.storage.estimate()
    const usage = e.usage ?? 0
    const details = (e as StorageEstimate & { usageDetails?: { indexedDB?: number } })
      .usageDetails
    return {
      usage,
      quota: e.quota ?? 0,
      dataUsage: details?.indexedDB ?? usage,
    }
  } catch {
    return null
  }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB']
  let value = bytes / 1024
  let i = 0
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024
    i++
  }
  return `${value.toFixed(1)} ${units[i]}`
}
