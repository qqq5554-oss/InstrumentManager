// Supabase Edge Function: send-push
// 發送 Web Push 通知給已訂閱的裝置。
//
// 需要的 Secrets（Edge Functions → Secrets）：
//   VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT(選填)
//
// 呼叫方式（POST JSON）：
//   { "title": "標題", "body": "內容", "url": "/InstrumentManager/", "employeeIds": ["uuid", ...] }

import webpush from 'npm:web-push@3.6.7'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  // CORS 預檢
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors })
  }

  const json = (obj: unknown, status = 200) =>
    new Response(JSON.stringify(obj), {
      status,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })

  try {
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
    if (error) return json({ error: error.message }, 500)

    const message = JSON.stringify({
      title: payloadIn.title || '大群儀器管理',
      body: payloadIn.body || '',
      url: payloadIn.url || '/InstrumentManager/',
      tag: payloadIn.tag,
    })

    let sent = 0
    let removed = 0
    const errors: string[] = []
    for (const s of subs ?? []) {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          message,
        )
        sent++
      } catch (e) {
        const status = (e as { statusCode?: number })?.statusCode
        if (status === 410 || status === 404) {
          await supabase.from('push_subscriptions').delete().eq('endpoint', s.endpoint)
          removed++
        } else {
          errors.push(String((e as Error)?.message || e))
        }
      }
    }

    return json({ sent, removed, total: subs?.length ?? 0, errors })
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500)
  }
})
