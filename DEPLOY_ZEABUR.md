# RefCare 與 Zeabur Supabase 的連線

網站由 Node.js 提供網頁與資料 API。瀏覽器向同一個網站的 `/api/` 發出請求，後端驗證員編、密碼或案件通行碼後，才連到 Supabase。

## 服務環境變數

| 名稱 | 值或用途 |
| --- | --- |
| SUPABASE_URL | `https://supabase-ref-care.zeabur.app` |
| SUPABASE_SERVICE_ROLE_KEY | 本次自架 Supabase 的 service_role 金鑰，只放後端，不共享 |
| APP_ORIGIN | `https://refcare.zeabur.app` |
| REFCARE_WRITE_ENABLED | 切換準備時 `false`，最後同步及驗證後才改為 `true` |
| REFCARE_NOTIFICATIONS_ENABLED | n8n 工作流程確認後才改為 `true` |

Zeabur 使用根目錄的 Dockerfile 建置，啟動 `node server.cjs`。網站只提供 `dist` 中允許的網頁與靜態檔案；不提供原始碼、SQL、`.env` 或 n8n 匯出檔。

## 切換順序

1. 備份來源資料、目標資料及 n8n 的目前已發布版本。
2. 設定後端環境變數，保持寫入與通知暫停。
3. 暫停來源寫入，比對來源及目標全部原始欄位內容；有差異時先完成同步。
4. 在目標執行 `migrations/20261014_refcare_reply_links.sql`。它只在第一次執行時，標記當時媒合中的舊案件可使用舊連結。
5. n8n 的 Supabase 節點改用本次雲端專案的獨立憑證，通知與催案範本使用後端提供的 `reply_url`。
6. 部署網站，檢查後端健康狀態、登入、資料讀取、舊連結轉址及新連結。
7. 確認後啟用寫入與通知，關閉舊來源的匿名資料權限。

## 新舊案件連結

新案件使用 `facility.html?case_id=...&token=...`。舊案件若在切換當時仍媒合中，可由不帶 token 的原連結轉到該案件的新連結。舊網址不會驗證點擊者身分，因此這只延續這批舊案件的連結存取方式。

案件停止收回覆時，資料庫會撤銷舊連結並更換 token；後續重新開案也必須使用新連結。機構回覆由資料庫交易檢查通行碼、指定機構、案件狀態、重複回覆與困難派案順序。

## 登入與資料權限

保留既有員編與密碼，由後端檢查帳號已啟用。登入憑證使用 HttpOnly、SameSite cookie，後端每次請求重新查核帳號啟用狀態與角色；變更密碼後既有登入失效。

資料庫密碼欄位不回傳瀏覽器。新註冊及變更的密碼使用帶隨機 salt 的 scrypt；搬遷前的舊密碼仍由後端相容驗證。帳號管理、機構維護及資料刪除需要系統管理員權限。原平台中已啟用人員對案件的團隊存取流程保留。

登入後的畫面更新改為每 15 秒讀取一次受保護 API，畫面隱藏時暫停。這個版本沒有把資料庫 Realtime 金鑰交給瀏覽器。

## 驗證

```sh
npm ci
npm test
npm run build
```

`tests/preview.cjs` 只用虛構資料做本機瀏覽器檢查，不連線正式 Supabase，也不發 LINE 訊息。

```sh
node tests/preview.cjs
```

關閉通知不會回滾已儲存的機構回覆。介面會告知回覆已儲存但 LINE 尚未送出，讓使用者能改用人工聯繫。
