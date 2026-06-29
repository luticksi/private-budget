import React from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { installNetworkMonitor } from './privacy/networkMonitor'
import { ensureSeeded } from './db/seed'
import { ensureRulesSeeded } from './categorize/starterDictionary'
import { ensureProfilesSeeded } from './import/profiles'
import { requestPersistentStorage } from './storage/persist'
import { initTheme } from './theme/theme'
import { ThemeProvider } from './theme/ThemeProvider'
import { router } from './router'
import './index.css'

// Apply the saved (or system) theme before the first paint. The strict CSP
// (`script-src 'self'`) rules out an inline <script>, so this runs here as the
// first thing the bundle does, which is early enough to avoid a theme flash.
initTheme()

// Install the network monitor before anything else runs so it can observe
// every outbound request the app makes.
installNetworkMonitor()

// Ask the browser to keep our data and not auto-evict it under disk pressure.
void requestPersistentStorage()

// Seed default categories, then the built-in rules and import profiles (idempotent).
void ensureSeeded().then(ensureRulesSeeded).then(ensureProfilesSeeded)

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <RouterProvider router={router} />
    </ThemeProvider>
  </React.StrictMode>,
)
