-- 執行以下 SQL 以新增媒合失敗原因欄位 (可在 Supabase SQL Editor 中執行)
ALTER TABLE cases ADD COLUMN IF NOT EXISTS match_failed_reason TEXT;
