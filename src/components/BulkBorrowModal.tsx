import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import type { Instrument } from '../types'
import StatusBadge from './StatusBadge'
import { BorrowTermsModal } from './TermsModal'
import { notifyLineBulkBorrow } from '../lib/lineNotify'

interface Props {
  instruments: Instrument[]
  onClose: () => void
  onDone: () => void
}

const today = () => format(new Date(), 'yyyy-MM-dd')

export default function BulkBorrowModal({ instruments, onClose, onDone }: Props) {
  const { currentUser } = useAuth()
  const [list, setList] = useState(instruments)
  const [borrowDate, setBorrowDate] = useState(today())
  const [expectedReturn, setExpectedReturn] = useState('')
  const [projectName, setProjectName] = useState('')
  const [recentProjects, setRecentProjects] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [globalError, setGlobalError] = useState('')
  const [showTerms, setShowTerms] = useState(false)

  useEffect(() => {
    if (!currentUser) return
    supabase.from('loans').select('project_name').not('project_name', 'is', null)
      .eq('employee_id', currentUser.id)
      .order('created_at', { ascending: false }).limit(100)
      .then(({ data }) => {
        if (data) {
          const unique = [...new Set(data.map(d => d.project_name as string))]
          setRecentProjects(unique.slice(0, 8))
        }
      })
  }, [])

  const removeInstrument = (id: string) => {
    setList(prev => prev.filter(i => i.id !== id))
    setErrors(prev => { const next = { ...prev }; delete next[id]; return next })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentUser) return
    setErrors({})
    setGlobalError('')

    if (list.length === 0) {
      setGlobalError('請至少選擇一件儀器')
      return
    }

    if (!borrowDate || !expectedReturn) {
      setGlobalError('請填寫借出日期與歸還日期')
      return
    }

    if (!projectName.trim()) {
      setGlobalError('請填寫專案/用途說明')
      return
    }

    setSubmitting(true)

    const conflictChecks = await Promise.all(
      list.map(async inst => {
        const { data } = await supabase
          .from('loans')
          .select('borrower_name, borrow_date, expected_return_date')
          .eq('instrument_id', inst.id)
          .in('status', ['borrowed', 'reserved'])
          .lte('borrow_date', expectedReturn)
          .gte('expected_return_date', borrowDate)
        return { inst, conflicts: data ?? [] }
      })
    )

    const newErrors: Record<string, string> = {}
    for (const { inst, conflicts } of conflictChecks) {
      if (conflicts.length > 0) {
        const c = conflicts[0] as { borrower_name: string; borrow_date: string; expected_return_date: string }
        newErrors[inst.id] = `日期衝突：${c.borrower_name} ${c.borrow_date}~${c.expected_return_date}`
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      setSubmitting(false)
      return
    }

    setSubmitting(false)
    setShowTerms(true)
  }

  const confirmBorrow = async () => {
    if (!currentUser) return
    setShowTerms(false)
    setSubmitting(true)

    const loanStatus = borrowDate > today() ? 'reserved' : 'borrowed'
    const instrStatus = loanStatus === 'reserved' ? 'reserved' : 'borrowed'

    const loansToInsert = list.map(inst => ({
      instrument_id: inst.id,
      employee_id: currentUser.id,
      borrower_name: currentUser.name,
      borrow_date: borrowDate,
      expected_return_date: expectedReturn,
      project_name: projectName.trim() || null,
      purpose: null,
      status: loanStatus,
    }))

    const { error: insertErr } = await supabase.from('loans').insert(loansToInsert)
    if (insertErr) { setGlobalError('送出失敗：' + insertErr.message); setSubmitting(false); return }

    const availableIds = list.filter(i => i.status === 'available').map(i => i.id)
    if (availableIds.length > 0) {
      await supabase.from('instruments').update({ status: instrStatus }).in('id', availableIds)
    }

    notifyLineBulkBorrow({
      status: loanStatus,
      borrowerName: currentUser.name,
      instruments: list.map(i => ({ name: i.name, instrument_no: i.instrument_no })),
      projectName,
      borrowDate,
      expectedReturn,
    })

    onDone()
  }

  return (
    <>
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={e => e.target === e.currentTarget && !submitting && onClose()}
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">批量借用（{list.length} 件）</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded-md hover:bg-gray-100">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            {list.map(inst => (
              <div key={inst.id} className="px-3 py-2.5 border-b last:border-0 flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <span className="text-xs text-gray-400 font-mono mr-2">{inst.instrument_no}</span>
                  <span className="text-sm text-gray-800">{inst.name}</span>
                  {errors[inst.id] && <p className="text-xs text-red-500 mt-0.5">{errors[inst.id]}</p>}
                </div>
                <StatusBadge status={inst.status} size="sm" />
                <button
                  type="button"
                  onClick={() => removeInstrument(inst.id)}
                  disabled={submitting}
                  className="shrink-0 text-gray-300 hover:text-red-400 transition-colors p-0.5 rounded disabled:opacity-30"
                  title="移除此儀器"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="bg-gray-50 rounded-md px-3 py-2 text-sm text-gray-700">
              借用人：<span className="font-medium">{currentUser?.name}</span>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">專案/用途說明 *</label>
              <input
                type="text"
                value={projectName}
                onChange={e => setProjectName(e.target.value)}
                placeholder="例：A棟裝修工程、Q3校正作業..."
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {recentProjects.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {recentProjects.map(p => (
                    <button key={p} type="button" onClick={() => setProjectName(p)}
                      className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                        projectName === p
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'text-gray-600 border-gray-300 hover:border-blue-400 hover:text-blue-600'
                      }`}>
                      {p}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">借出日期 *</label>
                <input
                  type="date"
                  value={borrowDate}
                  onChange={e => setBorrowDate(e.target.value)}
                  min={today()}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">預計歸還日期 *</label>
                <input
                  type="date"
                  value={expectedReturn}
                  min={borrowDate}
                  onChange={e => setExpectedReturn(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
            </div>
            {globalError && <p className="text-sm text-red-500">{globalError}</p>}
            <div className="flex gap-3">
              <button type="button" onClick={onClose} disabled={submitting}
                className="flex-1 px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50">
                取消
              </button>
              <button type="submit" disabled={submitting}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-md py-2 text-sm font-medium">
                {submitting ? '送出中...' : '確認借用'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
    {showTerms && (
      <BorrowTermsModal onConfirm={confirmBorrow} onCancel={() => setShowTerms(false)} />
    )}
    </>
  )
}
