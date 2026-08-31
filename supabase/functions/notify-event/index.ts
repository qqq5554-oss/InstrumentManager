// Supabase Edge Function: notify-event
// 依「通知管理」設定的規則發送 Web Push。
//
// 兩種呼叫模式：
//   前端事件： { "event_key": "malfunction", "employeeIds": ["uuid"], "vars": { "instrument": "..." , "borrower": "..." } }
//   每日排程： { "scan": true }  → 掃描 reservation_conflict 與 overdue
//
// 需要 Secrets：VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT(選填)

import webpush from 'npm:web-push@3.6.7'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const json = (obj: unknown, status = 200) =>
    new Response(JSON.stringify(obj), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

  try {
    webpush.setVapidDetails(
      Deno.env.get('VAPID_SUBJECT') || 'mailto:admin@example.com',
      Deno.env.get('VAPID_PUBLIC_KEY')!,
      Deno.env.get('VAPID_PRIVATE_KEY')!,
    )
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    const body = await req.json().catch(() => ({})) as {
      event_key?: string
      employeeIds?: string[]
      vars?: { instrument?: string; borrower?: string; reserver?: string }
      scan?: boolean
    }

    const { data: settingRows } = await supabase.from('notification_settings').select('*')
    const settings: Record<string, { enabled: boolean; audience: string; title: string; body: string }> = {}
    for (const r of settingRows ?? []) settings[r.event_key] = r

    const interp = (t: string, vars?: { instrument?: string; borrower?: string; reserver?: string }) =>
      (t || '')
        .replace(/\{instrument\}/g, vars?.instrument ?? '')
        .replace(/\{borrower\}/g, vars?.borrower ?? '')
        .replace(/\{reserver\}/g, vars?.reserver ?? '')

    async function adminIds(): Promise<string[]> {
      const { data } = await supabase.from('employees').select('id').eq('role', 'admin')
      return (data ?? []).map((e: { id: string }) => e.id)
    }

    async function fire(eventKey: string, targetEmployeeIds?: string[], vars?: { instrument?: string; borrower?: string }) {
      const s = settings[eventKey]
      if (!s || !s.enabled) return { event: eventKey, skipped: 'disabled' }

      let q = supabase.from('push_subscriptions').select('*')
      if (s.audience === 'admins') {
        const ids = await adminIds()
        if (ids.length === 0) return { event: eventKey, sent: 0 }
        q = q.in('employee_id', ids)
      } else if (s.audience === 'borrower') {
        const ids = (targetEmployeeIds ?? []).filter(Boolean)
        if (ids.length === 0) return { event: eventKey, sent: 0, note: 'no target' }
        q = q.in('employee_id', ids)
      } // 'all' → 不過濾

      const { data: subs } = await q
      const message = JSON.stringify({
        title: interp(s.title, vars) || '大群儀器管理',
        body: interp(s.body, vars),
        url: '/InstrumentManager/',
      })

      let sent = 0, removed = 0
      for (const sub of subs ?? []) {
        try {
          await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, message)
          sent++
        } catch (e) {
          const st = (e as { statusCode?: number })?.statusCode
          if (st === 410 || st === 404) {
            await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
            removed++
          }
        }
      }
      return { event: eventKey, sent, removed, total: subs?.length ?? 0 }
    }

    // ── 每日排程掃描 ──
    if (body.scan) {
      const results = []
      const today = new Date().toISOString().split('T')[0]

      // 預約衝突：明天有人預約、但該儀器目前仍有人借用未還 → 通知目前借用人
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      const tomorrowStr = tomorrow.toISOString().split('T')[0]
      const { data: resv } = await supabase.from('loans')
        .select('instrument_id').eq('status', 'reserved').eq('borrow_date', tomorrowStr)
      const conflictIds = new Set<string>()
      for (const r of resv ?? []) {
        const { data: active } = await supabase.from('loans')
          .select('employee_id').eq('instrument_id', r.instrument_id)
          .eq('status', 'borrowed').is('actual_return_date', null).limit(1).maybeSingle()
        if (active?.employee_id) conflictIds.add(active.employee_id)
      }
      if (conflictIds.size > 0) results.push(await fire('reservation_conflict', [...conflictIds]))

      // 逾期未還：已借出、未還、超過預計歸還日 → 通知借用人
      const { data: overdue } = await supabase.from('loans')
        .select('employee_id').eq('status', 'borrowed').is('actual_return_date', null).lt('expected_return_date', today)
      const overdueIds = [...new Set((overdue ?? []).map((l: { employee_id: string | null }) => l.employee_id).filter(Boolean))] as string[]
      if (overdueIds.length > 0) results.push(await fire('overdue', overdueIds))

      return json({ scan: true, results })
    }

    // ── 前端單一事件 ──
    if (body.event_key) {
      return json(await fire(body.event_key, body.employeeIds, body.vars))
    }

    return json({ error: 'no event_key or scan' }, 400)
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500)
  }
})
