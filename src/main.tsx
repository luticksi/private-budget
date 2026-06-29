import React from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { installNetworkMonitor } from './privacy/networkMonitor'
import { ensureSeeded } from './db/seed'
import { ensureRulesSeeded } from './categorize/starterDictionary'
import { requestPersistentStorage } from './storage/persist'
import { router } from './router'
import './index.css'

// Install the network monitor before anything else runs so it can observe
// every outbound request the app makes.
installNetworkMonitor()

// Ask the browser to keep our data and not auto-evict it under disk pressure.
void requestPersistentStorage()

// Seed default categories, then the built-in rules (idempotent).
void ensureSeeded().then(ensureRulesSeeded)

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
)
