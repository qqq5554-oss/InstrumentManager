const NOTIFY_URL = 'https://opgpfkckgilowudgghuf.supabase.co/functions/v1/line-notify'

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
      body: JSON.stringify(params),
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
      body: JSON.stringify({ ...params, bulk: true }),
    })
  } catch {
    // notification failure should not block the main flow
  }
}
