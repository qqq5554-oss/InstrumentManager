import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import type { Instrument, InstrumentCategory } from '../types'
import StatusBadge from '../components/StatusBadge'
import InstrumentModal from '../components/InstrumentModal'
import BulkBorrowModal from '../components/BulkBorrowModal'
import { ReturnTermsModal } from '../components/TermsModal'
import { notifyLineMalfunction } from '../lib/lineNotify'

interface ActiveLoan {
  id: string
  instrument_id: string
  employee_id: string | null
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

const todayStr = () => format(new Date(), 'yyyy-MM-dd')

export default function HomePage() {
  const { currentUser } = useAuth()
  const isAdmin = currentUser?.role === 'admin'
  const [instruments, setInstruments] = useState<Instrument[]>([])
  const [activeLoans, setActiveLoans] = useState<ActiveLoan[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('全部')
  const [selected, setSelected] = useState<Instrument | null>(null)

  const [subcategoryFilter, setSubcategoryFilter] = useState('')
  const [categories, setCategories] = useState<InstrumentCategory[]>([])

  const [multiMode, setMultiMode] = useState(false)
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set())
  const [bulkOpen, setBulkOpen] = useState(false)
  const [favoriteFilter, setFavoriteFilter] = useState(false)
  const [returnTermsLoan, setReturnTermsLoan] = useState<ActiveLoan | null>(null)

  const fetchAll = async () => {
    await supabase.rpc('auto_activate_reservations')
    const [{ data: instData }, { data: loanData }, { data: catData }] = await Promise.all([
      supabase.from('instruments').select('*').order('instrument_no'),
      supabase.from('loans')
        .select('id, instrument_id, employee_id, borrower_name, borrow_date, expected_return_date, status, instruments(name, instrument_no)')
        .in('status', ['borrowed', 'reserved'])
        .order('status')
        .order('borrow_date'),
      supabase.from('instrument_categories').select('*').order('sort_order').order('created_at'),
    ])
    if (instData) setInstruments(instData)
    if (loanData) setActiveLoans(loanData as unknown as ActiveLoan[])
    if (catData) setCategories(catData)
    setLoading(false)
  }

  useEffect(() => {
    fetchAll()
    const handleVisibility = () => { if (document.visibilityState === 'visible') fetchAll() }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [])

  const handleCardReturn = (loan: ActiveLoan) => {
    setReturnTermsLoan(loan)
  }

  const confirmCardReturn = async () => {
    if (!returnTermsLoan) return
    const loan = returnTermsLoan
    setReturnTermsLoan(null)
    const today = todayStr()
    await supabase.from('loans').update({ actual_return_date: today, status: 'returned' }).eq('id', loan.id)
    const { data: remaining } = await supabase.from('loans').select('id')
      .eq('instrument_id', loan.instrument_id)
      .in('status', ['borrowed', 'reserved'])
      .neq('id', loan.id)
    if (!remaining || remaining.length === 0) {
      await supabase.from('instruments').update({ status: 'available' }).eq('id', loan.instrument_id)
    }
    await fetchAll()
  }

  const handleCardMalfunction = async (description: string) => {
    if (!returnTermsLoan || !currentUser) return
    const loan = returnTermsLoan
    setReturnTermsLoan(null)
    const today = todayStr()
    await supabase.from('loans').update({ actual_return_date: today, status: 'returned' }).eq('id', loan.id)
    const { error: instErr } = await supabase.from('instruments').update({ status: 'maintenance' }).eq('id', loan.instrument_id)
    if (instErr) {
      alert('儀器狀態更新失敗：' + instErr.message)
    }
    notifyLineMalfunction({
      borrowerName: currentUser.name,
      instrumentName: loan.instruments?.name ?? '',
      instrumentNo: loan.instruments?.instrument_no ?? '',
      description,
    })
    await fetchAll()
  }

  const filtered = instruments.filter(i => {
    const q = search.toLowerCase()
    const matchSearch = !q || i.name.toLowerCase().includes(q) || i.instrument_no.toLowerCase().includes(q)
    const matchStatus = !statusFilter || i.status === statusFilter
    const matchCat = categoryFilter === '全部' || i.category === categoryFilter
    const matchSubcat = !subcategoryFilter || i.subcategory === subcategoryFilter
    const matchFavorite = !favoriteFilter || i.is_favorite
    return matchSearch && matchStatus && matchCat && matchSubcat && matchFavorite
  })

  const stats = {
    favorites: instruments.filter(i => i.is_favorite).length,
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

  const toggleFavorite = async (inst: Instrument, e: React.MouseEvent) => {
    e.stopPropagation()
    await supabase.from('instruments').update({ is_favorite: !inst.is_favorite }).eq('id', inst.id)
    fetchAll()
  }

  const checkedInstruments = instruments.filter(i => checkedIds.has(i.id))

  const handleStatClick = (value: string) => {
    setStatusFilter(prev => prev === value ? '' : value)
  }

  const statCards = [
    { label: '⭐ 常用儀器', value: stats.favorites, color: 'text-yellow-500', filterVal: 'favorite', activeColor: 'border-yellow-400 bg-yellow-50' },
    { label: '可借用', value: stats.available, color: 'text-green-600', filterVal: 'available', activeColor: 'border-green-400 bg-green-50' },
    { label: '借出中', value: stats.borrowed, color: 'text-red-500', filterVal: 'borrowed', activeColor: 'border-red-400 bg-red-50' },
    { label: '已預約', value: stats.reserved, color: 'text-amber-600', filterVal: 'reserved', activeColor: 'border-amber-400 bg-amber-50' },
  ]

  const today = todayStr()

  return (
    <>
      {/* Stats - clickable */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {statCards.map(s => {
          const isActive = s.filterVal === 'favorite' ? favoriteFilter : statusFilter === s.filterVal
          const handleClick = s.filterVal === 'favorite'
            ? () => setFavoriteFilter(prev => !prev)
            : () => handleStatClick(s.filterVal)
          return (
            <button
              key={s.label}
              onClick={handleClick}
              className={`rounded-lg border p-4 text-center shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-400 cursor-pointer ${
                isActive ? `${s.activeColor} ring-2 ring-offset-1` : 'bg-white border-gray-200 hover:shadow-md hover:border-gray-300'
              }`}
            >
              <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-sm text-gray-500 mt-1">{s.label}</p>
              <p className="text-xs text-gray-400 mt-0.5">{isActive ? '點擊取消篩選' : '點擊篩選'}</p>
            </button>
          )
        })}
      </div>

      {/* Active loans dashboard */}
      {(activeLoans.length > 0 || instruments.some(i => i.status === 'maintenance')) && (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm mb-6 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
            </span>
            <h2 className="text-sm font-semibold text-gray-700">目前使用狀況</h2>
            <span className="text-xs text-gray-400 ml-1">
              {instruments.filter(i => i.status === 'maintenance').length > 0 && `維修中 ${instruments.filter(i => i.status === 'maintenance').length} 件`}
              {instruments.filter(i => i.status === 'maintenance').length > 0 && stats.borrowed > 0 && '、'}
              {stats.borrowed > 0 && `借出中 ${stats.borrowed} 件`}
              {stats.borrowed > 0 && stats.reserved > 0 && '、'}
              {stats.reserved > 0 && `已預約 ${stats.reserved} 件`}
            </span>
          </div>
          <div className="divide-y divide-gray-50 max-h-52 overflow-y-auto">
            {/* 維修中置頂 */}
            {instruments.filter(i => i.status === 'maintenance').map(inst => (
              <div key={inst.id} className="px-4 py-2.5 flex items-center gap-3 text-sm bg-purple-50">
                <span className="shrink-0 px-1.5 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700">維修中</span>
                <span className="font-medium text-gray-800 flex-1 truncate">{inst.name}</span>
                <span className="text-xs text-gray-400 font-mono shrink-0 hidden sm:block">{inst.instrument_no}</span>
              </div>
            ))}
            {/* 逾期置頂，再接一般借出/預約 */}
            {[...activeLoans].sort((a, b) => {
              const aOver = a.expected_return_date < today ? 1 : 0
              const bOver = b.expected_return_date < today ? 1 : 0
              return bOver - aOver
            }).map(loan => {
              const daysOverdue = loan.expected_return_date < today
                ? Math.round((new Date(today).getTime() - new Date(loan.expected_return_date).getTime()) / 86400000)
                : 0
              return (
                <div key={loan.id} className={`px-4 py-2.5 flex items-center gap-3 text-sm ${daysOverdue > 0 ? 'bg-orange-50 hover:bg-orange-100/50' : 'hover:bg-gray-50'}`}>
                  <span className={`shrink-0 px-1.5 py-0.5 rounded text-xs font-medium ${
                    loan.status === 'borrowed' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-700'
                  }`}>
                    {loan.status === 'borrowed' ? '借出中' : '已預約'}
                  </span>
                  {daysOverdue > 0 && (
                    <span className="shrink-0 px-1.5 py-0.5 rounded text-xs font-medium bg-orange-200 text-orange-800">
                      逾期 {daysOverdue} 天
                    </span>
                  )}
                  <span className="font-medium text-gray-800 flex-1 truncate">{loan.instruments?.name || '—'}</span>
                  <span className="text-xs text-gray-400 font-mono shrink-0 hidden sm:block">{loan.instruments?.instrument_no}</span>
                  <span className="text-gray-700 shrink-0 font-medium">{loan.borrower_name}</span>
                  <span className="text-xs text-gray-400 shrink-0 hidden md:block">
                    {loan.borrow_date} → {loan.expected_return_date}
                  </span>
                </div>
              )
            })}
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
              : 'bg-green-600 border-green-600 text-white hover:bg-green-700'
          }`}
        >
          {multiMode ? '取消多選' : '多選借用'}
        </button>
      </div>

      {/* 分類標籤列 */}
      {categories.length > 0 && (
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1 scrollbar-hide">
          <button
            onClick={() => setSubcategoryFilter('')}
            className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors border ${
              !subcategoryFilter
                ? 'bg-gray-800 text-white border-gray-800'
                : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
            }`}
          >
            全部
          </button>
          {categories.map(cat => {
            const count = instruments.filter(i => i.subcategory === cat.name).length
            const isActive = subcategoryFilter === cat.name
            return (
              <button
                key={cat.id}
                onClick={() => setSubcategoryFilter(isActive ? '' : cat.name)}
                className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all border ${
                  isActive ? 'text-white border-transparent' : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                }`}
                style={isActive ? { backgroundColor: cat.color, borderColor: cat.color } : {}}
              >
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: isActive ? 'rgba(255,255,255,0.7)' : cat.color }} />
                {cat.name}
                <span className={`text-xs ${isActive ? 'opacity-75' : 'text-gray-400'}`}>({count})</span>
              </button>
            )
          })}
        </div>
      )}

      {/* Grid */}
      {loading ? (
        <div className="text-center py-20 text-gray-400">載入中...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-gray-400">找不到符合條件的儀器</div>
      ) : (
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
          {filtered.map(inst => {
            const activeLoan = activeLoans.find(l => l.instrument_id === inst.id)
            return (
              <InstrumentCard
                key={inst.id}
                instrument={inst}
                multiMode={multiMode}
                checked={checkedIds.has(inst.id)}
                onCheck={() => toggleCheck(inst.id)}
                onClick={() => !multiMode && setSelected(inst)}
                activeLoan={activeLoan}
                currentUserId={currentUser?.id}
                onReturn={handleCardReturn}
                today={today}
                categories={categories}
                onToggleFavorite={isAdmin ? (e) => toggleFavorite(inst, e) : undefined}
              />
            )
          })}
        </div>
      )}

      {/* Floating bulk action bar */}
      {multiMode && checkedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 bg-gray-900 text-white rounded-full px-6 py-3 flex items-center gap-4 shadow-xl whitespace-nowrap">
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
      {returnTermsLoan && (
        <ReturnTermsModal
          onConfirm={confirmCardReturn}
          onCancel={() => setReturnTermsLoan(null)}
          onReportMalfunction={handleCardMalfunction}
        />
      )}
    </>
  )
}

function InstrumentCard({
  instrument, multiMode, checked, onCheck, onClick, activeLoan, currentUserId, onReturn, today, categories, onToggleFavorite,
}: {
  instrument: Instrument
  multiMode: boolean
  checked: boolean
  onCheck: () => void
  onClick: () => void
  activeLoan?: ActiveLoan
  currentUserId?: string
  onReturn?: (loan: ActiveLoan) => void
  today: string
  categories: InstrumentCategory[]
  onToggleFavorite?: (e: React.MouseEvent) => void
}) {
  const [returning, setReturning] = useState(false)

  const handleReturn = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!activeLoan || !onReturn) return
    setReturning(true)
    await onReturn(activeLoan)
    setReturning(false)
  }

  const isOverdue = activeLoan && activeLoan.expected_return_date < today
  const isBorrowed = instrument.status === 'borrowed' && !isOverdue
  const subcat = categories.find(c => c.name === instrument.subcategory)

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={multiMode ? onCheck : onClick}
      onKeyDown={e => { if (e.key === 'Enter') multiMode ? onCheck() : onClick() }}
      className={`bg-white rounded-lg p-4 text-left transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 ${
        checked ? 'border-2 border-blue-500 ring-2 ring-blue-200'
        : isOverdue ? 'border-2 border-orange-400 hover:shadow-md'
        : isBorrowed ? 'border-2 border-red-400 hover:shadow-md'
        : 'border border-gray-200 hover:shadow-md hover:border-blue-300'
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-1 min-w-0">
          {onToggleFavorite ? (
            <button onClick={onToggleFavorite} className="shrink-0 focus:outline-none hover:scale-110 transition-transform" title={instrument.is_favorite ? '取消常用' : '加入常用'}>
              <StarIcon filled={instrument.is_favorite} />
            </button>
          ) : (
            instrument.is_favorite && <StarIcon filled />
          )}
          <span className="text-xs text-gray-400 font-mono">{instrument.instrument_no}</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {isOverdue && (
            <span className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded font-medium">逾期</span>
          )}
          {instrument.calibration_cycle === '定期校正' && (
            <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">定期校正</span>
          )}
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
      <p className="font-semibold text-gray-900 text-sm leading-snug mb-2 line-clamp-2">{instrument.name}</p>
      {subcat && (
        <div className="mb-2">
          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: subcat.color + '20', color: subcat.color }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: subcat.color }} />
            {subcat.name}
          </span>
        </div>
      )}
      <div className="flex items-end justify-between gap-2">
        <span className="text-xs text-gray-400 truncate">{instrument.location || '—'}</span>
        <div className="flex flex-col items-end gap-1 shrink-0">
          {activeLoan?.employee_id === currentUserId && !multiMode && onReturn && (
            <button
              onClick={handleReturn}
              disabled={returning}
              className="text-xs px-2 py-0.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded font-medium transition-colors"
            >
              {returning ? '...' : '歸還'}
            </button>
          )}
          <div className="flex items-center gap-1.5">
            {activeLoan && !multiMode && (
              <span className="text-xs text-gray-400">{activeLoan.borrower_name}</span>
            )}
            <StatusBadge status={instrument.status} size="sm" />
          </div>
        </div>
      </div>
    </div>
  )
}

function StarIcon({ filled }: { filled?: boolean }) {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24"
      fill={filled ? '#F59E0B' : 'none'}
      stroke={filled ? '#F59E0B' : '#9CA3AF'}
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  )
}
