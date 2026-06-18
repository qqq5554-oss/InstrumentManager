import { useState } from 'react'

const BORROW_TERMS = [
  '儀器設備若連續借用超過一週請提前三天協調；若有需延遲歸還請提前告知。',
  '借用期間如有遺失或損壞，借用單位應主動告知，並說明情況。',
  '儀器皆有相關操作手冊及說明，請依指示操作，若要電子檔說明書請向管理部索取。',
]

const RETURN_TERMS = [
  '歸還時請將儀器恢復原狀，消除髒汙等使用痕跡並放回原位。',
  '借用過程如有損壞或異常，請立即向管理部告知，並說明情況。',
]

function TermsModal({ title, terms, confirmLabel, onConfirm, onCancel }: {
  title: string
  terms: string[]
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="p-5 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">{title}</h2>
        </div>
        <div className="p-5">
          <ol className="space-y-3">
            {terms.map((term, i) => (
              <li key={i} className="flex gap-3 text-sm text-gray-700 leading-relaxed">
                <span className="shrink-0 w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center mt-0.5">
                  {i + 1}
                </span>
                {term}
              </li>
            ))}
          </ol>
        </div>
        <div className="px-5 pb-5 flex gap-3">
          <button onClick={onCancel}
            className="flex-1 px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors">
            取消
          </button>
          <button onClick={onConfirm}
            className="flex-1 px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium transition-colors">
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

export function BorrowTermsModal({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return (
    <TermsModal
      title="借用須知"
      terms={BORROW_TERMS}
      confirmLabel="我已閱讀並同意，確認送出"
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  )
}

export function ReturnTermsModal({ onConfirm, onCancel, onReportMalfunction }: {
  onConfirm: () => void
  onCancel: () => void
  onReportMalfunction?: (description: string) => Promise<void>
}) {
  const [showReport, setShowReport] = useState(false)
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleReport = async () => {
    if (!description.trim() || !onReportMalfunction) return
    setSubmitting(true)
    await onReportMalfunction(description.trim())
    setSubmitting(false)
  }

  if (showReport) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
          <div className="p-5 border-b border-gray-100">
            <h2 className="text-lg font-bold text-gray-900">回報儀器異常</h2>
          </div>
          <div className="p-5">
            <p className="text-sm text-gray-600 mb-3">
              送出後儀器狀態將改為「維修中」，並通知管理員處理。
            </p>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="請描述儀器問題，例：螢幕顯示異常，數值跳動不穩定..."
              rows={4}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
            />
          </div>
          <div className="px-5 pb-5 flex gap-3">
            <button onClick={() => setShowReport(false)} disabled={submitting}
              className="flex-1 px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors">
              返回
            </button>
            <button onClick={handleReport} disabled={submitting || !description.trim()}
              className="flex-1 px-4 py-2 text-sm bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-md font-medium transition-colors">
              {submitting ? '送出中...' : '送出回報並歸還'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="p-5 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">歸還須知</h2>
        </div>
        <div className="p-5">
          <ol className="space-y-3">
            {RETURN_TERMS.map((term, i) => (
              <li key={i} className="flex gap-3 text-sm text-gray-700 leading-relaxed">
                <span className="shrink-0 w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center mt-0.5">
                  {i + 1}
                </span>
                {term}
              </li>
            ))}
          </ol>
        </div>
        <div className="px-5 pb-5 space-y-2">
          {onReportMalfunction && (
            <button onClick={() => setShowReport(true)}
              className="w-full px-4 py-2 text-sm text-orange-600 border border-orange-300 rounded-md hover:bg-orange-50 transition-colors font-medium">
              ⚠️ 儀器有損壞或異常？點此回報
            </button>
          )}
          <div className="flex gap-3">
            <button onClick={onCancel}
              className="flex-1 px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors">
              取消
            </button>
            <button onClick={onConfirm}
              className="flex-1 px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium transition-colors">
              我已確認，完成歸還
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
