-- 執行以下 SQL 以建立資料表

-- 1. 案件主表
CREATE TABLE cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id TEXT UNIQUE NOT NULL,
  patient_name TEXT,
  hospital TEXT,
  age INTEGER,
  gender TEXT,
  diagnosis TEXT,
  case_summary TEXT,
  mobility TEXT,
  consciousness TEXT,
  oxygen TEXT,
  status TEXT DEFAULT '一輪媒合中',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  contact_name TEXT,
  contact_phone TEXT,
  address TEXT,
  cms_level TEXT,
  service_type TEXT,
  service_time TEXT,
  service_codes JSONB, 
  special_need TEXT,
  case_manager TEXT,
  total_targets INTEGER DEFAULT 0
);

-- 2. 機構回覆表
CREATE TABLE replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id TEXT REFERENCES cases(case_id) ON DELETE CASCADE,
  facility_name TEXT,
  reply_status TEXT, -- accept, reject, pending
  note TEXT,
  round INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. 開放 RLS 權限 (開發環境建議先全開，正式環境需縮減)
ALTER TABLE cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE replies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for cases" ON cases FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for replies" ON replies FOR ALL USING (true) WITH CHECK (true);
