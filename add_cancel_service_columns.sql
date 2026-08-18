-- 執行以下 SQL 以新增取消進場與結案路線欄位 (可在 Supabase SQL Editor 中執行)
ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS close_type TEXT;
ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS cancel_service_reason TEXT;
ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS cancel_service_note TEXT;

COMMENT ON COLUMN public.cases.close_type IS '結案路線類型: 派案進場, 取消進場';
COMMENT ON COLUMN public.cases.cancel_service_reason IS '取消進場主要原因類別: 案家因素, 機構因素, 其他因素';
COMMENT ON COLUMN public.cases.cancel_service_note IS '取消進場原因備註與詳細說明';
