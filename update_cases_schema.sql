-- 執行以下 SQL 以對齊 cases 表的欄位限制
-- 1. 新增身高、體重欄位
ALTER TABLE cases ADD COLUMN IF NOT EXISTS height INTEGER;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS weight INTEGER;

-- 2. 移除不要的聯絡人與氧氣欄位 (精簡資料表)
ALTER TABLE cases DROP COLUMN IF EXISTS contact_name;
ALTER TABLE cases DROP COLUMN IF EXISTS contact_phone;
ALTER TABLE cases DROP COLUMN IF EXISTS oxygen;
