import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import type { Employee } from '../types'

type Audience = 'borrower' | 'admins' | 'all'

interface Setting {
  event_key: string
  enabled: boolean       // 一般通知（Web Push）
  line_enabled: boolean  // LINE 通知
  audience: Audience
  title: string
  body: string
}

const EVENTS: { key: string; label: string; desc: string }[] = [
  { key: 'reservation_conflict', label: '預約衝突提醒', desc: '明日有人預約的儀器，前一個人還沒歸還' },
  { key: 'overdue', label: '儀器逾期未還', desc: '借用已超過預計歸還日' },
  { key: 'malfunction', label: '儀器異常回報', desc: '有人回報儀器異常、轉為維修中' },
  { key: 'reserved_for_you', label: '有人預約你的儀器', desc: '你正借用中的儀器被別人預約' },
]

const AUDIENCE_OPTIONS: { value: Audience; label: string }[] = [
  { value: 'borrower', label: '相關借用人' },
  { value: 'admins', label: '所有管理員' },
  { value: 'all', label: '所有已訂閱者' },
]

// 每個事件實際能帶入的變數（只列可用的，避免用到空白變數）
const EVENT_VARS: Record<string, { token: string; label: string }[]> = {
  reservation_conflict: [{ token: '{instrument}', label: '儀器名' }, { token: '{borrower}', label: '借用人' }, { token: '{reserver}', label: '預約人' }],
  overdue: [{ token: '{instrument}', label: '儀器名' }, { token: '{borrower}', label: '借用人' }],
  malfunction: [{ token: '{instrument}', label: '儀器名' }, { token: '{borrower}', label: '回報人' }, { token: '{description}', label: '問題描述' }],
  reserved_for_you: [{ token: '{instrument}', label: '儀器名' }, { token: '{borrower}', label: '借用人' }, { token: '{reserver}', label: '預約人' }],
}

// 預覽 / 試發用的範例資料
const SAMPLE = { instrument: '三用電錶', reserver: '王小明', borrower: '李大華', description: '螢幕無法顯示' }

const interp = (t: string, vars: Record<string, string>) =>
  (t || '')
    .replace(/\{instrument\}/g, vars.instrument ?? '')
    .replace(/\{borrower\}/g, vars.borrower ?? '')
    .replace(/\{reserver\}/g, vars.reserver ?? '')
    .replace(/\{description\}/g, vars.description ?? '')

const DEFAULTS: Record<string, Omit<Setting, 'event_key'>> = {
  reservation_conflict: { enabled: true, line_enabled: true, audience: 'borrower', title: '儀器歸還提醒', body: '你借用中的儀器「{instrument}」明天有人預約，請於今日下班前歸還，謝謝配合！' },
  overdue: { enabled: true, line_enabled: false, audience: 'borrower', title: '儀器逾期未還', body: '你借用的儀器「{instrument}」已逾期，請盡快歸還，謝謝！' },
  malfunction: { enabled: true, line_enabled: true, audience: 'admins', title: '儀器異常回報', body: '{borrower} 回報儀器「{instrument}」異常，已轉為維修中，請確認處理。' },
  reserved_for_you: { enabled: true, line_enabled: false, audience: 'borrower', title: '儀器已被預約', body: '你正借用中的儀器「{instrument}」已有人預約（{reserver} 預約），請留意歸還時間或提前協調使用。' },
}

