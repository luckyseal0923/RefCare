-- 建立平台使用狀況回報資料表 (platform_feedbacks)
CREATE TABLE IF NOT EXISTS platform_feedbacks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  facility_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  issue TEXT NOT NULL,
  status TEXT DEFAULT '待處理',
  admin_note TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 開啟資料列安全性 (RLS)
ALTER TABLE platform_feedbacks ENABLE ROW LEVEL SECURITY;

-- 允許任何人讀寫與管理 (All)
CREATE POLICY "Allow all for platform_feedbacks" 
ON platform_feedbacks 
FOR ALL 
USING (true) 
WITH CHECK (true);
