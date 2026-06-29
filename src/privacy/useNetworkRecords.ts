import { useSyncExternalStore } from 'react'
import { getNetworkSnapshot, subscribeNetwork, type NetworkRecord } from './networkMonitor'

/** Live view of every outbound request the app has made this session. */
export function useNetworkRecords(): NetworkRecord[] {
  // Both arguments are stable module-level functions, and the snapshot only
  // changes identity when a new request is recorded — no render loops.
  return useSyncExternalStore(subscribeNetwork, getNetworkSnapshot)
}
