-- 執行以下 SQL 以更新資料表 (可在 Supabase SQL Editor 中執行)

-- 1. 新增 approved 欄位 (布林值，預設為 false)
ALTER TABLE public.case_managers ADD COLUMN IF NOT EXISTS approved BOOLEAN DEFAULT false;

-- 2. 新增 email 欄位 (文字類型)
ALTER TABLE public.case_managers ADD COLUMN IF NOT EXISTS email TEXT;

-- 3. 將現有的管理員或個管師帳號自動設為已啟用 (避免現有使用者無法登入)
UPDATE public.case_managers SET approved = true WHERE approved IS NULL OR name = '系統管理員' OR role = '系統管理員';
