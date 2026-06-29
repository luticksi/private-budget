import { Link } from 'react-router-dom'
import { useNetworkRecords } from './useNetworkRecords'

/** Compact header badge: green when no data has left the device. */
export function NetworkBadge() {
  const records = useNetworkRecords()
  const crossOrigin = records.filter((r) => r.crossOrigin).length

  return (
    <Link
      to="/privacy"
      className={`flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${
        crossOrigin === 0
          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
          : 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300'
      }`}
      title="Cross-origin requests this session (should always be 0)"
    >
      <span
        className={`h-2 w-2 rounded-full ${
          crossOrigin === 0 ? 'bg-emerald-500' : 'bg-red-500'
        }`}
      />
      {crossOrigin === 0
        ? 'No data has left this device'
        : `${crossOrigin} cross-origin request(s)`}
    </Link>
  )
}
