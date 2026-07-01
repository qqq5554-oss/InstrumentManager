import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Navbar from './components/Navbar'
import { useVersionCheck } from './hooks/useVersionCheck'
import LoginPage from './pages/LoginPage'
import HomePage from './pages/HomePage'
import RecordsPage from './pages/RecordsPage'
import AdminPage from './pages/AdminPage'

function ProtectedLayout() {
  const { currentUser } = useAuth()
  useVersionCheck()
  const isAdmin = currentUser?.role === 'admin'
  return (
    <div className="min-h-screen bg-gray-50 w-full overflow-x-hidden">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/records" element={<RecordsPage />} />
          <Route path="/admin" element={isAdmin ? <AdminPage /> : <Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  )
}

export default function App() {
  const { currentUser } = useAuth()

  return (
    <Routes>
      <Route path="/login" element={currentUser ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route path="/*" element={currentUser ? <ProtectedLayout /> : <Navigate to="/login" replace />} />
    </Routes>
  )
}
