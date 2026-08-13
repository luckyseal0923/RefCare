-- 執行以下 SQL 以新增媒合成功狀態備註欄位 (可在 Supabase SQL Editor 中執行)
ALTER TABLE cases ADD COLUMN IF NOT EXISTS matched_note TEXT;
