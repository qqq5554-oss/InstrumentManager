import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Employee } from '../types'

type Audience = 'borrower' | 'admins' | 'all'

interface Setting {
  event_key: string
  enabled: boolean
  audience: Audience
  title: string
  body: string
}

// 可設定的通知情況（實際觸發串接為後續步驟）
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

const DEFAULTS: Record<string, Omit<Setting, 'event_key'>> = {
  reservation_conflict: { enabled: true, audience: 'borrower', title: '儀器歸還提醒', body: '明日有人預約你借用中的儀器，請於今日下班前歸還' },
  overdue: { enabled: true, audience: 'borrower', title: '儀器逾期未還', body: '你借用的儀器已逾期，請盡快歸還' },
  malfunction: { enabled: true, audience: 'admins', title: '儀器異常回報', body: '有儀器被回報異常，已轉為維修中，請確認處理' },
  reserved_for_you: { enabled: true, audience: 'borrower', title: '儀器被預約', body: '你正借用中的儀器已有人預約，請留意歸還時間' },
}

export default function NotificationsTab() {
  const [settings, setSettings] = useState<Record<string, Setting>>({})
  const [employees, setEmployees] = useState<Employee[]>([])
  const [subCounts, setSubCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [savingKey, setSavingKey] = useState<string | null>(null)

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
        ? { event_key: ev.key, enabled: row.enabled, audience: row.audience, title: row.title, body: row.body }
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

  const save = async (key: string) => {
    setSavingKey(key)
    const s = settings[key]
    await supabase.from('notification_settings').upsert(
      { event_key: s.event_key, enabled: s.enabled, audience: s.audience, title: s.title, body: s.body, updated_at: new Date().toISOString() },
      { onConflict: 'event_key' },
    )
    setSavingKey(null)
  }

  if (loading) return <div className="text-center py-20 text-gray-400">載入中...</div>

  const enabledCount = Object.keys(subCounts).length

  return (
    <div className="space-y-8">
      {/* 通知規則 */}
      <section>
        <h2 className="text-lg font-bold text-gray-900 mb-1">通知規則</h2>
        <p className="text-xs text-gray-400 mb-4">設定每種情況要不要發通知、內容、以及發送對象。（實際觸發串接為下一階段）</p>
        <div className="space-y-3">
          {EVENTS.map(ev => {
            const s = settings[ev.key]
            return (
              <div key={ev.key} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">{ev.label}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{ev.desc}</p>
                  </div>
                  <label className="flex items-center gap-2 shrink-0 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={s.enabled}
                      onChange={e => update(ev.key, { enabled: e.target.checked })}
                      className="w-4 h-4 accent-blue-600"
                    />
                    <span className={`text-xs font-medium ${s.enabled ? 'text-blue-600' : 'text-gray-400'}`}>
                      {s.enabled ? '啟用' : '停用'}
                    </span>
                  </label>
                </div>

                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">通知對象</label>
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
                    value={s.body}
                    onChange={e => update(ev.key, { body: e.target.value })}
                    rows={2}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 resize-none"
                  />
                </div>
                <div className="flex justify-end mt-3">
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

      {/* 訂閱名單 */}
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
