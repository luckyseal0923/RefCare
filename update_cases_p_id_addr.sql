-- 增加身分證字號與結構化地址欄位
ALTER TABLE cases ADD COLUMN IF NOT EXISTS patient_id TEXT;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS address_detail JSONB;

-- 新增欄位備註，方便資料庫維護
COMMENT ON COLUMN cases.patient_id IS '個案身分證字號';
COMMENT ON COLUMN cases.address_detail IS '個案結構化現居地址';
