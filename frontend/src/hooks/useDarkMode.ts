import { useState, useEffect } from 'react'
const STORAGE_KEY = 'gm-theme'
function getInitialDark(): boolean {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'dark') return true
    if (stored === 'light') return false
  } catch {
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

;(function applyThemeBeforeRender() {
  if (getInitialDark()) {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }
})()

export function useDarkMode() {
  const [isDark, setIsDark] = useState<boolean>(getInitialDark)

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark')
      try { localStorage.setItem(STORAGE_KEY, 'dark') } catch { /* */ }
    } else {
      document.documentElement.classList.remove('dark')
      try { localStorage.setItem(STORAGE_KEY, 'light') } catch { /* */ }
    }
  }, [isDark])

  const toggle = () => setIsDark(v => !v)

  return { isDark, toggle }
}
