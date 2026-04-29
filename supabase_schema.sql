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

-- 4. 機構基本資料表
CREATE TABLE facilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seq_no INTEGER,
  short_name TEXT,
  facility_name TEXT,
  address TEXT,
  establishment_date TEXT,
  license_number TEXT,
  responsible_person TEXT,
  phone TEXT,
  fax TEXT,
  self_pay_services TEXT,
  evaluation_result TEXT,
  service_area TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE facilities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for facilities" ON facilities FOR ALL USING (true) WITH CHECK (true);


-- 個管師名單
CREATE TABLE IF NOT EXISTS public.case_managers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    hospital TEXT NOT NULL,
    ext TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);
ALTER TABLE public.case_managers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anonymous read case_managers" ON public.case_managers FOR SELECT USING (true);
CREATE POLICY "Allow anonymous insert case_managers" ON public.case_managers FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anonymous update case_managers" ON public.case_managers FOR UPDATE USING (true);
CREATE POLICY "Allow anonymous delete case_managers" ON public.case_managers FOR DELETE USING (true);
