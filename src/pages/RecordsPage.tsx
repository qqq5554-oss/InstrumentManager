import { useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import type { Loan } from '../types'
import { ReturnTermsModal } from '../components/TermsModal'

interface LoanWithInstrument extends Omit<Loan, 'instruments'> {
  instruments: { name: string; instrument_no: string } | null
}

type RenderItem =
  | { kind: 'header'; projectName: string; activeLoans: LoanWithInstrument[] }
  | { kind: 'loan'; loan: LoanWithInstrument }

const today = () => format(new Date(), 'yyyy-MM-dd')

const overdayDays = (loan: LoanWithInstrument) => {
  if (loan.status !== 'borrowed' || loan.expected_return_date >= today()) return 0
  return Math.round((new Date(today()).getTime() - new Date(loan.expected_return_date).getTime()) / 86400000)
}

export default function RecordsPage() {
  const { currentUser } = useAuth()
  const isAdmin = currentUser?.role === 'admin'
  const [loans, setLoans] = useState<LoanWithInstrument[]>([])
  const [loading, setLoading] = useState(true)
  const [returning, setReturning] = useState<string | null>(null)
  const [returningProject, setReturningProject] = useState<string | null>(null)
  const [returnTermsLoan, setReturnTermsLoan] = useState<LoanWithInstrument | null>(null)
  const [returnTermsProject, setReturnTermsProject] = useState<{ name: string; loans: LoanWithInstrument[] } | null>(null)
  const [filterBorrower, setFilterBorrower] = useState('')
  const [filterProject, setFilterProject] = useState('')
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')
  const [selectedLoan, setSelectedLoan] = useState<LoanWithInstrument | null>(null)
  const [openExtend, setOpenExtend] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async (loan: LoanWithInstrument) => {
    setDeleting(true)
    await supabase.from('loans').delete().eq('id', loan.id)
    if (loan.status !== 'returned') {
      const { data: remaining } = await supabase
        .from('loans').select('id')
        .eq('instrument_id', loan.instrument_id)
        .in('status', ['borrowed', 'reserved'])
        .neq('id', loan.id)
      if (!remaining || remaining.length === 0) {
        await supabase.from('instruments').update({ status: 'available' }).eq('id', loan.instrument_id)
      }
    }
    await fetchLoans()
    setDeleting(false)
    setSelectedLoan(null)
    setOpenExtend(false)
  }

  const fetchLoans = async () => {
    const { data } = await supabase
      .from('loans')
      .select('*, instruments(name, instrument_no)')
      .order('created_at', { ascending: false })
    if (data) setLoans(data as LoanWithInstrument[])
    setLoading(false)
  }

  useEffect(() => { fetchLoans() }, [])

  const handleReturn = (loan: LoanWithInstrument) => {
    setReturnTermsLoan(loan)
  }

  const confirmReturn = async () => {
    if (!returnTermsLoan) return
    const loan = returnTermsLoan
    setReturnTermsLoan(null)
    setReturning(loan.id)
    await supabase.from('loans').update({ actual_return_date: today(), status: 'returned' }).eq('id', loan.id)
    const { data: remaining } = await supabase
      .from('loans').select('id')
      .eq('instrument_id', loan.instrument_id)
      .in('status', ['borrowed', 'reserved'])
      .neq('id', loan.id)
    if (!remaining || remaining.length === 0) {
      await supabase.from('instruments').update({ status: 'available' }).eq('id', loan.instrument_id)
    }
    await fetchLoans()
    setReturning(null)
    setSelectedLoan(null)
    setOpenExtend(false)
  }

  const handleReturnProject = (projectName: string, activeLoans: LoanWithInstrument[]) => {
    setReturnTermsProject({ name: projectName, loans: activeLoans })
  }

  const confirmReturnProject = async () => {
    if (!returnTermsProject) return
    const { name: projectName, loans: activeLoans } = returnTermsProject
    setReturnTermsProject(null)
    setReturningProject(projectName)
    const returnDate = today()
    await Promise.all(activeLoans.map(async loan => {
      await supabase.from('loans').update({ actual_return_date: returnDate, status: 'returned' }).eq('id', loan.id)
      const { data: remaining } = await supabase
        .from('loans').select('id')
        .eq('instrument_id', loan.instrument_id)
        .in('status', ['borrowed', 'reserved'])
        .neq('id', loan.id)
      if (!remaining || remaining.length === 0) {
        await supabase.from('instruments').update({ status: 'available' }).eq('id', loan.instrument_id)
      }
    }))
    await fetchLoans()
    setReturningProject(null)
  }

  const filtered = loans.filter(l => {
    const q = filterBorrower.toLowerCase()
    const pq = filterProject.toLowerCase()
    return (
      (!q || l.borrower_name.toLowerCase().includes(q)) &&
      (!pq || (l.project_name ?? '').toLowerCase().includes(pq)) &&
      (!filterFrom || l.borrow_date >= filterFrom) &&
      (!filterTo || l.borrow_date <= filterTo)
    )
  })

  const renderItems = useMemo((): RenderItem[] => {
    const byProject = new Map<string, LoanWithInstrument[]>()
    for (const loan of filtered) {
      if (loan.project_name) {
        const arr = byProject.get(loan.project_name) ?? []
        arr.push(loan)
        byProject.set(loan.project_name, arr)
      }
    }
    const items: RenderItem[] = []
    const seen = new Set<string>()
    for (const loan of filtered) {
      if (loan.project_name) {
        if (!seen.has(loan.project_name)) {
          seen.add(loan.project_name)
          const projectLoans = byProject.get(loan.project_name)!
          const activeLoans = projectLoans.filter(l => l.status !== 'returned')
          items.push({ kind: 'header', projectName: loan.project_name, activeLoans })
        }
        items.push({ kind: 'loan', loan })
      } else {
        items.push({ kind: 'loan', loan })
      }
    }
    return items
  }, [filtered])

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-5">借用紀錄</h1>

      <div className="flex flex-col sm:flex-row gap-3 mb-5 flex-wrap">
        <input type="text" placeholder="依借用人搜尋..." value={filterBorrower}
          onChange={e => setFilterBorrower(e.target.value)}
          className="flex-1 min-w-32 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <input type="text" placeholder="依專案名稱搜尋..." value={filterProject}
          onChange={e => setFilterProject(e.target.value)}
          className="flex-1 min-w-32 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-500 whitespace-nowrap">借出日</label>
          <input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <span className="text-gray-400">–</span>
          <input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20 text-gray-400">載入中...</div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['儀器名稱', '儀器編號', '借用人', '借出日', '預計歸還', '實際歸還', '專案／備註', '狀態', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {renderItems.length === 0 ? (
                  <tr><td colSpan={9} className="px-4 py-10 text-center text-gray-400">找不到符合條件的紀錄</td></tr>
                ) : renderItems.map((item, i) => {
                  if (item.kind === 'header') {
                    const isReturning = returningProject === item.projectName
                    return (
                      <tr key={`header-${item.projectName}-${i}`} className="bg-blue-50 border-b border-blue-100">
                        <td colSpan={9} className="px-4 py-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
                              <span className="text-sm font-semibold text-blue-800">{item.projectName}</span>
                              <span className="text-xs text-blue-500">
                                {item.activeLoans.length > 0 ? `${item.activeLoans.length} 件借用中` : '已全部歸還'}
                              </span>
                            </div>
                            {item.activeLoans.length > 0 && isAdmin && (
                              <button onClick={() => handleReturnProject(item.projectName, item.activeLoans)} disabled={isReturning}
                                className="text-xs bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-3 py-1 rounded-md font-medium transition-colors">
                                {isReturning ? '處理中...' : `全部歸還（${item.activeLoans.length} 件）`}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  }

                  const { loan } = item
                  const days = overdayDays(loan)
                  return (
                    <tr key={loan.id}
                      onClick={() => setSelectedLoan(loan)}
                      className={`cursor-pointer hover:bg-gray-50 transition-colors ${loan.project_name ? 'bg-blue-50/20' : ''}`}>
                      <td className="px-4 py-3 font-medium text-gray-900">{loan.instruments?.name || '—'}</td>
                      <td className="px-4 py-3 text-gray-500 font-mono text-xs">{loan.instruments?.instrument_no || '—'}</td>
                      <td className="px-4 py-3 text-gray-700">{loan.borrower_name}</td>
                      <td className="px-4 py-3 text-gray-600">{loan.borrow_date}</td>
                      <td className="px-4 py-3 text-gray-600">{loan.expected_return_date}</td>
                      <td className="px-4 py-3 text-gray-600">{loan.actual_return_date || '—'}</td>
                      <td className="px-4 py-3 text-gray-500 max-w-40">
                        {loan.purpose && <p className="text-xs truncate">{loan.purpose}</p>}
                        {!loan.project_name && !loan.purpose && '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 flex-wrap">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            loan.status === 'returned' ? 'bg-gray-100 text-gray-500' :
                            loan.status === 'borrowed' ? 'bg-red-100 text-red-600' :
                            'bg-amber-100 text-amber-700'
                          }`}>
                            {loan.status === 'returned' ? '已歸還' : loan.status === 'borrowed' ? '借出中' : '已預約'}
                          </span>
                          {days > 0 && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
                              逾期 {days} 天
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        {loan.status !== 'returned' && (isAdmin || loan.employee_id === currentUser?.id) && (
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => { setSelectedLoan(loan); setOpenExtend(true) }}
                              className="text-xs bg-orange-500 hover:bg-orange-600 text-white px-2.5 py-1.5 rounded-md font-medium transition-colors whitespace-nowrap">
                              申請延長
                            </button>
                            <button
                              onClick={() => handleReturn(loan)}
                              disabled={returning === loan.id || (returningProject !== null && returningProject === loan.project_name)}
                              className="text-xs bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-3 py-1.5 rounded-md font-medium transition-colors">
                              {returning === loan.id ? '處理中...' : '歸還'}
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selectedLoan && (
        <LoanDetailModal
          loan={selectedLoan}
          isAdmin={isAdmin}
          currentUserId={currentUser?.id ?? ''}
          onClose={() => { setSelectedLoan(null); setOpenExtend(false) }}
          onReturn={handleReturn}
          onExtended={() => { fetchLoans(); setSelectedLoan(null); setOpenExtend(false) }}
          onDelete={handleDelete}
          returning={returning}
          deleting={deleting}
          initialShowExtend={openExtend}
          hideReturn={openExtend}
        />
      )}
      {returnTermsLoan && (
        <ReturnTermsModal onConfirm={confirmReturn} onCancel={() => setReturnTermsLoan(null)} />
      )}
      {returnTermsProject && (
        <ReturnTermsModal onConfirm={confirmReturnProject} onCancel={() => setReturnTermsProject(null)} />
      )}
    </div>
  )
}

function LoanDetailModal({ loan, isAdmin, currentUserId, onClose, onReturn, onExtended, onDelete, returning, deleting, initialShowExtend, hideReturn }: {
  loan: LoanWithInstrument
  isAdmin: boolean
  currentUserId: string
  onClose: () => void
  onReturn: (loan: LoanWithInstrument) => void
  onExtended: () => void
  onDelete: (loan: LoanWithInstrument) => void
  returning: string | null
  deleting: boolean
  initialShowExtend?: boolean
  hideReturn?: boolean
}) {
  const todayVal = today()
  const days = overdayDays(loan)
  const canAct = isAdmin || loan.employee_id === currentUserId

  const [showExtend, setShowExtend] = useState(initialShowExtend ?? false)
  const [extendDate, setExtendDate] = useState('')
  const [extendReason, setExtendReason] = useState('')
  const [extendSubmitting, setExtendSubmitting] = useState(false)
  const [extendError, setExtendError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  const handleExtend = async () => {
    if (!extendDate || !extendReason.trim()) return
    setExtendError('')

    const { data: conflicts } = await supabase
      .from('loans')
      .select('id, borrower_name, borrow_date, expected_return_date')
      .eq('instrument_id', loan.instrument_id)
      .in('status', ['borrowed', 'reserved'])
      .neq('id', loan.id)
      .lte('borrow_date', extendDate)
      .gte('expected_return_date', loan.borrow_date)

    if (conflicts && conflicts.length > 0) {
      const c = conflicts[0] as { borrower_name: string; borrow_date: string; expected_return_date: string }
      setExtendError(`日期衝突：${c.borrower_name} 已預約 ${c.borrow_date} ~ ${c.expected_return_date}`)
      return
    }

    setExtendSubmitting(true)
    const note = `[延長至 ${extendDate}，原因：${extendReason.trim()}]`
    const newPurpose = loan.purpose ? `${loan.purpose}\n${note}` : note
    await supabase.from('loans').update({ expected_return_date: extendDate, purpose: newPurpose }).eq('id', loan.id)

    const { data: inst } = await supabase.from('instruments').select('status').eq('id', loan.instrument_id).single()
    if (inst?.status === 'overdue') {
      await supabase.from('instruments').update({ status: 'borrowed' }).eq('id', loan.instrument_id)
    }

    setExtendSubmitting(false)
    onExtended()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="flex items-start justify-between p-5 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{loan.instruments?.name || '借用詳細'}</h2>
            <p className="text-xs text-gray-400 font-mono mt-0.5">{loan.instruments?.instrument_no}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded-md hover:bg-gray-100 shrink-0">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
              loan.status === 'returned' ? 'bg-gray-100 text-gray-500' :
              loan.status === 'borrowed' ? 'bg-red-100 text-red-600' :
              'bg-amber-100 text-amber-700'
            }`}>
              {loan.status === 'returned' ? '已歸還' : loan.status === 'borrowed' ? '借出中' : '已預約'}
            </span>
            {days > 0 && (
              <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
                逾期 {days} 天
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            {([
              ['借用人', loan.borrower_name],
              ['借出日', loan.borrow_date],
              ['預計歸還', loan.expected_return_date],
              ['實際歸還', loan.actual_return_date || '—'],
            ] as [string, string][]).map(([label, value]) => (
              <div key={label} className="bg-gray-50 rounded-md p-2.5">
                <p className="text-xs text-gray-400 mb-0.5">{label}</p>
                <p className="text-gray-700 font-medium">{value}</p>
              </div>
            ))}
          </div>

          {loan.purpose && (
            <div className="bg-gray-50 rounded-md p-3">
              <p className="text-xs text-gray-400 mb-1">用途 / 備註</p>
              <p className="text-gray-700 whitespace-pre-line text-xs">{loan.purpose}</p>
            </div>
          )}

          {loan.status !== 'returned' && canAct && (
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <button
                onClick={() => { setShowExtend(!showExtend); setExtendError('') }}
                className="w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <span>申請延長</span>
                <svg className={`w-4 h-4 text-gray-400 transition-transform ${showExtend ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </button>
              {showExtend && (
                <div className="p-3 border-t border-gray-100 space-y-2 bg-gray-50/50">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">新的歸還日期 *</label>
                    <input type="date" value={extendDate}
                      min={loan.expected_return_date > todayVal ? loan.expected_return_date : todayVal}
                      onChange={e => setExtendDate(e.target.value)}
                      className="w-full rounded border border-gray-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">延長原因 *</label>
                    <textarea value={extendReason} onChange={e => setExtendReason(e.target.value)}
                      rows={2} placeholder="請說明延長原因..."
                      className="w-full rounded border border-gray-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
                  </div>
                  {extendError && <p className="text-xs text-red-500">{extendError}</p>}
                  <button onClick={handleExtend}
                    disabled={!extendDate || !extendReason.trim() || extendSubmitting}
                    className="w-full px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded font-medium transition-colors">
                    {extendSubmitting ? '送出中...' : '確認延長'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {loan.status !== 'returned' && canAct && !hideReturn && (
          <div className="px-5 pb-5">
            <button onClick={() => onReturn(loan)} disabled={returning === loan.id}
              className="w-full px-4 py-2 text-sm bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-md font-medium transition-colors">
              {returning === loan.id ? '處理中...' : '歸還儀器'}
            </button>
          </div>
        )}

        {isAdmin && (
          <div className="px-5 pb-5 border-t border-gray-100 pt-4">
            {!confirmDelete ? (
              <button
                onClick={() => setConfirmDelete(true)}
                disabled={deleting}
                className="w-full px-4 py-2 text-sm text-red-500 border border-red-200 hover:bg-red-50 hover:border-red-300 rounded-md font-medium transition-colors disabled:opacity-50"
              >
                刪除此紀錄
              </button>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-red-600 text-center font-medium">確定要刪除這筆借用紀錄？</p>
                <div className="flex gap-2">
                  <button onClick={() => setConfirmDelete(false)}
                    className="flex-1 px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50">
                    取消
                  </button>
                  <button onClick={() => onDelete(loan)} disabled={deleting}
                    className="flex-1 px-4 py-2 text-sm bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-md font-medium transition-colors">
                    {deleting ? '刪除中...' : '確定刪除'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
