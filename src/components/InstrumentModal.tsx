import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { supabase } from '../lib/supabase'
import type { Instrument, Employee, Loan } from '../types'
import StatusBadge from './StatusBadge'

interface Props {
  instrument: Instrument
  onClose: () => void
  onRefresh: () => Promise<void>
}

const today = () => format(new Date(), 'yyyy-MM-dd')

export default function InstrumentModal({ instrument, onClose, onRefresh }: Props) {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loans, setLoans] = useState<Loan[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Form state
  const [employeeId, setEmployeeId] = useState('')
  const [borrowDate, setBorrowDate] = useState(today())
  const [expectedReturn, setExpectedReturn] = useState('')
  const [purpose, setPurpose] = useState('')

  // Active loan borrower name
  const activeLoan = loans.find(l => l.status === 'borrowed' || l.status === 'reserved')

  useEffect(() => {
    supabase.from('employees').select('*').eq('active', true).order('name').then(({ data }) => {
      if (data) setEmployees(data)
    })
    fetchLoans()
  }, [instrument.id])

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
    if (!employeeId || !borrowDate || !expectedReturn) {
      setError('請填寫所有必填欄位')
      return
    }
    const employee = employees.find(e => e.id === employeeId)
    if (!employee) return

    setSubmitting(true)
    const loanStatus = borrowDate > today() ? 'reserved' : 'borrowed'
    const instrStatus = loanStatus === 'reserved' ? 'reserved' : 'borrowed'

    const { error: loanErr } = await supabase.from('loans').insert({
      instrument_id: instrument.id,
      employee_id: employeeId,
      borrower_name: employee.name,
      borrow_date: borrowDate,
      expected_return_date: expectedReturn,
      purpose: purpose || null,
      status: loanStatus,
    })

    if (loanErr) {
      setError('新增借用失敗：' + loanErr.message)
      setSubmitting(false)
      return
    }

    await supabase.from('instruments').update({ status: instrStatus }).eq('id', instrument.id)
    await fetchLoans()
    await onRefresh()
    setEmployeeId('')
    setBorrowDate(today())
    setExpectedReturn('')
    setPurpose('')
    setSubmitting(false)
  }

  const canBorrow = instrument.status === 'available'

  return (
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
              {(instrument.status === 'borrowed' || instrument.status === 'reserved') && activeLoan && (
                <span className="text-xs text-gray-500">（{activeLoan.borrower_name}）</span>
              )}
            </div>
            <h2 className="text-xl font-bold text-gray-900">{instrument.name}</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1 rounded-md hover:bg-gray-100"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Basic info grid */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            {[
              ['型號廠牌', instrument.model],
              ['放置地點', instrument.location],
              ['保管人', instrument.custodian],
              ['校正週期', instrument.calibration_cycle],
              ['保固截止日', instrument.warranty_expiry],
              ['購入日期', instrument.purchase_date],
            ].map(([label, value]) => (
              <div key={label} className="bg-gray-50 rounded-md p-2.5">
                <p className="text-xs text-gray-400 mb-0.5">{label}</p>
                <p className="text-gray-700 font-medium">{value || '—'}</p>
              </div>
            ))}
          </div>

          {/* Calibration notes */}
          {instrument.calibration_notes && (
            <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-sm">
              <p className="text-xs text-amber-600 font-medium mb-1">操作說明</p>
              <p className="text-gray-700 whitespace-pre-line">{instrument.calibration_notes}</p>
            </div>
          )}

          {/* Borrow form */}
          <div className="border border-gray-200 rounded-lg p-4">
            <h3 className="font-semibold text-gray-800 mb-3 text-sm">申請借用</h3>
            {canBorrow ? (
              <form onSubmit={handleSubmit} className="space-y-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">借用人員 *</label>
                  <select
                    value={employeeId}
                    onChange={e => setEmployeeId(e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    required
                  >
                    <option value="">請選擇人員</option>
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name}{emp.department ? ` (${emp.department})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">借出日期 *</label>
                    <input
                      type="date"
                      value={borrowDate}
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
                      onChange={e => setExpectedReturn(e.target.value)}
                      min={borrowDate}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">用途說明</label>
                  <textarea
                    value={purpose}
                    onChange={e => setPurpose(e.target.value)}
                    rows={2}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    placeholder="選填"
                  />
                </div>
                {error && <p className="text-sm text-red-500">{error}</p>}
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-md py-2 text-sm font-medium transition-colors"
                >
                  {submitting ? '送出中...' : '送出借用申請'}
                </button>
              </form>
            ) : (
              <p className="text-sm text-gray-500 py-2 text-center">
                {instrument.status === 'borrowed' ? '目前借出中，無法申請借用' : '目前已預約，無法申請借用'}
              </p>
            )}
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
                    {loan.actual_return_date && (
                      <span className="text-green-600">實際歸還：{loan.actual_return_date}</span>
                    )}
                    {loan.purpose && <span className="text-gray-400 w-full">{loan.purpose}</span>}
                    <span className={`ml-auto px-2 py-0.5 rounded-full font-medium ${
                      loan.status === 'returned' ? 'bg-gray-100 text-gray-500' :
                      loan.status === 'borrowed' ? 'bg-red-100 text-red-600' :
                      'bg-amber-100 text-amber-700'
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
  )
}
