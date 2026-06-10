import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import logo from '../logo.png'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [employees, setEmployees] = useState<{ id: string; name: string }[]>([])
  const [selectedName, setSelectedName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    supabase.from('employees').select('id, name').eq('active', true).order('name')
      .then(({ data }) => { if (data) setEmployees(data) })
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { data, error: dbErr } = await supabase
      .rpc('verify_login', { p_name: selectedName, p_pass: password })

    setLoading(false)

    if (dbErr || !data || (data as unknown[]).length === 0) {
      setError('帳號或密碼不正確')
      return
    }

    login((data as unknown[])[0] as import('../types').Employee)
    navigate('/')
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-lg w-full max-w-sm p-8">
        <div className="flex flex-col items-center mb-8">
          <img src={logo} alt="Envirtrol System" className="h-14 w-auto mb-2" />
          <p className="text-sm font-bold" style={{ color: '#7B1818' }}>大群儀器管理系統</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">人員</label>
            <select
              value={selectedName}
              onChange={e => setSelectedName(e.target.value)}
              required
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="">請選擇人員</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.name}>{emp.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">密碼</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="請輸入密碼"
            />
          </div>
          {error && <p className="text-sm text-red-500 text-center">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-md py-2.5 text-sm font-medium transition-colors"
          >
            {loading ? '登入中...' : '登入'}
          </button>
        </form>
      </div>
    </div>
  )
}
