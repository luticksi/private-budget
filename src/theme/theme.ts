// Theme handling, kept deliberately tiny and dependency-free so it can run
// before React mounts (see main.tsx) to avoid a flash of the wrong theme.
//
// Note: the production CSP is `script-src 'self'`, so we cannot use the usual
// inline <script> in index.html to set the theme pre-paint. Instead the very
// first thing the app bundle does is call initTheme(); that runs early enough
// that the React tree never paints with the wrong colors.

export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'pb-theme'

/** The user's saved choice, or null if they haven't picked one yet. */
export function getStoredTheme(): Theme | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v === 'light' || v === 'dark') return v
  } catch {
    // localStorage can throw (e.g. privacy modes); treat as no stored choice.
  }
  return null
}

export function storeTheme(theme: Theme): void {
  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    // Persistence is best-effort; the in-memory choice still applies this session.
  }
}

export function systemPrefersDark(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  )
}

/**
 * The theme to start with: the saved choice if there is one, otherwise default
 * to whatever the operating system is set to.
 */
export function getInitialTheme(): Theme {
  return getStoredTheme() ?? (systemPrefersDark() ? 'dark' : 'light')
}

/**
 * Reflect the theme onto <html>: toggle the `dark` class (which our Tailwind
 * `dark:` variant keys off) and set `color-scheme` so native form controls,
 * scrollbars and the like render in the matching mode too.
 */
export function applyTheme(theme: Theme): void {
  const root = document.documentElement
  root.classList.toggle('dark', theme === 'dark')
  root.style.colorScheme = theme
}

/** Apply the starting theme once at startup, before React renders. */
export function initTheme(): void {
  applyTheme(getInitialTheme())
}
