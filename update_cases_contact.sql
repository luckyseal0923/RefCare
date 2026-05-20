-- 執行此 SQL 以在 cases (案件主表) 中新增個管師聯絡資訊欄位，以利在機構回覆頁面呈現完整起單資訊。

-- 1. 新增 個管師聯絡電話 欄位
ALTER TABLE cases ADD COLUMN IF NOT EXISTS case_manager_phone TEXT;

-- 2. 新增 單位分機 欄位
ALTER TABLE cases ADD COLUMN IF NOT EXISTS case_manager_ext TEXT;

-- 3. （選填備註）若有歷史舊案，可手動對齊或透過關聯查詢對接
COMMENT ON COLUMN cases.case_manager_phone IS '起案個管師聯絡電話';
COMMENT ON COLUMN cases.case_manager_ext IS '起案個管師單位分機';
