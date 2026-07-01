import { useEffect } from 'react'

export function useVersionCheck() {
  useEffect(() => {
    const current = __APP_VERSION__

    const check = async () => {
      try {
        const base = import.meta.env.BASE_URL
        const res = await fetch(`${base}version.json?_=${Date.now()}`)
        if (!res.ok) return
        const { v } = await res.json()
        if (v && v !== current) window.location.reload()
      } catch { /* ignore network errors */ }
    }

    const onVisible = () => { if (document.visibilityState === 'visible') check() }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])
}
