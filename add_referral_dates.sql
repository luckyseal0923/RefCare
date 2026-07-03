-- 執行以下 SQL 以在 cases 表中新增照護計畫審核與首次服務日期欄位
ALTER TABLE cases ADD COLUMN IF NOT EXISTS care_plan_approved_at DATE;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS first_service_at DATE;
