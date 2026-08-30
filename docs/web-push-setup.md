# Web Push 通知設定步驟

前端架構已完成（Service Worker、訂閱流程、Navbar 的「開啟通知」按鈕）。
要讓通知實際運作，還需要以下一次性設定。

## 1. VAPID 金鑰（已產生）

```
Public Key:  BKWXsN943e2pjApIdy81vx2YrbvjsG60snBHSFLVsMUGHLO8GVFkJhKQ_aOBLmNeBhvPXTNTzEcg7VTirxbZCDo
Private Key: oJaJKcSx4S1UGfTzdJZUir9-ceKXiv-L6ihCxMriyos
```

> Private Key 是機密，只放在 Supabase Secrets，不要外流。

## 2. GitHub Secret（前端 build 用）

Repo → Settings → Secrets and variables → Actions → New repository secret

| Name | Value |
|------|-------|
| `VITE_VAPID_PUBLIC_KEY` | 上面的 Public Key |

加完後重新部署一次（推一個 commit 或手動 re-run），前端才會帶入金鑰。

## 3. Supabase Secrets（發送用）

Supabase Dashboard → Edge Functions → Secrets

| Name | Value |
|------|-------|
| `VAPID_PUBLIC_KEY` | 上面的 Public Key |
| `VAPID_PRIVATE_KEY` | 上面的 Private Key |
| `VAPID_SUBJECT` | `mailto:你的email`（選填） |

## 4. 資料表（Supabase → SQL Editor 執行一次）

```sql
create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  endpoint text unique not null,
  p256dh text not null,
  auth text not null,
  employee_id uuid references employees(id) on delete cascade,
  created_at timestamptz default now()
);

alter table push_subscriptions enable row level security;

create policy "anon_all" on push_subscriptions
  for all to anon using (true) with check (true);
```

## 5. Edge Function

Supabase Dashboard → Edge Functions → 建立函式 `send-push`，
內容複製 `supabase/functions/send-push/index.ts`。

## 6. 測試

部署完成後：
1. 在手機把網站「加入主畫面」，開啟後點 Navbar 的「開啟通知」→ 允許
2. 手動呼叫 send-push 測試：

```bash
curl -X POST "https://<你的專案>.supabase.co/functions/v1/send-push" \
  -H "Authorization: Bearer <ANON_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"title":"測試","body":"這是一則測試通知"}'
```

回傳 `{"sent": N, ...}` 且手機收到通知即成功。

## 注意事項

- **iPhone**：必須先「加入主畫面」才能收通知，一般 Safari 分頁收不到（Apple 限制）
- 通知內容與觸發時機（借用/預約/逾期）待後續討論再串接
