# OrchidTea 自用修正版

來源：[ha810505ha/tavern-ledger](https://github.com/ha810505ha/tavern-ledger)，基準 commit `c34f85f94849ca4678969067c7c5489a64db242e`。保留原作者與 MIT 授權。

## 修正範圍

將 index.js 三處直接呼叫 crypto.randomUUID() 改為共用 UUID helper：原生 randomUUID → getRandomValues 產生 UUID v4 → 無 Web Crypto 時的一般隨機 UUID 備援。最後一層只適用於帳本識別碼，不用於密碼或安全憑證。不修改瀏覽器全域 crypto，也不依賴 SillyTavern 內部工具的相對路徑。

此修正避免 LAN / Tailscale HTTP 缺少 randomUUID 時，插件在送出 /api/backends/chat-completions/generate 前拋出例外，以及回覆／候選訊息無法建立識別碼。

manifest、插件名稱、tavern_ledger 設定鍵、訊息的 tavern_ledger_id 與 extra.tavern_ledger、schema_version 2 均保持原樣。資料仍經由 SillyTavern 使用者檔案 API 存入 tavern-ledger-v2.json；不使用 localStorage 或瀏覽器資料庫。既有 ID 不會重新產生。

## 安裝／切換

新安裝：在 SillyTavern「擴充功能 → 安裝擴充功能」貼上 https://github.com/OrchidTea/tavern-ledger ，完成後重新整理。

已有原版：先從帳本匯出 JSON 備份。建議在現有 tavern-ledger 安裝目錄切換 Git 來源（先以 git status 確認沒有尚未保存的本機修改）：

```sh
git remote rename origin upstream
git remote add origin https://github.com/OrchidTea/tavern-ledger.git
git fetch origin
git merge --ff-only origin/main
git branch --set-upstream-to=origin/main main
```

若已有 upstream，保留正確的原作者來源即可，不要重複 rename。若快轉失敗或有本機修改，先處理差異，不要強制重設。重新整理 SillyTavern；避免同時載入原版與 fork 兩份插件。後續擴充功能更新會跟隨此 fork。此工作未直接操作你的 NAS。

## 同步原作者

GitHub 的 Sync fork 可在沒有衝突時合併更新；不要使用會丟棄自用修改的操作。或在維護用的 clone 執行：

```sh
git remote add upstream https://github.com/ha810505ha/tavern-ledger.git
# upstream 已存在時，省略上一行
git fetch upstream
git switch main
git merge upstream/main
npm test
npm run check
git push origin main
```

有衝突時保留或重新評估 UUID 修正，通過測試後再推送。SillyTavern 更新與此 fork 同步分開進行；未來若其 API 改變仍需重新檢查相容性。

## 驗證

26 項 Node 測試通過，包含原有測試、原生 UUID、HTTP 缺少 randomUUID、完全沒有 Web Crypto、原生方法 receiver，以及以模擬 SillyTavern context 驗證真實 collector 函式會送出請求並連結訊息／候選 ID，續寫保留既有 ID。語法檢查通過。尚未在使用者 NAS 上進行實機聊天驗證；測試沒有呼叫付費模型。
