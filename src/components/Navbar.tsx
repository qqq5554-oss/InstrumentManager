import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import logo from '../logo.png'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import type { Employee } from '../types'

export default function Navbar() {
  const { currentUser, login, logout } = useAuth()
  const navigate = useNavigate()
  const [pwOpen, setPwOpen] = useState(false)
  const isAdmin = currentUser?.role === 'admin'

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `px-4 py-2 rounded-md text-sm font-medium transition-colors ${
      isActive
        ? 'bg-blue-600 text-white'
        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
    }`

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex flex-col items-center">
            <img src={logo} alt="Envirtrol System" className="h-8 w-auto" />
            <span className="text-xs font-bold mt-0.5" style={{ color: '#7B1818' }}>大群儀器管理系統</span>
          </div>
          <div className="flex items-center gap-1">
            <NavLink to="/" end className={linkClass}>儀器總覽</NavLink>
            <NavLink to="/records" className={linkClass}>借用紀錄</NavLink>
            {isAdmin && <NavLink to="/admin" className={linkClass}>管理後台</NavLink>}
            <div className="ml-3 pl-3 border-l border-gray-200 flex items-center gap-2">
              <button
                onClick={() => { if (!isAdmin) setPwOpen(true) }}
                title={isAdmin ? '' : '點擊修改密碼'}
                className={`text-sm text-gray-600 ${!isAdmin ? 'hover:text-blue-600 hover:underline cursor-pointer' : 'cursor-default'}`}
              >
                {currentUser?.name}
              </button>
              <button
                onClick={handleLogout}
                className="text-xs text-gray-400 hover:text-red-500 transition-colors px-2 py-1"
              >
                登出
              </button>
            </div>
          </div>
        </div>
      </div>
      {pwOpen && currentUser && (
        <ChangePasswordModal
          employee={currentUser}
          onClose={() => setPwOpen(false)}
          onSaved={(updated) => { login(updated); setPwOpen(false) }}
        />
      )}
    </nav>
  )
}

function ChangePasswordModal({ employee, onClose, onSaved }: {
  employee: Employee; onClose: () => void; onSaved: (updated: Employee) => void
}) {
  const [newPw, setNewPw] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newPw) { setError('請填寫新密碼'); return }
    if (newPw !== confirm) { setError('兩次密碼不一致'); return }
    setSaving(true)
    const { error: err } = await supabase.from('employees').update({ password: newPw }).eq('id', employee.id)
    if (err) { setError('儲存失敗：' + err.message); setSaving(false); return }
    onSaved({ ...employee, password: newPw })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={e => e.target === e.currentTarget && !saving && onClose()}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">修改密碼</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded-md hover:bg-gray-100">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">新密碼</label>
            <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} required
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">確認新密碼</label>
            <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex gap-3 justify-end pt-1">
            <button type="button" onClick={onClose} disabled={saving} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-md">取消</button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-md font-medium">
              {saving ? '儲存中...' : '儲存'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
