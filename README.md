# 🏥 Ref_Care 個案安置轉介平台

> 個案安置轉介平台（Referral Care System，簡稱 **Ref_Care**）是一個串接醫療端個案管理人員（起案單位）與長照機構（收案單位）的跨平台媒合系統。本平台旨在將傳統繁瑣的電話與傳真媒合流程數位化，達成即時通知、快速回覆、數據可視化。

---

## 🚀 系統功能架構與核心頁面

本專案為**純靜態前端架構 (Pure Static Frontend)**，邏輯層完全由 Client-side JS 驅動，並透過 Supabase JS CDN 與資料庫雲端動態同步，配合 N8N 進行 LINE 自動化群組通知。

### 1. 🏥 醫療端起案 (`index.html`)
- **使用者**：醫院個管師（Case Manager）、出院準備服務小組。
- **功能**：
  - 個案基本資訊填寫（身高、體重、年齡、性別、診斷、現居地址等）。
  - 功能評估與服務需求（CMS 級別、意識、行動力、特殊需求、BA 長照服務碼別）。
  - **智慧派案模式**：
    - **指定機構**：直接手動勾選欲派發的目標機構。
    - **合作機構 (一輪)**：快速向主力合作的第一圈機構派案。
    - **全區機構 (二輪)**：擴大派案範圍至全市特約機構。
    - **困難派案 (三輪)**：針對極難安置個案，進行跨區大範圍派案。

### 2. 📊 儀表板單一 Demo 頁 (`dashboard.html`)
- **使用者**：個管師、專案 Demo / 提案展示。
- **功能**：靜態預載 `REF-20260330-WF79` (王阿滿個案) 的回覆進度，包含各輪回覆率、機構婉拒原因分析與詳細折線圖，是無資料庫連線時的絕佳簡報工具。

### 3. 🛡️ 高階後臺管理系統 (`admin.html`)
- **使用者**：轉介指揮中心主管、系統管理員。
- **功能**：
  - **今日轉介指揮中心**：即時統計待人工介入、今日新增案件、平均回覆率等指標。
  - **案件清單管理**：追蹤所有進行中/已結案案件，可檢視各輪派案對象的個別回覆時間、回覆備註與婉拒原因，支援匯出 CSV 與批次刪除。
  - **機構與群組維護**：支援新增/修改合作長照機構，並可自訂派案群組（如：北區合作機構、全區機構）以利快速派案。
  - **帳號權限管理**：安全控管登入管理員與個管師之權限等級。
  - **平台問題回報**：檢視來自機構端提交的 BUG 與意見回饋，協助管理員更新維護。

### 4. 📝 機構回覆頁面 (`facility.html`)
- **使用者**：長照機構、居服單位窗口。
- **功能**：
  - 免登入無感體驗：機構窗口透過 LINE 群組發送的連結直接開啟。
  - 完整呈現起案電話、分機、個案 CMS 評估及 BA 服務需求。
  - **快速回覆機制**：
    - **可收案**：自訂最快可服務日期與配合說明。
    - **時段人力需協調**：提報可配合時段供個管師參考。
    - **無法收案**：快選無法接案原因（人力滿載、無適合人力、特約項目限制等）並填寫備註。

---

## 💾 資料庫設定指引 (Supabase SQL Editor)

為使平台正常運作，請至您的 **Supabase Dashboard -> SQL Editor**，依序執行專案資料夾下的 SQL 檔案：

### 1️⃣ 初始化主表：執行 [supabase_schema.sql](file:///d:/Antigravity/Ref_Care/supabase_schema.sql)
這將建立系統所需之核心資料表：
- `cases` (轉介案件主表)
- `replies` (機構回覆紀錄表)
- `facilities` (機構基本資料表)
- `case_managers` (個案管理師清單)

### 2️⃣ 載入預設特約機構：執行 [import_facilities.sql](file:///d:/Antigravity/Ref_Care/import_facilities.sql)
這將自動匯入 73 筆大台北地區之真實/預設長照與居服機構資料（包含簡稱、地址、負責人、電話、評鑑結果、服務區域等）。

### 3️⃣ 補齊聯絡人與 LINE 相關欄位（極重要）
為確保前端網頁能夠成功送出資料，請務必執行以下檔案：
1. **[update_cases_contact.sql](file:///d:/Antigravity/Ref_Care/update_cases_contact.sql)**：
   > [!IMPORTANT]
   > 補齊起案個管師的 `case_manager_phone` (聯絡電話) 與 `case_manager_ext` (單位分機) 欄位。**若未執行此更新，送出案件時會拋出：`Could not find the 'case_manager_ext' column of 'cases' in the schema cache` 錯誤。**
2. **[add_line_columns.sql](file:///d:/Antigravity/Ref_Care/add_line_columns.sql)**：新增機構與案件的 LINE 群組關聯欄位 `line_group_id`。
3. **[update_facilities_columns.sql](file:///d:/Antigravity/Ref_Care/update_facilities_columns.sql)**：建立一輪合作機構與二輪全區調查之篩選旗標。
4. **[create_feedbacks_table.sql](file:///d:/Antigravity/Ref_Care/create_feedbacks_table.sql)** & **[fix_feedbacks_rls.sql](file:///d:/Antigravity/Ref_Care/fix_feedbacks_rls.sql)**：建立平台回報資料表。

---

## 🛠️ 本地開發與啟動步驟

本專案已使用 **Vite** 設定本地開發伺服器，只需簡單指令即可啟動：

### Step 1: 安裝 Vite 開發相依套件
在專案根目錄下打開終端機（Terminal），執行：
```bash
npm install
```

### Step 2: 啟動本地開發伺服器
安裝完成後，執行：
```bash
npm run dev
```
系統會自動在瀏覽器中開啟 `http://localhost:3000`。

### Step 3: 前往各子頁面測試
- **醫療端起案**：`http://localhost:3000/index.html`
- **後台管理系統**：`http://localhost:3000/admin.html`
- **機構回覆頁面**：`http://localhost:3000/facility.html`
- **單案 Demo 儀表板**：`http://localhost:3000/dashboard.html`

---

## 🔗 N8N Webhook 整合 (LINE 自動化通知)

平台已預留 N8N 自動化串接點，您可至以下頁面中的 Webhook 設定區填入您的 N8N Webhook 網址：

### 1. `index.html` (派案成功通知 LINE 群組)
```javascript
const N8N_WEBHOOKS = {
  firstRound: "YOUR_N8N_FIRST_ROUND_WEBHOOK_URL",
  secondRound: "YOUR_N8N_SECOND_ROUND_WEBHOOK_URL",
  coordinate: "YOUR_N8N_COORDINATE_WEBHOOK_URL"
};
```

### 2. `facility.html` (機構回覆時通知個管師)
```javascript
const N8N_WEBHOOKS = {
  facilityReply: "YOUR_N8N_FACILITY_REPLY_WEBHOOK_URL"
};
```

### 3. `admin.html` (更新案件/手動結案通知)
```javascript
const N8N_WEBHOOKS = {
  closeCase: "YOUR_N8N_CLOSE_CASE_WEBHOOK_URL",
  updateCase: "YOUR_N8N_UPDATE_CASE_WEBHOOK_URL"
};
```
