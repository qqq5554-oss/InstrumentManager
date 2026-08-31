import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './context/AuthContext.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </HashRouter>
  </StrictMode>,
)

// 註冊 Service Worker（供 Web Push 通知使用；不影響既有版本更新機制）
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const raw = import.meta.env.BASE_URL || '/'
    const base = raw.endsWith('/') ? raw : raw + '/'
    navigator.serviceWorker.register(`${base}sw.js`, { scope: base }).catch(() => {
      /* SW 註冊失敗不影響主功能 */
    })
  })
}
