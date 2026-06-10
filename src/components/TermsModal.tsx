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

export function ReturnTermsModal({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return (
    <TermsModal
      title="歸還須知"
      terms={RETURN_TERMS}
      confirmLabel="我已確認，完成歸還"
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  )
}
