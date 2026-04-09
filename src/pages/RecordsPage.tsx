import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { supabase } from '../lib/supabase'
import type { Loan } from '../types'

interface LoanWithInstrument extends Omit<Loan, 'instruments'> {
  instruments: { name: string; instrument_no: string } | null
}

const today = () => format(new Date(), 'yyyy-MM-dd')

export default function RecordsPage() {
  const [loans, setLoans] = useState<LoanWithInstrument[]>([])
  const [loading, setLoading] = useState(true)
  const [returning, setReturning] = useState<string | null>(null)
  const [filterBorrower, setFilterBorrower] = useState('')
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')

  const fetchLoans = async () => {
    const { data } = await supabase
      .from('loans')
      .select('*, instruments(name, instrument_no)')
      .order('created_at', { ascending: false })
    if (data) setLoans(data as LoanWithInstrument[])
    setLoading(false)
  }

  useEffect(() => { fetchLoans() }, [])

  const handleReturn = async (loan: LoanWithInstrument) => {
    setReturning(loan.id)
    const returnDate = today()

    await supabase.from('loans').update({
      actual_return_date: returnDate,
      status: 'returned',
    }).eq('id', loan.id)

    // Check if instrument still has active loans
    const { data: remaining } = await supabase
      .from('loans')
      .select('id')
      .eq('instrument_id', loan.instrument_id)
      .in('status', ['borrowed', 'reserved'])
      .neq('id', loan.id)

    if (!remaining || remaining.length === 0) {
      await supabase.from('instruments').update({ status: 'available' }).eq('id', loan.instrument_id)
    }

    await fetchLoans()
    setReturning(null)
  }

  const filtered = loans.filter(l => {
    const q = filterBorrower.toLowerCase()
    const matchBorrower = !q || l.borrower_name.toLowerCase().includes(q)
    const matchFrom = !filterFrom || l.borrow_date >= filterFrom
    const matchTo = !filterTo || l.borrow_date <= filterTo
    return matchBorrower && matchFrom && matchTo
  })

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-5">借用紀錄</h1>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <input
          type="text"
          placeholder="依借用人搜尋..."
          value={filterBorrower}
          onChange={e => setFilterBorrower(e.target.value)}
          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-500 whitespace-nowrap">借出日</label>
          <input
            type="date"
            value={filterFrom}
            onChange={e => setFilterFrom(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <span className="text-gray-400">–</span>
          <input
            type="date"
            value={filterTo}
            onChange={e => setFilterTo(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
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
                  {['儀器名稱', '儀器編號', '借用人', '借出日', '預計歸還', '實際歸還', '用途', '狀態', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-10 text-center text-gray-400">找不到符合條件的紀錄</td>
                  </tr>
                ) : filtered.map(loan => (
                  <tr key={loan.id} className={loan.status !== 'returned' ? 'bg-red-50/30' : ''}>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {loan.instruments?.name || '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-500 font-mono text-xs">
                      {loan.instruments?.instrument_no || '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{loan.borrower_name}</td>
                    <td className="px-4 py-3 text-gray-600">{loan.borrow_date}</td>
                    <td className="px-4 py-3 text-gray-600">{loan.expected_return_date}</td>
                    <td className="px-4 py-3 text-gray-600">{loan.actual_return_date || '—'}</td>
                    <td className="px-4 py-3 text-gray-500 max-w-32 truncate">{loan.purpose || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        loan.status === 'returned' ? 'bg-gray-100 text-gray-500' :
                        loan.status === 'borrowed' ? 'bg-red-100 text-red-600' :
                        'bg-amber-100 text-amber-700'
                      }`}>
                        {loan.status === 'returned' ? '已歸還' : loan.status === 'borrowed' ? '借出中' : '已預約'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {loan.status !== 'returned' && (
                        <button
                          onClick={() => handleReturn(loan)}
                          disabled={returning === loan.id}
                          className="text-xs bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-3 py-1.5 rounded-md font-medium transition-colors"
                        >
                          {returning === loan.id ? '處理中...' : '歸還'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
