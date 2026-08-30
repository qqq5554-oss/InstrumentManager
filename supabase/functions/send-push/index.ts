// Supabase Edge Function: send-push
// 發送 Web Push 通知給已訂閱的裝置。
// 請在 Supabase Dashboard → Edge Functions 建立名為 send-push 的函式並貼上此內容。
//
// 需要的 Secrets（Edge Functions → Secrets）：
//   VAPID_PUBLIC_KEY   （與前端 VITE_VAPID_PUBLIC_KEY 相同）
//   VAPID_PRIVATE_KEY
//   VAPID_SUBJECT      （選填，預設 mailto:admin@example.com）
//   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 為系統內建，不需自行設定
//
// 呼叫方式（POST JSON）：
//   { "title": "標題", "body": "內容", "url": "/InstrumentManager/", "employeeIds": ["uuid", ...] }
//   - employeeIds 省略 = 發送給所有已訂閱裝置

import webpush from 'npm:web-push@3.6.7'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req) => {
  let payloadIn: {
    title?: string
    body?: string
    url?: string
    tag?: string
    employeeIds?: string[]
  } = {}
  try {
    payloadIn = await req.json()
  } catch {
    payloadIn = {}
  }

  webpush.setVapidDetails(
    Deno.env.get('VAPID_SUBJECT') || 'mailto:admin@example.com',
    Deno.env.get('VAPID_PUBLIC_KEY')!,
    Deno.env.get('VAPID_PRIVATE_KEY')!,
  )

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  let query = supabase.from('push_subscriptions').select('*')
  if (Array.isArray(payloadIn.employeeIds) && payloadIn.employeeIds.length > 0) {
    query = query.in('employee_id', payloadIn.employeeIds)
  }
  const { data: subs, error } = await query
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }

  const message = JSON.stringify({
    title: payloadIn.title || '大群儀器管理',
    body: payloadIn.body || '',
    url: payloadIn.url || '/InstrumentManager/',
    tag: payloadIn.tag,
  })

  let sent = 0
  let removed = 0
  for (const s of subs ?? []) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        message,
      )
      sent++
    } catch (e) {
      const status = (e as { statusCode?: number })?.statusCode
      // 410 Gone / 404 Not Found = 訂閱已失效，刪除
      if (status === 410 || status === 404) {
        await supabase.from('push_subscriptions').delete().eq('endpoint', s.endpoint)
        removed++
      }
    }
  }

  return new Response(
    JSON.stringify({ sent, removed, total: subs?.length ?? 0 }),
    { headers: { 'Content-Type': 'application/json' } },
  )
})
