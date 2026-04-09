import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Instrument } from '../types'
import StatusBadge from '../components/StatusBadge'
import InstrumentModal from '../components/InstrumentModal'

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

  const fetchInstruments = async () => {
    const { data, error } = await supabase
      .from('instruments')
      .select('*')
      .order('instrument_no')
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

      {/* Filters */}
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
      </div>

      {/* Grid */}
      {loading ? (
        <div className="text-center py-20 text-gray-400">載入中...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-gray-400">找不到符合條件的儀器</div>
      ) : (
        <div
          className="grid gap-4"
          style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}
        >
          {filtered.map(inst => (
            <InstrumentCard
              key={inst.id}
              instrument={inst}
              onClick={() => setSelected(inst)}
            />
          ))}
        </div>
      )}

      {/* Modal */}
      {selected && (
        <InstrumentModal
          instrument={selected}
          onClose={() => setSelected(null)}
          onRefresh={async () => {
            await fetchInstruments()
            // Refresh selected instrument from latest data
            const { data } = await supabase
              .from('instruments')
              .select('*')
              .eq('id', selected.id)
              .single()
            if (data) setSelected(data)
          }}
        />
      )}
    </>
  )
}

function InstrumentCard({ instrument, onClick }: { instrument: Instrument; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="bg-white rounded-lg border border-gray-200 p-4 text-left hover:shadow-md hover:border-blue-300 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className="text-xs text-gray-400 font-mono">{instrument.instrument_no}</span>
        <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full shrink-0">
          {instrument.category}
        </span>
      </div>
      <p className="font-semibold text-gray-900 text-sm leading-snug mb-3 line-clamp-2">{instrument.name}</p>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-gray-400 truncate">{instrument.location || '—'}</span>
        <StatusBadge status={instrument.status} size="sm" />
      </div>
    </button>
  )
}
