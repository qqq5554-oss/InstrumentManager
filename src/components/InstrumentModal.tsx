import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import type { Instrument, Loan } from '../types'
import StatusBadge from './StatusBadge'
import { BorrowTermsModal, ReturnTermsModal } from './TermsModal'
import { notifyLineBorrow } from '../lib/lineNotify'

interface Props {
  instrument: Instrument
  onClose: () => void
  onRefresh: () => Promise<void>
}

const today = () => format(new Date(), 'yyyy-MM-dd')

export default function InstrumentModal({ instrument, onClose, onRefresh }: Props) {
  const { currentUser } = useAuth()
  const [loans, setLoans] = useState<Loan[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const isNotAvailable = instrument.status !== 'available'

  const [borrowDate, setBorrowDate] = useState(today())
  const [expectedReturn, setExpectedReturn] = useState('')
  const [purpose, setPurpose] = useState('')

  const [showBorrowTerms, setShowBorrowTerms] = useState(false)
  const [showReturnTerms, setShowReturnTerms] = useState(false)
  const [pendingReturnLoan, setPendingReturnLoan] = useState<Loan | null>(null)

  const [returning, setReturning] = useState<string | null>(null)
  const [extendingLoanId, setExtendingLoanId] = useState<string | null>(null)
  const [extendDate, setExtendDate] = useState('')
  const [extendReason, setExtendReason] = useState('')
  const [extendSubmitting, setExtendSubmitting] = useState(false)
  const [extendError, setExtendError] = useState('')

  const activeLoan = loans.find(l => l.status === 'borrowed')

  useEffect(() => { fetchLoans() }, [instrument.id])

  const fetchLoans = async () => {
    const { data } = await supabase
      .from('loans')
      .select('*')
      .eq('instrument_id', instrument.id)
      .order('created_at', { ascending: false })
    if (data) setLoans(data)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!borrowDate || !expectedReturn) { setError('請填寫借出日期與歸還日期'); return }
    if (!purpose.trim()) { setError('請填寫專案/用途說明'); return }
    if (!currentUser) { setError('請先登入'); return }

    const { data: conflicts } = await supabase
      .from('loans')
      .select('id, borrower_name, borrow_date, expected_return_date')
      .eq('instrument_id', instrument.id)
      .in('status', ['borrowed', 'reserved'])
      .lte('borrow_date', expectedReturn)
      .gte('expected_return_date', borrowDate)

    if (conflicts && conflicts.length > 0) {
      const c = conflicts[0] as { borrower_name: string; borrow_date: string; expected_return_date: string }
      setError(`日期衝突：${c.borrower_name} 已預約 ${c.borrow_date} ~ ${c.expected_return_date}`)
      return
    }

    setShowBorrowTerms(true)
  }

  const confirmBorrow = async () => {
    if (!currentUser) return
    setShowBorrowTerms(false)
    setSubmitting(true)
    const loanStatus = borrowDate > today() ? 'reserved' : 'borrowed'

    const { error: loanErr } = await supabase.from('loans').insert({
      instrument_id: instrument.id,
      employee_id: currentUser.id,
      borrower_name: currentUser.name,
      borrow_date: borrowDate,
      expected_return_date: expectedReturn,
      purpose: purpose || null,
      status: loanStatus,
    })

    if (loanErr) { setError('申請失敗：' + loanErr.message); setSubmitting(false); return }

    if (instrument.status === 'available') {
      await supabase.from('instruments').update({ status: loanStatus === 'reserved' ? 'reserved' : 'borrowed' }).eq('id', instrument.id)
    }

    notifyLineBorrow({
      status: loanStatus,
      borrowerName: currentUser.name,
      instrumentName: instrument.name,
      instrumentNo: instrument.instrument_no,
      projectName: purpose,
      borrowDate,
      expectedReturn,
    })

    await fetchLoans()
    await onRefresh()
    setBorrowDate(today())
    setExpectedReturn('')
    setPurpose('')
    setSubmitting(false)
  }

  const handleReturn = (loan: Loan) => {
    setPendingReturnLoan(loan)
    setShowReturnTerms(true)
  }

  const confirmReturn = async () => {
    if (!pendingReturnLoan) return
    const loan = pendingReturnLoan
    setShowReturnTerms(false)
    setPendingReturnLoan(null)
    setReturning(loan.id)
    await supabase.from('loans').update({ actual_return_date: today(), status: 'returned' }).eq('id', loan.id)
    const { data: remaining } = await supabase
      .from('loans').select('id')
      .eq('instrument_id', instrument.id)
      .in('status', ['borrowed', 'reserved'])
      .neq('id', loan.id)
    if (!remaining || remaining.length === 0) {
      await supabase.from('instruments').update({ status: 'available' }).eq('id', instrument.id)
    }
    await fetchLoans()
    await onRefresh()
    setReturning(null)
  }

  const handleExtend = async (loan: Loan) => {
    if (!extendDate || !extendReason.trim()) return
    setExtendError('')

    const { data: conflicts } = await supabase
      .from('loans')
      .select('id, borrower_name, borrow_date, expected_return_date')
      .eq('instrument_id', instrument.id)
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
    await supabase.from('loans').update({
      expected_return_date: extendDate,
      purpose: newPurpose,
    }).eq('id', loan.id)

    if (instrument.status === 'overdue') {
      await supabase.from('instruments').update({ status: 'borrowed' }).eq('id', instrument.id)
    }

    await fetchLoans()
    await onRefresh()
    setExtendingLoanId(null)
    setExtendDate('')
    setExtendReason('')
    setExtendSubmitting(false)
  }

  const activeLoans = loans.filter(l => l.status === 'borrowed' || l.status === 'reserved')
  const todayVal = today()

  return (
    <>
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-gray-100">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs text-gray-400 font-mono">{instrument.instrument_no}</span>
              <StatusBadge status={instrument.status} size="sm" />
              {activeLoan && (
                <span className="text-xs text-gray-500">（借用中：{activeLoan.borrower_name}）</span>
              )}
            </div>
            <h2 className="text-xl font-bold text-gray-900">{instrument.name}</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded-md hover:bg-gray-100">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Basic info */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            {([
              ['型號廠牌', instrument.model],
              ['放置地點', instrument.location],
              ['保管人', instrument.custodian],
              ['校正週期', instrument.calibration_cycle],
              ['保固截止日', instrument.warranty_expiry],
              ['購入日期', instrument.purchase_date],
            ] as [string, string | null][]).map(([label, value]) => (
              <div key={label} className="bg-gray-50 rounded-md p-2.5">
                <p className="text-xs text-gray-400 mb-0.5">{label}</p>
                <p className="text-gray-700 font-medium">{value || '—'}</p>
              </div>
            ))}
          </div>

          {instrument.calibration_notes && (
            <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-sm">
              <p className="text-xs text-amber-600 font-medium mb-1">操作說明</p>
              <p className="text-gray-700 whitespace-pre-line">{instrument.calibration_notes}</p>
            </div>
          )}

          {/* Active reservations queue */}
          {activeLoans.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
              <p className="text-xs text-blue-600 font-medium mb-2">目前排程</p>
              <div className="space-y-2">
                {activeLoans.map(l => {
                  const daysOverdue = l.expected_return_date < todayVal
                    ? Math.round((new Date(todayVal).getTime() - new Date(l.expected_return_date).getTime()) / 86400000)
                    : 0
                  const isOwn = l.employee_id === currentUser?.id

                  return (
                    <div key={l.id}>
                      <div className="flex items-center gap-2 text-xs text-gray-600">
                        <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${l.status === 'borrowed' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-700'}`}>
                          {l.status === 'borrowed' ? '借出中' : '預約'}
                        </span>
                        {daysOverdue > 0 && (
                          <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-orange-200 text-orange-800">
                            逾期 {daysOverdue} 天
                          </span>
                        )}
                        <span className="font-medium">{l.borrower_name}</span>
                        <span className="text-gray-400">{l.borrow_date} ~ {l.expected_return_date}</span>
                        {isOwn && (
                          <div className="ml-auto flex gap-1.5 shrink-0">
                            <button
                              onClick={() => {
                                setExtendingLoanId(extendingLoanId === l.id ? null : l.id)
                                setExtendDate('')
                                setExtendReason('')
                                setExtendError('')
                              }}
                              className="px-2 py-0.5 bg-blue-500 hover:bg-blue-600 text-white rounded text-xs font-medium transition-colors"
                            >
                              申請延長
                            </button>
                            <button
                              onClick={() => handleReturn(l)}
                              disabled={returning === l.id}
                              className="px-2.5 py-0.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded text-xs font-medium transition-colors"
                            >
                              {returning === l.id ? '處理中...' : '歸還'}
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Extension form */}
                      {extendingLoanId === l.id && (
                        <div className="mt-2 p-3 bg-white rounded-md border border-blue-200 space-y-2">
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">新的歸還日期 *</label>
                            <input
                              type="date"
                              value={extendDate}
                              min={l.expected_return_date > todayVal ? l.expected_return_date : todayVal}
                              onChange={e => setExtendDate(e.target.value)}
                              className="w-full rounded border border-gray-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">延長原因 *</label>
                            <textarea
                              value={extendReason}
                              onChange={e => setExtendReason(e.target.value)}
                              rows={2}
                              placeholder="請說明延長原因..."
                              className="w-full rounded border border-gray-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                            />
                          </div>
                          {extendError && <p className="text-xs text-red-500">{extendError}</p>}
                          <div className="flex gap-2">
                            <button
                              onClick={() => { setExtendingLoanId(null); setExtendError('') }}
                              className="flex-1 px-3 py-1.5 text-xs text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
                            >
                              取消
                            </button>
                            <button
                              onClick={() => handleExtend(l)}
                              disabled={!extendDate || !extendReason.trim() || extendSubmitting}
                              className="flex-1 px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded font-medium transition-colors"
                            >
                              {extendSubmitting ? '送出中...' : '確認延長'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Borrow / Reserve form */}
          <div className="border border-gray-200 rounded-lg p-4">
            <h3 className="font-semibold text-gray-800 mb-3 text-sm">
              {isNotAvailable ? '申請預約' : '申請借用'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="bg-gray-50 rounded-md px-3 py-2 text-sm text-gray-700">
                借用人：<span className="font-medium">{currentUser?.name}</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">借出日期 *</label>
                  <input
                    type="date"
                    value={borrowDate}
                    min={today()}
                    onChange={e => setBorrowDate(e.target.value)}
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
              <div>
                <label className="block text-xs text-gray-500 mb-1">專案/用途說明 *</label>
                <textarea
                  value={purpose}
                  onChange={e => setPurpose(e.target.value)}
                  rows={2}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  placeholder="請說明借用用途或專案名稱..."
                />
              </div>
              {error && <p className="text-sm text-red-500">{error}</p>}
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-md py-2 text-sm font-medium transition-colors"
              >
                {submitting ? '送出中...' : isNotAvailable ? '送出預約申請' : '送出借用申請'}
              </button>
            </form>
          </div>

          {/* Loan history */}
          {loans.length > 0 && (
            <div>
              <h3 className="font-semibold text-gray-800 mb-3 text-sm">借用紀錄</h3>
              <div className="divide-y divide-gray-100 border border-gray-200 rounded-lg overflow-hidden">
                {loans.map(loan => (
                  <div key={loan.id} className="px-3 py-2.5 text-xs flex flex-wrap gap-x-4 gap-y-1 bg-white">
                    <span className="font-medium text-gray-800">{loan.borrower_name}</span>
                    <span className="text-gray-500">{loan.borrow_date} → {loan.expected_return_date}</span>
                    {loan.actual_return_date && <span className="text-green-600">歸還：{loan.actual_return_date}</span>}
                    {loan.purpose && <span className="text-gray-400 w-full whitespace-pre-line">{loan.purpose}</span>}
                    <span className={`ml-auto px-2 py-0.5 rounded-full font-medium ${
                      loan.status === 'returned' ? 'bg-gray-100 text-gray-500' :
                      loan.status === 'borrowed' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {loan.status === 'returned' ? '已歸還' : loan.status === 'borrowed' ? '借出中' : '已預約'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
    {showBorrowTerms && (
      <BorrowTermsModal onConfirm={confirmBorrow} onCancel={() => setShowBorrowTerms(false)} />
    )}
    {showReturnTerms && (
      <ReturnTermsModal onConfirm={confirmReturn} onCancel={() => { setShowReturnTerms(false); setPendingReturnLoan(null) }} />
    )}
    </>
  )
}
