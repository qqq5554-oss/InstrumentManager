import { NavLink, useNavigate } from 'react-router-dom'
import logo from '../logo.png'
import { useAuth } from '../context/AuthContext'

export default function Navbar() {
  const { currentUser, logout } = useAuth()
  const navigate = useNavigate()

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
            <NavLink to="/admin" className={linkClass}>管理後台</NavLink>
            <div className="ml-3 pl-3 border-l border-gray-200 flex items-center gap-2">
              <span className="text-sm text-gray-600">{currentUser?.name}</span>
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
    </nav>
  )
}
