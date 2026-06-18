const NOTIFY_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/line-notify`

const testMode = () => localStorage.getItem('lineTestMode') === 'true'
const withMode = (body: object) => ({ ...body, ...(testMode() && { testMode: true }) })

export async function notifyLineMalfunction(params: {
  borrowerName: string
  instrumentName: string
  instrumentNo: string
  description: string
}) {
  try {
    await fetch(NOTIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(withMode({ ...params, type: 'maintenance' })),
    })
  } catch {
    // notification failure should not block the main flow
  }
}

export async function notifyLineBorrow(params: {
  status: 'borrowed' | 'reserved'
  borrowerName: string
  instrumentName: string
  instrumentNo: string
  projectName: string
  borrowDate: string
  expectedReturn: string
}) {
  try {
    await fetch(NOTIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(withMode(params)),
    })
  } catch {
    // notification failure should not block the main flow
  }
}

export async function notifyLineExtend(params: {
  borrowerName: string
  instrumentName: string
  instrumentNo: string
  newReturnDate: string
  reason: string
}) {
  try {
    await fetch(NOTIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(withMode({ ...params, type: 'extend' })),
    })
  } catch {
    // notification failure should not block the main flow
  }
}

export async function notifyLineBulkBorrow(params: {
  status: 'borrowed' | 'reserved'
  borrowerName: string
  instruments: { name: string; instrument_no: string }[]
  projectName: string
  borrowDate: string
  expectedReturn: string
}) {
  try {
    await fetch(NOTIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(withMode({ ...params, bulk: true })),
    })
  } catch {
    // notification failure should not block the main flow
  }
}
