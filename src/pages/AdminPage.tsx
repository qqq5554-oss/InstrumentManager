import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Instrument, Employee } from '../types'
import StatusBadge from '../components/StatusBadge'
import InstrumentFormModal from '../components/InstrumentFormModal'

type Tab = 'instruments' | 'employees'

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>('instruments')

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-2xl font-bold text-gray-900">管理後台</h1>
      </div>
      <div className="flex gap-1 mb-5 border-b border-gray-200">
        {([['instruments', '儀器管理'], ['employees', '人員管理']] as [Tab, string][]).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            {label}
          </button>
        ))}
      </div>
      {tab === 'instruments' ? <InstrumentsTab /> : <EmployeesTab />}
    </div>
  )
}

function InstrumentsTab() {
  const [instruments, setInstruments] = useState<Instrument[]>([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Instrument | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Instrument | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchInstruments = async () => {
    const { data } = await supabase.from('instruments').select('*').order('instrument_no')
    if (data) setInstruments(data)
    setLoading(false)
  }

  useEffect(() => { fetchInstruments() }, [])

  const handleDelete = async () => {
    if (!confirmDelete) return
    setDeleting(true)
    await supabase.from('instruments').delete().eq('id', confirmDelete.id)
    await fetchInstruments()
    setConfirmDelete(null)
    setDeleting(false)
  }

  return (
    <>
      <div className="flex justify-end mb-3">
        <button onClick={() => { setEditing(null); setFormOpen(true) }}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors">
          + 新增儀器
        </button>
      </div>
      {loading ? <div className="text-center py-20 text-gray-400">載入中...</div> : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>{['編號','類別','名稱','型號','放置地點','保管人','校正週期','狀態','操作'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {instruments.length === 0 ? (
                  <tr><td colSpan={9} className="px-4 py-10 text-center text-gray-400">尚無儀器資料</td></tr>
                ) : instruments.map(inst => (
                  <tr key={inst.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{inst.instrument_no}</td>
                    <td className="px-4 py-3"><span className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full">{inst.category}</span></td>
                    <td className="px-4 py-3 font-medium text-gray-900 max-w-48 truncate">{inst.name}</td>
                    <td className="px-4 py-3 text-gray-500">{inst.model || '—'}</td>
                    <td className="px-4 py-3 text-gray-500">{inst.location || '—'}</td>
                    <td className="px-4 py-3 text-gray-500">{inst.custodian || '—'}</td>
                    <td className="px-4 py-3 text-gray-500">{inst.calibration_cycle || '—'}</td>
                    <td className="px-4 py-3"><StatusBadge status={inst.status} size="sm" /></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button onClick={() => { setEditing(inst); setFormOpen(true) }} className="text-xs text-blue-600 hover:text-blue-800 font-medium">編輯</button>
                        <button onClick={() => setConfirmDelete(inst)} className="text-xs text-red-500 hover:text-red-700 font-medium">刪除</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {formOpen && <InstrumentFormModal instrument={editing} onClose={() => { setFormOpen(false); setEditing(null) }} onSaved={fetchInstruments} />}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={e => e.target === e.currentTarget && !deleting && setConfirmDelete(null)}>
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">確認刪除</h3>
            <p className="text-sm text-gray-600 mb-4">確定要刪除「{confirmDelete.name}」嗎？此操作無法復原。</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirmDelete(null)} disabled={deleting} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-md">取消</button>
              <button onClick={handleDelete} disabled={deleting} className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-md font-medium">
                {deleting ? '刪除中...' : '確認刪除'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

const DEPARTMENTS = ['管理部', '企劃部', '專案部']

function EmployeesTab() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Employee | null>(null)

  const fetchEmployees = async () => {
    const { data } = await supabase.from('employees').select('*').order('name')
    if (data) setEmployees(data)
    setLoading(false)
  }

  useEffect(() => { fetchEmployees() }, [])

  const toggleActive = async (emp: Employee) => {
    await supabase.from('employees').update({ active: !emp.active }).eq('id', emp.id)
    fetchEmployees()
  }

  return (
    <>
      <div className="flex justify-end mb-3">
        <button onClick={() => { setEditing(null); setFormOpen(true) }}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors">
          + 新增人員
        </button>
      </div>
      {loading ? <div className="text-center py-20 text-gray-400">載入中...</div> : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>{['姓名','部門','權限','狀態','操作'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">{h}</th>
              ))}</tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {employees.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-gray-400">尚無人員資料</td></tr>
              ) : employees.map(emp => (
                <tr key={emp.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{emp.name}</td>
                  <td className="px-4 py-3 text-gray-500">{emp.department || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${emp.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-500'}`}>
                      {emp.role === 'admin' ? '管理員' : '一般'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${emp.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                      {emp.active ? '啟用' : '停用'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button onClick={() => { setEditing(emp); setFormOpen(true) }} className="text-xs text-blue-600 hover:text-blue-800 font-medium">編輯</button>
                      <button onClick={() => toggleActive(emp)} className={`text-xs font-medium ${emp.active ? 'text-amber-500 hover:text-amber-700' : 'text-green-600 hover:text-green-800'}`}>
                        {emp.active ? '停用' : '啟用'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {formOpen && <EmployeeFormModal employee={editing} onClose={() => { setFormOpen(false); setEditing(null) }} onSaved={fetchEmployees} />}
    </>
  )
}

function EmployeeFormModal({ employee, onClose, onSaved }: {
  employee: Employee | null; onClose: () => void; onSaved: () => void
}) {
  const [name, setName] = useState(employee?.name ?? '')
  const [department, setDepartment] = useState(employee?.department ?? '')
  const [role, setRole] = useState<'admin' | 'user'>(employee?.role ?? 'user')
  const [password, setPassword] = useState(employee?.password ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) { setError('請填寫姓名'); return }
    setSaving(true)

    const payload: Partial<Employee> = {
      name: name.trim(),
      department: department || null,
      role,
      active: true,
      password: password || null,
    }

    const { error: err } = employee
      ? await supabase.from('employees').update(payload).eq('id', employee.id)
      : await supabase.from('employees').insert(payload)

    if (err) { setError('儲存失敗：' + err.message); setSaving(false); return }
    onSaved(); onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={e => e.target === e.currentTarget && !saving && onClose()}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">{employee ? '編輯人員' : '新增人員'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded-md hover:bg-gray-100">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">姓名 *</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} required
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">部門</label>
            <select value={department} onChange={e => setDepartment(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
              <option value="">— 不指定 —</option>
              {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">權限</label>
            <select value={role} onChange={e => setRole(e.target.value as 'admin' | 'user')}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
              <option value="user">一般（僅借用）</option>
              <option value="admin">管理員（全部功能）</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">密碼</label>
            <input type="text" value={password} onChange={e => setPassword(e.target.value)}
              required={!employee}
              placeholder={employee ? '不填則保持不變' : ''}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono" />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex gap-3 justify-end pt-1">
            <button type="button" onClick={onClose} disabled={saving} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-md">取消</button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-md font-medium">
              {saving ? '儲存中...' : employee ? '儲存變更' : '新增人員'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
