import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { getPushState, subscribePush, unsubscribePush, type PushState } from '../lib/push'

export default function NotificationToggle({ variant = 'desktop' }: { variant?: 'desktop' | 'mobile' }) {
  const { currentUser } = useAuth()
  const [state, setState] = useState<PushState>('default')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    getPushState().then(setState).catch(() => setState('unsupported'))
  }, [])

  if (state === 'unsupported' || !currentUser) return null

  const handleClick = async () => {
    setError('')
    setBusy(true)
    try {
      if (state === 'subscribed') {
        await unsubscribePush()
      } else {
        await subscribePush(currentUser.id)
      }
      setState(await getPushState())
    } catch (e) {
      setError(e instanceof Error ? e.message : '操作失敗')
    } finally {
      setBusy(false)
    }
  }

  const subscribed = state === 'subscribed'
  const label = busy ? '處理中…' : subscribed ? '通知已開啟' : '開啟通知'

  const bell = (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
    </svg>
  )

  if (variant === 'mobile') {
    return (
      <div className="w-full">
        <button
          onClick={handleClick}
          disabled={busy}
          className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
            subscribed
              ? 'bg-blue-50 border-blue-200 text-blue-700'
              : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
          }`}
        >
          {bell}
          {label}
        </button>
        {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
      </div>
    )
  }

  return (
    <div className="relative">
      <button
        onClick={handleClick}
        disabled={busy}
        title={subscribed ? '點擊關閉此裝置通知' : '點擊開啟此裝置通知'}
        className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md border transition-colors ${
          subscribed
            ? 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100'
            : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
        }`}
      >
        {bell}
        {label}
      </button>
      {error && <p className="absolute right-0 top-full mt-1 w-48 text-xs text-red-500 bg-white border border-red-100 rounded p-1.5 shadow z-50">{error}</p>}
    </div>
  )
}
