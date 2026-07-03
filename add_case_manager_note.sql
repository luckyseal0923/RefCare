-- 執行以下 SQL 以在 replies 表中新增個管師備註欄位
ALTER TABLE replies ADD COLUMN IF NOT EXISTS case_manager_note TEXT;
