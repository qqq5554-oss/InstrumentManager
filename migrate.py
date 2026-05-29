"""
migrate.py - 將 Excel 儀器資料匯入 Supabase

使用方式：
  pip install pandas openpyxl requests
  python migrate.py

注意：使用 service_role key（繞過 RLS），請勿洩漏。
"""

import pandas as pd
import requests
import json

SUPABASE_URL = "your_supabase_url"
SUPABASE_KEY = "your_service_role_key"  # service_role key，非 anon key
HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=minimal",
}

EXCEL_FILE = "FMS匯出_儀器工具明細_20260312.xlsx"


def parse_date(val):
    if pd.isna(val):
        return None
    try:
        return pd.to_datetime(val).strftime("%Y-%m-%d")
    except Exception:
        return None


def parse_float(val):
    if pd.isna(val):
        return None
    try:
        return float(val)
    except Exception:
        return None


def parse_int(val):
    if pd.isna(val):
        return None
    try:
        return int(val)
    except Exception:
        return None


def str_or_none(val):
    if pd.isna(val):
        return None
    s = str(val).strip()
    return s if s else None


df = pd.read_excel(EXCEL_FILE, sheet_name=0)
print(f"讀取 {len(df)} 筆資料，欄位：{list(df.columns)}")

records = []
for _, row in df.iterrows():
    instrument_no = str_or_none(row.get("儀器編號"))
    name = str_or_none(row.get("儀器名稱"))
    if not instrument_no or not name:
        continue

    category = str_or_none(row.get("類別")) or "儀器"
    if category not in ("儀器", "工具"):
        category = "儀器"

    records.append({
        "instrument_no": instrument_no,
        "name": name,
        "category": category,
        "model": str_or_none(row.get("型號廠牌")),
        "serial_no": str_or_none(row.get("序號")),
        "manufacturer": str_or_none(row.get("製造廠商")),
        "supplier": str_or_none(row.get("供應廠商")),
        "location": str_or_none(row.get("放置地點")),
        "custodian": str_or_none(row.get("保管人")),
        "purchase_date": parse_date(row.get("購入日期")),
        "purchase_cost": parse_float(row.get("購入成本")),
        "acquisition_method": str_or_none(row.get("取得方法")),
        "warranty_expiry": parse_date(row.get("保固截止日")),
        "useful_life": parse_int(row.get("耐用年限")),
        "depreciation_method": str_or_none(row.get("折舊方法")),
        # 校正週期有兩欄，取 index 22 的 '校正週期.1'（值較完整）
        "calibration_cycle": str_or_none(row.get("校正週期.1") or row.get("校正週期")),
        "calibration_notes": str_or_none(row.get("校正說明")),
        "status": "available",
    })

print(f"準備匯入 {len(records)} 筆")

# 批次匯入（每次 100 筆）
BATCH = 100
for i in range(0, len(records), BATCH):
    batch = records[i:i + BATCH]
    resp = requests.post(
        f"{SUPABASE_URL}/rest/v1/instruments",
        headers=HEADERS,
        data=json.dumps(batch),
    )
    if resp.status_code in (200, 201):
        print(f"  [{i+1}~{min(i+BATCH, len(records))}] 匯入成功")
    else:
        print(f"  [{i+1}~{min(i+BATCH, len(records))}] 失敗：{resp.status_code} {resp.text[:200]}")

print("完成")
