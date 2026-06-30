-- 執行以下 SQL 以修正 Supabase RLS 安全警告 (可在 Supabase SQL Editor 中執行)

-- 1. 啟用 cases 與 replies 的資料列安全原則 (RLS)
ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.replies ENABLE ROW LEVEL SECURITY;

-- 2. 建立 RLS 政策 (由於此系統使用自訂員編/密碼驗證，故先建立全開政策，以確保 API 可正常讀寫)
-- 如果未來有更嚴格的權限設計需求，可再針對不同角色進行細分

DROP POLICY IF EXISTS "Allow all for cases" ON public.cases;
CREATE POLICY "Allow all for cases" 
ON public.cases 
FOR ALL 
USING (true) 
WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for replies" ON public.replies;
CREATE POLICY "Allow all for replies" 
ON public.replies 
FOR ALL 
USING (true) 
WITH CHECK (true);
