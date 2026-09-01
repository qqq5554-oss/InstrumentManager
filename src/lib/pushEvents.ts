import { supabase } from './supabase'

// 觸發一個規則型通知事件（實際是否發送、發給誰、內容，由後台「通知管理」設定決定）
export async function notifyEvent(
  eventKey: string,
  opts: { employeeIds?: string[]; vars?: { instrument?: string; borrower?: string; reserver?: string; description?: string } } = {},
): Promise<void> {
  try {
    await supabase.functions.invoke('notify-event', {
      body: { event_key: eventKey, ...opts },
    })
  } catch {
    // 通知失敗不影響主流程
  }
}
