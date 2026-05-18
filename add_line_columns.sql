-- 執行以下 SQL 以在現有的資料表中新增 LINE 相關欄位

-- 1. 在 facilities (機構表) 中新增個別 LINE 群組 ID 欄位 (可用於指定機構個別通知)
ALTER TABLE facilities ADD COLUMN IF NOT EXISTS line_group_id TEXT;

-- 2. 在 cases (案件表) 中新增目標 LINE 群組 ID 欄位 (紀錄本次發送的群組)
ALTER TABLE cases ADD COLUMN IF NOT EXISTS target_group_line_id TEXT;

-- 3. 在 facility_groups (機構群組表) 中新增 LINE 群組 ID 欄位 (儲存共用大群組 ID)
ALTER TABLE facility_groups ADD COLUMN IF NOT EXISTS line_group_id TEXT;

-- 4. 設定現有群組的 LINE Group ID
UPDATE facility_groups SET line_group_id = 'C7040f72f4cbcf5011c10b745be1a40e6' WHERE name = '北區合作機構';
UPDATE facility_groups SET line_group_id = 'C86cffe2153a124c36c00656ba56dbba1' WHERE name = '全區機構';
