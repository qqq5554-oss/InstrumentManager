import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Instrument } from '../types'
import StatusBadge from '../components/StatusBadge'
import InstrumentModal from '../components/InstrumentModal'
import BulkBorrowModal from '../components/BulkBorrowModal'

interface ActiveLoan {
  id: string
  borrower_name: string
  borrow_date: string
  expected_return_date: string
  status: 'borrowed' | 'reserved'
  instruments: { name: string; instrument_no: string } | null
}

const CATEGORY_OPTIONS = ['全部', '儀器', '工具'] as const
const STATUS_OPTIONS = [
  { value: '', label: '全部狀態' },
  { value: 'available', label: '可借用' },
  { value: 'borrowed', label: '借出中' },
  { value: 'reserved', label: '已預約' },
] as const

export default function HomePage() {
  const [instruments, setInstruments] = useState<Instrument[]>([])
  const [activeLoans, setActiveLoans] = useState<ActiveLoan[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('全部')
  const [selected, setSelected] = useState<Instrument | null>(null)

  const [multiMode, setMultiMode] = useState(false)
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set())
  const [bulkOpen, setBulkOpen] = useState(false)

  const fetchAll = async () => {
    const [{ data: instData }, { data: loanData }] = await Promise.all([
      supabase.from('instruments').select('*').order('instrument_no'),
      supabase.from('loans')
        .select('id, borrower_name, borrow_date, expected_return_date, status, instruments(name, instrument_no)')
        .in('status', ['borrowed', 'reserved'])
        .order('status')
        .order('borrow_date'),
    ])
    if (instData) setInstruments(instData)
    if (loanData) setActiveLoans(loanData as unknown as ActiveLoan[])
    setLoading(false)
  }

  useEffect(() => { fetchAll() }, [])

  const filtered = instruments.filter(i => {
    const q = search.toLowerCase()
    const matchSearch = !q || i.name.toLowerCase().includes(q) || i.instrument_no.toLowerCase().includes(q)
    const matchStatus = !statusFilter || i.status === statusFilter
    const matchCat = categoryFilter === '全部' || i.category === categoryFilter
    return matchSearch && matchStatus && matchCat
  })

  const stats = {
    total: instruments.length,
    available: instruments.filter(i => i.status === 'available').length,
    borrowed: instruments.filter(i => i.status === 'borrowed').length,
    reserved: instruments.filter(i => i.status === 'reserved').length,
  }

  const toggleCheck = (id: string) => {
    setCheckedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const exitMultiMode = () => {
    setMultiMode(false)
    setCheckedIds(new Set())
  }

  const checkedInstruments = instruments.filter(i => checkedIds.has(i.id))

  const handleStatClick = (value: string) => {
    setStatusFilter(prev => prev === value ? '' : value)
  }

  const statCards = [
    { label: '總件數', value: stats.total, color: 'text-gray-800', filterVal: '', activeColor: 'border-gray-400 bg-gray-50' },
    { label: '可借用', value: stats.available, color: 'text-green-600', filterVal: 'available', activeColor: 'border-green-400 bg-green-50' },
    { label: '借出中', value: stats.borrowed, color: 'text-red-500', filterVal: 'borrowed', activeColor: 'border-red-400 bg-red-50' },
    { label: '已預約', value: stats.reserved, color: 'text-amber-600', filterVal: 'reserved', activeColor: 'border-amber-400 bg-amber-50' },
  ]

  return (
    <>
      {/* Stats - clickable */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {statCards.map(s => {
          const isActive = statusFilter === s.filterVal && s.filterVal !== ''
          return (
            <button
              key={s.label}
              onClick={() => handleStatClick(s.filterVal)}
              className={`rounded-lg border p-4 text-center shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-400 ${
                isActive
                  ? `${s.activeColor} ring-2 ring-offset-1`
                  : 'bg-white border-gray-200 hover:shadow-md hover:border-gray-300'
              } ${s.filterVal ? 'cursor-pointer' : 'cursor-default'}`}
            >
              <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-sm text-gray-500 mt-1">{s.label}</p>
              {s.filterVal && (
                <p className="text-xs text-gray-400 mt-0.5">{isActive ? '點擊取消篩選' : '點擊篩選'}</p>
              )}
            </button>
          )
        })}
      </div>

      {/* Active loans dashboard */}
      {activeLoans.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm mb-6 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse inline-block" />
            <h2 className="text-sm font-semibold text-gray-700">目前使用狀況</h2>
            <span className="text-xs text-gray-400 ml-1">
              {stats.borrowed > 0 && `借出中 ${stats.borrowed} 件`}
              {stats.borrowed > 0 && stats.reserved > 0 && '、'}
              {stats.reserved > 0 && `已預約 ${stats.reserved} 件`}
            </span>
          </div>
          <div className="divide-y divide-gray-50 max-h-52 overflow-y-auto">
            {activeLoans.map(loan => (
              <div key={loan.id} className="px-4 py-2.5 flex items-center gap-3 text-sm hover:bg-gray-50">
                <span className={`shrink-0 px-1.5 py-0.5 rounded text-xs font-medium ${
                  loan.status === 'borrowed' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-700'
                }`}>
                  {loan.status === 'borrowed' ? '借出中' : '已預約'}
                </span>
                <span className="font-medium text-gray-800 flex-1 truncate">{loan.instruments?.name || '—'}</span>
                <span className="text-xs text-gray-400 font-mono shrink-0 hidden sm:block">{loan.instruments?.instrument_no}</span>
                <span className="text-gray-700 shrink-0 font-medium">{loan.borrower_name}</span>
                <span className="text-xs text-gray-400 shrink-0 hidden md:block">
                  {loan.borrow_date} → {loan.expected_return_date}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters + multi-select toggle */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <input
          type="text"
          placeholder="搜尋名稱或編號..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          {STATUS_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <select
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          {CATEGORY_OPTIONS.map(o => (
            <option key={o} value={o}>{o === '全部' ? '全部類別' : o}</option>
          ))}
        </select>
        <button
          onClick={() => multiMode ? exitMultiMode() : setMultiMode(true)}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors border ${
            multiMode
              ? 'bg-gray-100 border-gray-300 text-gray-600'
              : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
          }`}
        >
          {multiMode ? '取消多選' : '多選借用'}
        </button>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="text-center py-20 text-gray-400">載入中...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-gray-400">找不到符合條件的儀器</div>
      ) : (
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
          {filtered.map(inst => (
            <InstrumentCard
              key={inst.id}
              instrument={inst}
              multiMode={multiMode}
              checked={checkedIds.has(inst.id)}
              onCheck={() => toggleCheck(inst.id)}
              onClick={() => !multiMode && setSelected(inst)}
            />
          ))}
        </div>
      )}

      {/* Floating bulk action bar */}
      {multiMode && checkedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 bg-gray-900 text-white rounded-full px-6 py-3 flex items-center gap-4 shadow-xl">
          <span className="text-sm">已選 {checkedIds.size} 件</span>
          <button
            onClick={() => setBulkOpen(true)}
            className="bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium px-4 py-1.5 rounded-full transition-colors"
          >
            借用所選
          </button>
        </div>
      )}

      {selected && (
        <InstrumentModal
          instrument={selected}
          onClose={() => setSelected(null)}
          onRefresh={async () => {
            await fetchAll()
            const { data } = await supabase.from('instruments').select('*').eq('id', selected.id).single()
            if (data) setSelected(data)
          }}
        />
      )}

      {bulkOpen && (
        <BulkBorrowModal
          instruments={checkedInstruments}
          onClose={() => setBulkOpen(false)}
          onDone={() => { setBulkOpen(false); exitMultiMode(); fetchAll() }}
        />
      )}
    </>
  )
}

function InstrumentCard({
  instrument, multiMode, checked, onCheck, onClick,
}: {
  instrument: Instrument
  multiMode: boolean
  checked: boolean
  onCheck: () => void
  onClick: () => void
}) {
  return (
    <button
      onClick={multiMode ? onCheck : onClick}
      className={`bg-white rounded-lg border p-4 text-left transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 ${
        checked ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-200 hover:shadow-md hover:border-blue-300'
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className="text-xs text-gray-400 font-mono">{instrument.instrument_no}</span>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{instrument.category}</span>
          {multiMode && (
            <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
              checked ? 'bg-blue-500 border-blue-500' : 'border-gray-300'
            }`}>
              {checked && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
            </div>
          )}
        </div>
      </div>
      <p className="font-semibold text-gray-900 text-sm leading-snug mb-3 line-clamp-2">{instrument.name}</p>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-gray-400 truncate">{instrument.location || '—'}</span>
        <StatusBadge status={instrument.status} size="sm" />
      </div>
    </button>
  )
}
