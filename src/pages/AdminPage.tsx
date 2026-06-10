import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Instrument, Employee, InstrumentCategory } from '../types'
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
  const [categories, setCategories] = useState<InstrumentCategory[]>([])
  const [catManageOpen, setCatManageOpen] = useState(false)

  const fetchInstruments = async () => {
    const { data } = await supabase.from('instruments').select('*').order('instrument_no')
    if (data) setInstruments(data)
    setLoading(false)
  }

  const fetchCategories = async () => {
    const { data } = await supabase.from('instrument_categories').select('*').order('created_at')
    if (data) setCategories(data)
  }

  useEffect(() => { fetchInstruments(); fetchCategories() }, [])

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
      <div className="flex justify-end gap-2 mb-3">
        <button onClick={() => setCatManageOpen(true)}
          className="border border-gray-300 hover:bg-gray-50 text-gray-600 px-4 py-2 rounded-md text-sm font-medium transition-colors">
          管理分類
        </button>
        <button onClick={() => { setEditing(null); setFormOpen(true) }}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors">
          + 新增儀器
        </button>
      </div>
      {loading ? <div className="text-center py-20 text-gray-400">載入中...</div> : instruments.length === 0 ? (
        <div className="text-center py-10 text-gray-400">尚無儀器資料</div>
      ) : (
        <>
          {/* 手機卡片 */}
          <div className="sm:hidden space-y-3">
            {instruments.map(inst => (
              <div
                key={inst.id}
                onClick={() => { setEditing(inst); setFormOpen(true) }}
                className="bg-white rounded-lg border border-gray-200 shadow-sm px-4 py-3 cursor-pointer active:bg-gray-50"
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono text-xs text-gray-400 shrink-0">{inst.instrument_no}</span>
                    <span className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full shrink-0">{inst.category}</span>
                  </div>
                  <StatusBadge status={inst.status} size="sm" />
                </div>
                <p className="font-semibold text-gray-900 text-sm mb-1">{inst.name}</p>
                <div className="text-xs text-gray-400 space-y-0.5">
                  {inst.model && <p>{inst.model}</p>}
                  {inst.location && <p>{inst.location}</p>}
                </div>
              </div>
            ))}
          </div>

          {/* 桌機表格 */}
          <div className="hidden sm:block bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>{['編號','類別','分類','名稱','型號','放置地點','保管人','校正週期','狀態'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}</tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {instruments.map(inst => {
                    const subcat = categories.find(c => c.name === inst.subcategory)
                    return (
                    <tr
                      key={inst.id}
                      onClick={() => { setEditing(inst); setFormOpen(true) }}
                      className="hover:bg-gray-50 cursor-pointer"
                    >
                      <td className="px-4 py-3 font-mono text-xs text-gray-500 whitespace-nowrap">{inst.instrument_no}</td>
                      <td className="px-4 py-3"><span className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full">{inst.category}</span></td>
                      <td className="px-4 py-3">
                        {subcat ? (
                          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap" style={{ backgroundColor: subcat.color + '20', color: subcat.color }}>
                            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: subcat.color }} />
                            {subcat.name}
                          </span>
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900 max-w-48 truncate">{inst.name}</td>
                      <td className="px-4 py-3 text-gray-500">{inst.model || '—'}</td>
                      <td className="px-4 py-3 text-gray-500">{inst.location || '—'}</td>
                      <td className="px-4 py-3 text-gray-500">{inst.custodian || '—'}</td>
                      <td className="px-4 py-3 text-gray-500">{inst.calibration_cycle || '—'}</td>
                      <td className="px-4 py-3"><StatusBadge status={inst.status} size="sm" /></td>
                    </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
      {formOpen && <InstrumentFormModal instrument={editing} categories={categories} onCategoriesChanged={fetchCategories} onClose={() => { setFormOpen(false); setEditing(null) }} onSaved={fetchInstruments} onDelete={editing ? () => { setFormOpen(false); setConfirmDelete(editing); setEditing(null) } : undefined} />}
      {catManageOpen && <CategoryManageModal categories={categories} onClose={() => setCatManageOpen(false)} onChanged={fetchCategories} />}
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

const COLOR_OPTIONS = [
  '#6B7280','#3B82F6','#10B981','#EF4444','#F59E0B',
  '#8B5CF6','#EC4899','#14B8A6','#F97316','#6366F1',
]

function CategoryManageModal({ categories, onClose, onChanged }: {
  categories: InstrumentCategory[]
  onClose: () => void
  onChanged: () => void
}) {
  const [name, setName] = useState('')
  const [color, setColor] = useState('#3B82F6')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [error, setError] = useState('')

  const handleAdd = async () => {
    if (!name.trim()) { setError('請填寫分類名稱'); return }
    setSaving(true)
    setError('')
    const { error: err } = await supabase.from('instrument_categories').insert({ name: name.trim(), color })
    if (err) { setError(err.message.includes('unique') ? '此分類名稱已存在' : err.message); setSaving(false); return }
    setName('')
    onChanged()
    setSaving(false)
  }

  const handleDelete = async (id: string) => {
    setDeleting(id)
    setError('')
    const { error: err } = await supabase.from('instrument_categories').delete().eq('id', id)
    if (err) { setError('刪除失敗：' + err.message); setDeleting(null); return }
    onChanged()
    setDeleting(null)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">管理分類</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded-md hover:bg-gray-100">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="p-5 space-y-4">
          {error && <p className="text-sm text-red-500 bg-red-50 rounded-md px-3 py-2">{error}</p>}
          {/* 現有分類 */}
          <div className="space-y-2 max-h-52 overflow-y-auto">
            {categories.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">尚無分類</p>
            ) : categories.map(cat => (
              <div key={cat.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                  <span className="text-sm text-gray-800">{cat.name}</span>
                </div>
                <button
                  onClick={() => handleDelete(cat.id)}
                  disabled={deleting === cat.id}
                  className="text-xs text-red-400 hover:text-red-600 disabled:opacity-50"
                >
                  {deleting === cat.id ? '刪除中...' : '刪除'}
                </button>
              </div>
            ))}
          </div>
          {/* 新增分類 */}
          <div className="border-t border-gray-100 pt-4 space-y-3">
            <p className="text-xs text-gray-500 font-medium">新增分類</p>
            <input
              type="text"
              placeholder="分類名稱"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div>
              <p className="text-xs text-gray-400 mb-2">選擇顏色</p>
              <div className="flex flex-wrap gap-2">
                {COLOR_OPTIONS.map(c => (
                  <button key={c} type="button" onClick={() => setColor(c)}
                    className={`w-7 h-7 rounded-full transition-all ${color === c ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : 'hover:scale-105'}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
            {error && <p className="text-xs text-red-500">{error}</p>}
            <button
              onClick={handleAdd}
              disabled={saving}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-md py-2 text-sm font-medium transition-colors"
            >
              {saving ? '新增中...' : '新增分類'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

const DEPARTMENTS = ['管理部', '企劃部', '專案部']

function EmployeesTab() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Employee | null>(null)

  const fetchEmployees = async () => {
    const { data } = await supabase.from('employees').select('*').order('role').order('name')
    if (data) setEmployees(data)
    setLoading(false)
  }

  useEffect(() => { fetchEmployees() }, [])

  const toggleActive = async (emp: Employee) => {
    await supabase.from('employees').update({ active: !emp.active }).eq('id', emp.id)
    setFormOpen(false)
    setEditing(null)
    fetchEmployees()
  }

  const openEdit = (emp: Employee) => { setEditing(emp); setFormOpen(true) }

  return (
    <>
      <div className="flex justify-end mb-3">
        <button onClick={() => { setEditing(null); setFormOpen(true) }}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors">
          + 新增人員
        </button>
      </div>
      {loading ? <div className="text-center py-20 text-gray-400">載入中...</div> : employees.length === 0 ? (
        <div className="text-center py-10 text-gray-400">尚無人員資料</div>
      ) : (
        <>
          {/* 手機卡片 */}
          <div className="sm:hidden space-y-3">
            {employees.map(emp => (
              <div
                key={emp.id}
                onClick={() => openEdit(emp)}
                className="bg-white rounded-lg border border-gray-200 shadow-sm px-4 py-3 cursor-pointer active:bg-gray-50"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-gray-900">{emp.name}</span>
                  <div className="flex items-center gap-1.5">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${emp.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-500'}`}>
                      {emp.role === 'admin' ? '管理員' : '一般'}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${emp.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                      {emp.active ? '啟用' : '停用'}
                    </span>
                  </div>
                </div>
                <p className="text-sm text-gray-500">{emp.department || '—'}</p>
              </div>
            ))}
          </div>

          {/* 桌機表格 */}
          <div className="hidden sm:block bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>{['姓名','部門','權限','狀態'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {employees.map(emp => (
                  <tr key={emp.id} onClick={() => openEdit(emp)} className="hover:bg-gray-50 cursor-pointer">
                    <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">{emp.name}</td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{emp.department || '—'}</td>
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {formOpen && <EmployeeFormModal
        employee={editing}
        onClose={() => { setFormOpen(false); setEditing(null) }}
        onSaved={fetchEmployees}
        onToggleActive={editing ? () => toggleActive(editing) : undefined}
      />}
    </>
  )
}

function EmployeeFormModal({ employee, onClose, onSaved, onToggleActive }: {
  employee: Employee | null; onClose: () => void; onSaved: () => void; onToggleActive?: () => void
}) {
  const [name, setName] = useState(employee?.name ?? '')
  const [department, setDepartment] = useState(employee?.department ?? '')
  const [role, setRole] = useState<'admin' | 'user'>(employee?.role ?? 'user')
  const [password, setPassword] = useState(employee?.password ?? '')
  const [saving, setSaving] = useState(false)
  const [toggling, setToggling] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) { setError('請填寫姓名'); return }
    setSaving(true)

    const payload: Record<string, unknown> = {
      name: name.trim(),
      department: department || null,
      role,
    }
    if (!employee) payload.active = true
    payload.password = password || null

    const { error: err } = employee
      ? await supabase.from('employees').update(payload).eq('id', employee.id)
      : await supabase.from('employees').insert(payload)

    if (err) { setError('儲存失敗：' + err.message); setSaving(false); return }
    onSaved(); onClose()
  }

  const handleToggle = async () => {
    if (!onToggleActive) return
    setToggling(true)
    await onToggleActive()
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
            <label className="block text-xs text-gray-500 mb-1">密碼{employee ? '（不填則保持不變）' : ' *'}</label>
            <input type="text" value={password} onChange={e => setPassword(e.target.value)}
              required={!employee}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono" />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex items-center justify-between pt-2">
            <div>
              {onToggleActive && employee && (
                <button
                  type="button"
                  onClick={handleToggle}
                  disabled={toggling || saving}
                  className={`px-4 py-2 text-sm rounded-md border disabled:opacity-50 ${employee.active ? 'text-amber-600 border-amber-200 hover:bg-amber-50' : 'text-green-600 border-green-200 hover:bg-green-50'}`}
                >
                  {toggling ? '處理中...' : employee.active ? '停用帳號' : '啟用帳號'}
                </button>
              )}
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={onClose} disabled={saving} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-md">取消</button>
              <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-md font-medium">
                {saving ? '儲存中...' : employee ? '儲存變更' : '新增人員'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
