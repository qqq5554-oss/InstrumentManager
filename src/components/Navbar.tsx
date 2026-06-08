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
  const [menuOpen, setMenuOpen] = useState(false)
  const isAdmin = currentUser?.role === 'admin'

  const handleLogout = () => {
    logout()
    navigate('/login')
    setMenuOpen(false)
  }

  const desktopLinkClass = ({ isActive }: { isActive: boolean }) =>
    `px-4 py-2 rounded-md text-sm font-medium transition-colors ${
      isActive ? 'bg-blue-600 text-white' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
    }`

  const mobileLinkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center px-3 py-3 rounded-lg text-base font-medium transition-colors ${
      isActive ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-100'
    }`

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex flex-col items-center shrink-0">
            <img src={logo} alt="Envirtrol System" className="h-8 w-auto" />
            <span className="text-xs font-bold mt-0.5 hidden xs:block" style={{ color: '#7B1818' }}>大群儀器管理系統</span>
          </div>

          {/* Desktop nav */}
          <div className="hidden sm:flex items-center gap-1">
            <NavLink to="/" end className={desktopLinkClass}>儀器總覽</NavLink>
            <NavLink to="/records" className={desktopLinkClass}>借用紀錄</NavLink>
            {isAdmin && <NavLink to="/admin" className={desktopLinkClass}>管理後台</NavLink>}
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

          {/* Mobile: user name + hamburger */}
          <div className="flex sm:hidden items-center gap-3">
            <span className="text-sm text-gray-600 font-medium">{currentUser?.name}</span>
            <button
              onClick={() => setMenuOpen(prev => !prev)}
              className="p-2 rounded-md text-gray-500 hover:bg-gray-100 transition-colors"
              aria-label="選單"
            >
              {menuOpen ? (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile dropdown menu */}
      {menuOpen && (
        <div className="sm:hidden border-t border-gray-100 bg-white shadow-lg">
          <div className="px-4 py-3 space-y-1">
            <NavLink to="/" end className={mobileLinkClass} onClick={() => setMenuOpen(false)}>
              <svg className="w-5 h-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zm0 9.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zm9.75-9.75A2.25 2.25 0 0115.75 3.75H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zm0 9.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
              </svg>
              儀器總覽
            </NavLink>
            <NavLink to="/records" className={mobileLinkClass} onClick={() => setMenuOpen(false)}>
              <svg className="w-5 h-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
              </svg>
              借用紀錄
            </NavLink>
            {isAdmin && (
              <NavLink to="/admin" className={mobileLinkClass} onClick={() => setMenuOpen(false)}>
                <svg className="w-5 h-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 011.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.56.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.893.149c-.425.07-.765.383-.93.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 01-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.397.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 01-.12-1.45l.527-.737c.25-.35.273-.806.108-1.204-.165-.397-.505-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.108-1.204l-.526-.738a1.125 1.125 0 01.12-1.45l.773-.773a1.125 1.125 0 011.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                管理後台
              </NavLink>
            )}
          </div>
          <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400">登入身份</p>
              <button
                onClick={() => { if (!isAdmin) { setPwOpen(true); setMenuOpen(false) } }}
                className={`text-sm font-medium text-gray-800 ${!isAdmin ? 'hover:text-blue-600 hover:underline' : ''}`}
              >
                {currentUser?.name}
                {!isAdmin && <span className="text-xs text-gray-400 ml-1">（點擊修改密碼）</span>}
              </button>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-sm text-red-500 hover:text-red-700 font-medium px-3 py-2 rounded-lg hover:bg-red-50 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
              </svg>
              登出
            </button>
          </div>
        </div>
      )}

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
