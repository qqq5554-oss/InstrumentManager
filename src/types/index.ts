export interface Instrument {
  id: string
  instrument_no: string
  name: string
  category: '儀器' | '工具'
  model: string | null
  serial_no: string | null
  manufacturer: string | null
  supplier: string | null
  location: string | null
  custodian: string | null
  purchase_date: string | null
  purchase_cost: number | null
  acquisition_method: string | null
  warranty_expiry: string | null
  useful_life: number | null
  depreciation_method: string | null
  calibration_cycle: string | null
  calibration_notes: string | null
  status: 'available' | 'borrowed' | 'reserved' | 'overdue'
  photo_url: string | null
  report_url: string | null
  subcategory: string | null
  is_favorite: boolean
  created_at: string
}

export interface InstrumentCategory {
  id: string
  name: string
  color: string
  sort_order: number | null
  created_at: string
}

export interface Employee {
  id: string
  name: string
  department: string | null
  active: boolean
  username: string | null
  password?: string | null
  role: 'admin' | 'user'
  created_at: string
}

export interface Loan {
  id: string
  instrument_id: string
  employee_id: string | null
  borrower_name: string
  borrow_date: string
  expected_return_date: string
  actual_return_date: string | null
  purpose: string | null
  project_name: string | null
  status: 'borrowed' | 'reserved' | 'returned'
  created_at: string
  instruments?: Pick<Instrument, 'name' | 'instrument_no'>
}
