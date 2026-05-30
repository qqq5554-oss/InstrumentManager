import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Instrument } from '../types'
import StatusBadge from '../components/StatusBadge'
import InstrumentModal from '../components/InstrumentModal'
import BulkBorrowModal from '../components/BulkBorrowModal'

const CATEGORY_OPTIONS = ['全部', '儀器', '工具'] as const
const STATUS_OPTIONS = [
  { value: '', label: '全部狀態' },
  { value: 'available', label: '可借用' },
  { value: 'borrowed', label: '借出中' },
  { value: 'reserved', label: '已預約' },
] as const

export default function HomePage() {
  const [instruments, setInstruments] = useState<Instrument[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('全部')
  const [selected, setSelected] = useState<Instrument | null>(null)

  // Multi-select
  const [multiMode, setMultiMode] = useState(false)
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set())
  const [bulkOpen, setBulkOpen] = useState(false)

  const fetchInstruments = async () => {
    const { data, error } = await supabase.from('instruments').select('*').order('instrument_no')
    if (!error && data) setInstruments(data)
    setLoading(false)
  }

  useEffect(() => { fetchInstruments() }, [])

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

  return (
    <>
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: '總件數', value: stats.total, color: 'text-gray-800' },
          { label: '可借用', value: stats.available, color: 'text-green-600' },
          { label: '借出中', value: stats.borrowed, color: 'text-red-500' },
          { label: '已預約', value: stats.reserved, color: 'text-amber-600' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-lg border border-gray-200 p-4 text-center shadow-sm">
            <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-sm text-gray-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

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

      {/* Single instrument modal */}
      {selected && (
        <InstrumentModal
          instrument={selected}
          onClose={() => setSelected(null)}
          onRefresh={async () => {
            await fetchInstruments()
            const { data } = await supabase.from('instruments').select('*').eq('id', selected.id).single()
            if (data) setSelected(data)
          }}
        />
      )}

      {/* Bulk borrow modal */}
      {bulkOpen && (
        <BulkBorrowModal
          instruments={checkedInstruments}
          onClose={() => setBulkOpen(false)}
          onDone={() => { setBulkOpen(false); exitMultiMode(); fetchInstruments() }}
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
