-- 為 cases 資料表新增困難派案半自動發送隊列相關欄位
ALTER TABLE public.cases 
ADD COLUMN IF NOT EXISTS target_facility_queue JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS current_queue_index INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS queue_status TEXT DEFAULT 'WAITING_REPLY';

-- 註解說明
COMMENT ON COLUMN public.cases.target_facility_queue IS '困難派案機構發送隊列 [{id, name, line_group_id}]';
COMMENT ON COLUMN public.cases.current_queue_index IS '目前輪到第幾家 (從 0 開始)';
COMMENT ON COLUMN public.cases.queue_status IS '發送狀態: WAITING_REPLY(待回覆), PAUSED_PARTIAL(暫停待人工確認), MATCHED(媒合成功), ENDED(發送結束)';
