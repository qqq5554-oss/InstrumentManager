// Supabase Edge Function: notify-event
// 依「通知管理」設定的規則，分別發送 App 推播（enabled）與 LINE 群組通知（line_enabled）。
//
// 呼叫模式：
//   前端事件： { "event_key": "malfunction", "employeeIds": ["uuid"], "vars": {...} }
//   試發（只給自己）： { "event_key": "...", "onlyEmployeeIds": ["uuid"], "title": "...", "body": "...", "vars": {...} }
//   每日排程： { "scan": true }
//
// Secrets：VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT(選填)
//          LINE_CHANNEL_ACCESS_TOKEN / LINE_GROUP_ID（LINE 通知用）

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
      onlyEmployeeIds?: string[]
      title?: string
      body?: string
      vars?: Record<string, string>
      scan?: boolean
    }

    const { data: settingRows } = await supabase.from('notification_settings').select('*')
    const settings: Record<string, { enabled: boolean; line_enabled: boolean; audience: string; title: string; body: string }> = {}
    for (const r of settingRows ?? []) settings[r.event_key] = r

    const interp = (t: string, vars?: Record<string, string>) =>
      (t || '')
        .replace(/\{instrument\}/g, vars?.instrument ?? '')
        .replace(/\{borrower\}/g, vars?.borrower ?? '')
        .replace(/\{reserver\}/g, vars?.reserver ?? '')
        .replace(/\{description\}/g, vars?.description ?? '')

    const msg = (title: string, bd: string) =>
      JSON.stringify({ title: title || '大群儀器管理', body: bd, url: '/InstrumentManager/' })

    async function adminIds(): Promise<string[]> {
      const { data } = await supabase.from('employees').select('id').eq('role', 'admin')
      return (data ?? []).map((e: { id: string }) => e.id)
    }

    async function resolveSubs(audience: string, targetIds?: string[]) {
      let q = supabase.from('push_subscriptions').select('*')
      if (audience === 'admins') {
        const ids = await adminIds()
        if (ids.length === 0) return []
        q = q.in('employee_id', ids)
      } else if (audience === 'borrower') {
        const ids = (targetIds ?? []).filter(Boolean)
        if (ids.length === 0) return []
        q = q.in('employee_id', ids)
      }
      const { data } = await q
      return data ?? []
    }

    async function pushTo(subs: { endpoint: string; p256dh: string; auth: string }[], message: string) {
      let sent = 0, removed = 0
      for (const sub of subs) {
        try {
          await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, message)
          sent++
        } catch (e) {
          const st = (e as { statusCode?: number })?.statusCode
          if (st === 410 || st === 404) { await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint); removed++ }
        }
      }
      return { sent, removed, total: subs.length }
    }

    async function sendLine(text: string) {
      const token = Deno.env.get('LINE_CHANNEL_ACCESS_TOKEN')
      const group = Deno.env.get('LINE_GROUP_ID')
      if (!token || !group) return 'no config'
      const res = await fetch('https://api.line.me/v2/bot/message/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ to: group, messages: [{ type: 'text', text }] }),
      })
      return res.ok ? 'sent' : `err ${res.status}`
    }

    // App 推播（依 enabled + audience）
    async function firePush(eventKey: string, targetIds: string[] | undefined, vars?: Record<string, string>) {
      const s = settings[eventKey]
      if (!s || !s.enabled) return { event: eventKey, skipped: 'push off' }
      const subs = await resolveSubs(s.audience, targetIds)
      const r = await pushTo(subs, msg(interp(s.title, vars), interp(s.body, vars)))
      return { event: eventKey, ...r }
    }

    // ── 每日排程掃描 ──
    if (body.scan) {
      const results: unknown[] = []
      const today = new Date().toISOString().split('T')[0]
      const nameOf = (row: { instruments?: { name: string } | { name: string }[] | null }) => {
        const i = row?.instruments
        return Array.isArray(i) ? (i[0]?.name ?? '') : (i?.name ?? '')
      }

      // 逾期未還
      const ov = settings['overdue']
      if (ov && (ov.enabled || ov.line_enabled)) {
        const { data: overdue } = await supabase.from('loans')
          .select('employee_id, borrower_name, instruments(name)')
          .eq('status', 'borrowed').is('actual_return_date', null).lt('expected_return_date', today)
        if (overdue && overdue.length > 0) {
          const byEmp: Record<string, { name: string; instruments: string[] }> = {}
          const allNames: string[] = []
          const allBorrowers = new Set<string>()
          for (const l of overdue) {
            const nm = nameOf(l)
            if (nm) allNames.push(nm)
            if (l.borrower_name) allBorrowers.add(l.borrower_name)
            if (l.employee_id) {
              (byEmp[l.employee_id] ??= { name: l.borrower_name ?? '', instruments: [] }).instruments.push(nm)
            }
          }
          const allV = { instrument: [...new Set(allNames)].join('、'), borrower: [...allBorrowers].join('、') }
          if (ov.enabled) {
            if (ov.audience === 'borrower') {
              for (const empId of Object.keys(byEmp)) {
                const g = byEmp[empId]
                results.push(await firePush('overdue', [empId], { instrument: g.instruments.filter(Boolean).join('、'), borrower: g.name }))
              }
            } else {
              const subs = await resolveSubs(ov.audience, undefined)
              results.push({ event: 'overdue', ...(await pushTo(subs, msg(interp(ov.title, allV), interp(ov.body, allV)))) })
            }
          }
          if (ov.line_enabled) {
            results.push({ event: 'overdue', line: await sendLine(`${interp(ov.title, allV)}\n${interp(ov.body, allV)}`) })
          }
        }
      }

      // 預約衝突
      const rc = settings['reservation_conflict']
      if (rc && (rc.enabled || rc.line_enabled)) {
        const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1)
        const tomorrowStr = tomorrow.toISOString().split('T')[0]
        const { data: resv } = await supabase.from('loans')
          .select('instrument_id, borrower_name').eq('status', 'reserved').eq('borrow_date', tomorrowStr)
        const byEmp: Record<string, { name: string; instruments: string[]; reservers: string[] }> = {}
        const allNames: string[] = []
        const allBorrowers = new Set<string>()
        const allReservers = new Set<string>()
        for (const r of resv ?? []) {
          const { data: active } = await supabase.from('loans')
            .select('employee_id, borrower_name, instruments(name)').eq('instrument_id', r.instrument_id)
            .eq('status', 'borrowed').is('actual_return_date', null).limit(1).maybeSingle()
          if (active?.employee_id) {
            const nm = nameOf(active)
            if (nm) allNames.push(nm)
            if (active.borrower_name) allBorrowers.add(active.borrower_name)
            if (r.borrower_name) allReservers.add(r.borrower_name)
            const g = (byEmp[active.employee_id] ??= { name: active.borrower_name ?? '', instruments: [], reservers: [] })
            g.instruments.push(nm)
            if (r.borrower_name) g.reservers.push(r.borrower_name)
          }
        }
        if (Object.keys(byEmp).length > 0) {
          const allV = { instrument: [...new Set(allNames)].join('、'), borrower: [...allBorrowers].join('、'), reserver: [...allReservers].join('、') }
          if (rc.enabled) {
            if (rc.audience === 'borrower') {
              for (const empId of Object.keys(byEmp)) {
                const g = byEmp[empId]
                results.push(await firePush('reservation_conflict', [empId], { instrument: g.instruments.filter(Boolean).join('、'), borrower: g.name, reserver: [...new Set(g.reservers)].join('、') }))
              }
            } else {
              const subs = await resolveSubs(rc.audience, undefined)
              results.push({ event: 'reservation_conflict', ...(await pushTo(subs, msg(interp(rc.title, allV), interp(rc.body, allV)))) })
            }
          }
          if (rc.line_enabled) {
            results.push({ event: 'reservation_conflict', line: await sendLine(`${interp(rc.title, allV)}\n${interp(rc.body, allV)}`) })
          }
        }
      }

      return json({ scan: true, results })
    }

    // ── 前端事件 / 試發 ──
    if (body.event_key) {
      const s = settings[body.event_key]

      // 試發：只發 App 推播到指定的人（自己），不發 LINE
      if (Array.isArray(body.onlyEmployeeIds)) {
        const title = interp(body.title ?? s?.title ?? '', body.vars)
        const bd = interp(body.body ?? s?.body ?? '', body.vars)
        const subs = await resolveSubs('borrower', body.onlyEmployeeIds)
        const r = await pushTo(subs, msg(title, bd))
        return json({ test: true, ...r })
      }

      const push = await firePush(body.event_key, body.employeeIds, body.vars)
      let line: string | null = null
      if (s?.line_enabled) line = await sendLine(`${interp(s.title, body.vars)}\n${interp(s.body, body.vars)}`)
      return json({ push, line })
    }

    return json({ error: 'no event_key or scan' }, 400)
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500)
  }
})
