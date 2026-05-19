-- 1. 刪除原有對 platform_feedbacks 的限制性政策
DROP POLICY IF EXISTS "Allow anonymous insert platform_feedbacks" ON public.platform_feedbacks;
DROP POLICY IF EXISTS "Allow authenticated full access platform_feedbacks" ON public.platform_feedbacks;
DROP POLICY IF EXISTS "Allow anonymous insert to platform_feedbacks" ON public.platform_feedbacks;
DROP POLICY IF EXISTS "Allow authenticated full access to platform_feedbacks" ON public.platform_feedbacks;

-- 2. 建立與 cases, replies 相同權限級別的 Allow all 政策
-- 這可以讓自訂帳號密碼登入（匿名請求）的後台管理系統正常讀取、更新回報資料與處理狀態
CREATE POLICY "Allow all for platform_feedbacks" 
ON public.platform_feedbacks 
FOR ALL 
USING (true) 
WITH CHECK (true);