export default function NotificationsTab() {
  const { currentUser } = useAuth()
  const [settings, setSettings] = useState<Record<string, Setting>>({})
  const [employees, setEmployees] = useState<Employee[]>([])
  const [subCounts, setSubCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [testingKey, setTestingKey] = useState<string | null>(null)

  const fetchAll = async () => {
    const [{ data: settingRows }, { data: emps }, { data: subs }] = await Promise.all([
      supabase.from('notification_settings').select('*'),
      supabase.from('employees').select('*').order('role').order('name'),
      supabase.from('push_subscriptions').select('employee_id'),
    ])

    const map: Record<string, Setting> = {}
    for (const ev of EVENTS) {
      const row = settingRows?.find(r => r.event_key === ev.key)
      map[ev.key] = row
        ? { event_key: ev.key, enabled: row.enabled, line_enabled: row.line_enabled ?? false, audience: row.audience, title: row.title, body: row.body }
        : { event_key: ev.key, ...DEFAULTS[ev.key] }
    }
    setSettings(map)
    if (emps) setEmployees(emps)

    const counts: Record<string, number> = {}
    for (const s of subs ?? []) {
      if (s.employee_id) counts[s.employee_id] = (counts[s.employee_id] ?? 0) + 1
    }
    setSubCounts(counts)
    setLoading(false)
  }

  useEffect(() => { fetchAll() }, [])

  const update = (key: string, patch: Partial<Setting>) => {
    setSettings(prev => ({ ...prev, [key]: { ...prev[key], ...patch } }))
  }

  const bodyRefs = useRef<Record<string, HTMLTextAreaElement | null>>({})
  const insertVar = (key: string, token: string) => {
    const ta = bodyRefs.current[key]
    const cur = settings[key].body
    if (!ta) { update(key, { body: cur + token }); return }
    const start = ta.selectionStart ?? cur.length
    const end = ta.selectionEnd ?? cur.length
    const next = cur.slice(0, start) + token + cur.slice(end)
    update(key, { body: next })
    requestAnimationFrame(() => {
      ta.focus()
      const pos = start + token.length
      ta.setSelectionRange(pos, pos)
    })
  }

  const save = async (key: string) => {
    setSavingKey(key)
    const s = settings[key]
    await supabase.from('notification_settings').upsert(
      { event_key: s.event_key, enabled: s.enabled, line_enabled: s.line_enabled, audience: s.audience, title: s.title, body: s.body, updated_at: new Date().toISOString() },
      { onConflict: 'event_key' },
    )
    setSavingKey(null)
  }

  const test = async (key: string) => {
    if (!currentUser) return
    setTestingKey(key)
    const s = settings[key]
    try {
      const { data, error } = await supabase.functions.invoke('notify-event', {
        body: {
          event_key: key,
          onlyEmployeeIds: [currentUser.id],
          title: s.title,
          body: s.body,
          vars: SAMPLE,
        },
      })
      if (error) alert('試發失敗：' + error.message)
      else alert('試發結果：' + JSON.stringify(data) + '\n（只發到你自己的裝置）')
    } catch (e) {
      alert('試發失敗：' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setTestingKey(null)
    }
  }

  if (loading) return <div className="text-center py-20 text-gray-400">載入中...</div>

  const enabledCount = Object.keys(subCounts).length

  const Toggle = ({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) => (
    <label className="flex items-center gap-1.5 cursor-pointer select-none">
      <input type="checkbox" checked={on} onChange={e => onChange(e.target.checked)} className="w-4 h-4 accent-blue-600" />
      <span className={`text-xs font-medium ${on ? 'text-blue-600' : 'text-gray-400'}`}>{label}</span>
    </label>
  )

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-lg font-bold text-gray-900 mb-1">通知規則</h2>
        <p className="text-xs text-gray-400 mb-4">每個情況可分別開關「一般通知（App 推播）」與「LINE 通知」，並設定對象與內容。</p>
        <div className="space-y-3">
          {EVENTS.map(ev => {
            const s = settings[ev.key]
            const previewTitle = interp(s.title, SAMPLE)
            const previewBody = interp(s.body, SAMPLE)
            return (
              <div key={ev.key} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">{ev.label}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{ev.desc}</p>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <Toggle on={s.enabled} onChange={v => update(ev.key, { enabled: v })} label="一般通知" />
                    <Toggle on={s.line_enabled} onChange={v => update(ev.key, { line_enabled: v })} label="LINE 通知" />
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">通知對象（App 推播）</label>
                    <select
                      value={s.audience}
                      onChange={e => update(ev.key, { audience: e.target.value as Audience })}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
                    >
                      {AUDIENCE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">標題</label>
                    <input
                      type="text"
                      value={s.title}
                      onChange={e => update(ev.key, { title: e.target.value })}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="mt-3">
                  <label className="block text-xs text-gray-500 mb-1">內容</label>
                  <textarea
                    ref={el => { bodyRefs.current[ev.key] = el }}
                    value={s.body}
                    onChange={e => update(ev.key, { body: e.target.value })}
                    rows={2}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 resize-none"
                  />
                  <div className="flex items-center flex-wrap gap-1.5 mt-2">
                    <span className="text-xs text-gray-400">點擊插入變數：</span>
                    {(EVENT_VARS[ev.key] ?? []).map(v => (
                      <button key={v.token} type="button" onClick={() => insertVar(ev.key, v.token)}
                        className="text-xs px-2 py-0.5 rounded-full border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
                        title={`插入 ${v.token}`}>
                        {v.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 即時預覽 */}
                <div className="mt-3">
                  <label className="block text-xs text-gray-500 mb-1">預覽（範例資料）</label>
                  <div className="flex items-start gap-2.5 bg-gray-50 border border-gray-200 rounded-lg p-2.5">
                    <img src="/InstrumentManager/logo_180x180.png" alt="" className="w-8 h-8 rounded shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900">{previewTitle || '（無標題）'}</p>
                      <p className="text-xs text-gray-600 mt-0.5 whitespace-pre-line">{previewBody || '（無內容）'}</p>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end items-center gap-2 mt-3">
                  <button
                    onClick={() => test(ev.key)}
                    disabled={testingKey === ev.key}
                    className="border border-indigo-300 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 disabled:opacity-50 px-3 py-1.5 rounded-md text-sm font-medium"
                    title="用範例資料發一則到你自己的裝置"
                  >
                    {testingKey === ev.key ? '試發中…' : '🔔 試發給我'}
                  </button>
                  <button
                    onClick={() => save(ev.key)}
                    disabled={savingKey === ev.key}
                    className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-1.5 rounded-md text-sm font-medium"
                  >
                    {savingKey === ev.key ? '儲存中…' : '儲存'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-bold text-gray-900 mb-1">訂閱名單</h2>
        <p className="text-xs text-gray-400 mb-4">
          已開啟通知：<span className="text-blue-600 font-medium">{enabledCount}</span> / {employees.length} 人
        </p>
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm divide-y divide-gray-100">
          {employees.map(emp => {
            const count = subCounts[emp.id] ?? 0
            const on = count > 0
            return (
              <div key={emp.id} className="flex items-center justify-between px-4 py-2.5">
                <div className="min-w-0">
                  <span className="text-sm text-gray-800 font-medium">{emp.name}</span>
                  {emp.department && <span className="text-xs text-gray-400 ml-2">{emp.department}</span>}
                  {emp.role === 'admin' && <span className="text-xs bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded ml-2">管理員</span>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {on ? (
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                      已開啟{count > 1 ? `（${count} 台）` : ''}
                    </span>
                  ) : (
                    <span className="text-xs bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full">未開啟</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
