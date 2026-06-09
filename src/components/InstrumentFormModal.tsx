import { useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Instrument } from '../types'

interface Props {
  instrument: Instrument | null
  onClose: () => void
  onSaved: () => void
  onDelete?: () => void
}

type FormData = Omit<Instrument, 'id' | 'created_at'>

const EMPTY: FormData = {
  instrument_no: '',
  name: '',
  category: '儀器',
  model: '',
  serial_no: '',
  manufacturer: '',
  supplier: '',
  location: '',
  custodian: '',
  purchase_date: '',
  purchase_cost: null,
  acquisition_method: '',
  warranty_expiry: '',
  useful_life: null,
  depreciation_method: '',
  calibration_cycle: '',
  calibration_notes: '',
  status: 'available',
}

const toForm = (inst: Instrument): FormData => ({
  instrument_no: inst.instrument_no,
  name: inst.name,
  category: inst.category,
  model: inst.model ?? '',
  serial_no: inst.serial_no ?? '',
  manufacturer: inst.manufacturer ?? '',
  supplier: inst.supplier ?? '',
  location: inst.location ?? '',
  custodian: inst.custodian ?? '',
  purchase_date: inst.purchase_date ?? '',
  purchase_cost: inst.purchase_cost,
  acquisition_method: inst.acquisition_method ?? '',
  warranty_expiry: inst.warranty_expiry ?? '',
  useful_life: inst.useful_life,
  depreciation_method: inst.depreciation_method ?? '',
  calibration_cycle: inst.calibration_cycle ?? '',
  calibration_notes: inst.calibration_notes ?? '',
  status: inst.status,
})

const clean = (v: string | null | undefined) => v?.trim() || null

export default function InstrumentFormModal({ instrument, onClose, onSaved, onDelete }: Props) {
  const [form, setForm] = useState<FormData>(instrument ? toForm(instrument) : EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const set = (field: keyof FormData, value: string) => setForm(f => ({ ...f, [field]: value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!form.instrument_no.trim() || !form.name.trim()) {
      setError('儀器編號與名稱為必填')
      return
    }
    setSaving(true)

    const payload = {
      instrument_no: form.instrument_no.trim(),
      name: form.name.trim(),
      category: form.category,
      model: clean(form.model as string),
      serial_no: clean(form.serial_no as string),
      manufacturer: clean(form.manufacturer as string),
      supplier: clean(form.supplier as string),
      location: clean(form.location as string),
      custodian: clean(form.custodian as string),
      purchase_date: clean(form.purchase_date as string),
      purchase_cost: form.purchase_cost,
      acquisition_method: clean(form.acquisition_method as string),
      warranty_expiry: clean(form.warranty_expiry as string),
      useful_life: form.useful_life,
      depreciation_method: clean(form.depreciation_method as string),
      calibration_cycle: clean(form.calibration_cycle as string),
      calibration_notes: clean(form.calibration_notes as string),
      status: form.status,
    }

    let err
    if (instrument) {
      ;({ error: err } = await supabase.from('instruments').update(payload).eq('id', instrument.id))
    } else {
      ;({ error: err } = await supabase.from('instruments').insert(payload))
    }

    if (err) {
      setError('儲存失敗：' + err.message)
      setSaving(false)
      return
    }

    onSaved()
    onClose()
  }

  const Field = ({ label, field, type = 'text', required = false }: {
    label: string; field: keyof FormData; type?: string; required?: boolean
  }) => (
    <div>
      <label className="block text-xs text-gray-500 mb-1">{label}{required && ' *'}</label>
      <input
        type={type}
        value={(form[field] as string | number) ?? ''}
        onChange={e => set(field, e.target.value)}
        required={required}
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  )

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={e => e.target === e.currentTarget && !saving && onClose()}
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">
            {instrument ? '編輯儀器' : '新增儀器'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1 rounded-md hover:bg-gray-100"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Required */}
          <div className="grid grid-cols-2 gap-4">
            <Field label="儀器編號" field="instrument_no" required />
            <div>
              <label className="block text-xs text-gray-500 mb-1">類別 *</label>
              <select
                value={form.category}
                onChange={e => set('category', e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="儀器">儀器</option>
                <option value="工具">工具</option>
              </select>
            </div>
          </div>

          <Field label="儀器名稱" field="name" required />

          {/* Optional fields */}
          <p className="text-xs text-gray-400 font-medium uppercase tracking-wide pt-1">基本資料</p>
          <div className="grid grid-cols-2 gap-4">
            <Field label="型號廠牌" field="model" />
            <Field label="序號" field="serial_no" />
            <Field label="製造廠商" field="manufacturer" />
            <Field label="供應廠商" field="supplier" />
            <Field label="放置地點" field="location" />
            <Field label="保管人" field="custodian" />
          </div>

          <p className="text-xs text-gray-400 font-medium uppercase tracking-wide pt-1">財務資料</p>
          <div className="grid grid-cols-2 gap-4">
            <Field label="購入日期" field="purchase_date" type="date" />
            <div>
              <label className="block text-xs text-gray-500 mb-1">購入成本</label>
              <input
                type="number"
                step="0.01"
                value={form.purchase_cost ?? ''}
                onChange={e => setForm(f => ({ ...f, purchase_cost: e.target.value ? parseFloat(e.target.value) : null }))}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <Field label="取得方法" field="acquisition_method" />
            <Field label="保固截止日" field="warranty_expiry" type="date" />
            <div>
              <label className="block text-xs text-gray-500 mb-1">耐用年限</label>
              <input
                type="number"
                value={form.useful_life ?? ''}
                onChange={e => setForm(f => ({ ...f, useful_life: e.target.value ? parseInt(e.target.value) : null }))}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <Field label="折舊方法" field="depreciation_method" />
          </div>

          <p className="text-xs text-gray-400 font-medium uppercase tracking-wide pt-1">校正資料</p>
          <div className="grid grid-cols-2 gap-4">
            <Field label="校正週期" field="calibration_cycle" />
            <div>
              <label className="block text-xs text-gray-500 mb-1">狀態</label>
              <select
                value={form.status}
                onChange={e => set('status', e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="available">可借用</option>
                <option value="borrowed">借出中</option>
                <option value="reserved">已預約</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">校正說明 / 操作說明</label>
            <textarea
              value={form.calibration_notes as string ?? ''}
              onChange={e => set('calibration_notes', e.target.value)}
              rows={3}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex items-center justify-between pt-2">
            <div>
              {onDelete && (
                <button
                  type="button"
                  onClick={onDelete}
                  disabled={saving}
                  className="px-4 py-2 text-sm text-red-500 hover:text-red-700 border border-red-200 hover:border-red-300 rounded-md hover:bg-red-50 disabled:opacity-50"
                >
                  刪除儀器
                </button>
              )}
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-md font-medium"
              >
                {saving ? '儲存中...' : instrument ? '儲存變更' : '新增儀器'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
