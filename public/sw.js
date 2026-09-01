// Service Worker for Web Push notifications
// 這個 SW 只處理推播通知，不做離線快取（避免干擾既有的版本更新機制）

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('push', event => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch (e) {
    data = { body: event.data ? event.data.text() : '' }
  }

  const title = data.title || '大群儀器管理'
  const options = {
    body: data.body || '',
    icon: '/InstrumentManager/logo_180x180.png',
    badge: '/InstrumentManager/logo_180x180.png',
    tag: data.tag || undefined,
    data: { url: data.url || '/InstrumentManager/' },
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const targetUrl = (event.notification.data && event.notification.data.url) || '/InstrumentManager/'

  event.waitUntil((async () => {
    const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    // App 已開著 → 聚焦並通知它切換頁面
    for (const client of clientList) {
      if ('focus' in client) {
        await client.focus()
        client.postMessage({ type: 'navigate', url: targetUrl })
        return
      }
    }
    // App 沒開 → 直接開到指定頁
    if (self.clients.openWindow) return self.clients.openWindow(targetUrl)
  })())
})
