import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Instrument } from '../types'
import StatusBadge from '../components/StatusBadge'
import InstrumentFormModal from '../components/InstrumentFormModal'

export default function AdminPage() {
  const [instruments, setInstruments] = useState<Instrument[]>([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Instrument | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Instrument | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchInstruments = async () => {
    const { data } = await supabase
      .from('instruments')
      .select('*')
      .order('instrument_no')
    if (data) setInstruments(data)
    setLoading(false)
  }

  useEffect(() => { fetchInstruments() }, [])

  const handleDelete = async () => {
    if (!confirmDelete) return
    setDeleting(true)
    await supabase.from('instruments').delete().eq('id', confirmDelete.id)
    await fetchInstruments()
    setConfirmDelete(null)
    setDeleting(false)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-2xl font-bold text-gray-900">管理後台</h1>
        <button
          onClick={() => { setEditing(null); setFormOpen(true) }}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
        >
          + 新增儀器
        </button>
      </div>

      {loading ? (
        <div className="text-center py-20 text-gray-400">載入中...</div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['編號', '類別', '名稱', '型號', '放置地點', '保管人', '校正週期', '狀態', '操作'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {instruments.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-10 text-center text-gray-400">尚無儀器資料</td>
                  </tr>
                ) : instruments.map(inst => (
                  <tr key={inst.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{inst.instrument_no}</td>
                    <td className="px-4 py-3">
                      <span className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full">{inst.category}</span>
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900 max-w-48 truncate">{inst.name}</td>
                    <td className="px-4 py-3 text-gray-500">{inst.model || '—'}</td>
                    <td className="px-4 py-3 text-gray-500">{inst.location || '—'}</td>
                    <td className="px-4 py-3 text-gray-500">{inst.custodian || '—'}</td>
                    <td className="px-4 py-3 text-gray-500">{inst.calibration_cycle || '—'}</td>
                    <td className="px-4 py-3"><StatusBadge status={inst.status} size="sm" /></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => { setEditing(inst); setFormOpen(true) }}
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                        >
                          編輯
                        </button>
                        <button
                          onClick={() => setConfirmDelete(inst)}
                          className="text-xs text-red-500 hover:text-red-700 font-medium"
                        >
                          刪除
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Form Modal */}
      {formOpen && (
        <InstrumentFormModal
          instrument={editing}
          onClose={() => { setFormOpen(false); setEditing(null) }}
          onSaved={fetchInstruments}
        />
      )}

      {/* Delete Confirm Dialog */}
      {confirmDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={e => e.target === e.currentTarget && !deleting && setConfirmDelete(null)}
        >
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">確認刪除</h3>
            <p className="text-sm text-gray-600 mb-4">
              確定要刪除「{confirmDelete.name}」嗎？此操作無法復原，相關借用紀錄也會一併刪除。
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirmDelete(null)}
                disabled={deleting}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-md"
              >
                取消
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-md font-medium"
              >
                {deleting ? '刪除中...' : '確認刪除'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
