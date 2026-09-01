import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

// 點推播通知時，若 App 已開著，Service Worker 會 postMessage 過來 → 切換到指定頁面
export function usePushNavigation() {
  const navigate = useNavigate()
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'navigate' && typeof e.data.url === 'string') {
        const hashIdx = e.data.url.indexOf('#')
        const route = hashIdx >= 0 ? e.data.url.slice(hashIdx + 1) : '/'
        navigate(route || '/')
      }
    }
    navigator.serviceWorker.addEventListener('message', handler)
    return () => navigator.serviceWorker.removeEventListener('message', handler)
  }, [navigate])
}
