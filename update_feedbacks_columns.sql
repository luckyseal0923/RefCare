-- 新增處理狀態與管理員處理紀錄欄位到 platform_feedbacks 資料表
ALTER TABLE public.platform_feedbacks ADD COLUMN IF NOT EXISTS status TEXT DEFAULT '待處理';
ALTER TABLE public.platform_feedbacks ADD COLUMN IF NOT EXISTS admin_note TEXT DEFAULT '';
