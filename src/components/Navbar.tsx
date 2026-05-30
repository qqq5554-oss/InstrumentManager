import { NavLink } from 'react-router-dom'
import logo from '../logo.png'

export default function Navbar() {
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
          <div className="flex gap-1">
            <NavLink to="/" end className={linkClass}>儀器總覽</NavLink>
            <NavLink to="/records" className={linkClass}>借用紀錄</NavLink>
            <NavLink to="/admin" className={linkClass}>管理後台</NavLink>
          </div>
        </div>
      </div>
    </nav>
  )
}