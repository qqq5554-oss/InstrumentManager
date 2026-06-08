import { useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import { supabase } from '../lib/supabase'
import type { Loan } from '../types'

interface LoanWithInstrument extends Omit<Loan, 'instruments'> {
  instruments: { name: string; instrument_no: string } | null
}

type RenderItem =
  | { kind: 'header'; projectName: string; activeLoans: LoanWithInstrument[] }
  | { kind: 'loan'; loan: LoanWithInstrument }

const today = () => format(new Date(), 'yyyy-MM-dd')

export default function RecordsPage() {
  const [loans, setLoans] = useState<LoanWithInstrument[]>([])
  const [loading, setLoading] = useState(true)
  const [returning, setReturning] = useState<string | null>(null)
  const [returningProject, setReturningProject] = useState<string | null>(null)
  const [filterBorrower, setFilterBorrower] = useState('')
  const [filterProject, setFilterProject] = useState('')
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
  }

  const handleReturnProject = async (projectName: string, activeLoans: LoanWithInstrument[]) => {
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
        <input
          type="text"
          placeholder="依借用人搜尋..."
          value={filterBorrower}
          onChange={e => setFilterBorrower(e.target.value)}
          className="flex-1 min-w-32 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <input
          type="text"
          placeholder="依專案名稱搜尋..."
          value={filterProject}
          onChange={e => setFilterProject(e.target.value)}
          className="flex-1 min-w-32 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
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
                            {item.activeLoans.length > 0 && (
                              <button
                                onClick={() => handleReturnProject(item.projectName, item.activeLoans)}
                                disabled={isReturning}
                                className="text-xs bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-3 py-1 rounded-md font-medium transition-colors"
                              >
                                {isReturning ? '處理中...' : `全部歸還（${item.activeLoans.length} 件）`}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  }

                  const { loan } = item
                  return (
                    <tr key={loan.id} className={loan.project_name ? 'bg-blue-50/20' : loan.status !== 'returned' ? 'bg-red-50/30' : ''}>
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
                            disabled={returning === loan.id || (returningProject !== null && returningProject === loan.project_name)}
                            className="text-xs bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-3 py-1.5 rounded-md font-medium transition-colors"
                          >
                            {returning === loan.id ? '處理中...' : '歸還'}
                          </button>
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
    </div>
  )
}
