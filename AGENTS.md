# aestum-web — Aestum 品牌網站

Aestum 的公開品牌網站（`https://aestum.co`）。純 HTML、CSS 與 JavaScript，沒有套件安裝、建置程序或外部字型。結構、品牌色、聯絡管道與發布細節以 `README.md` 為準，本檔只放協作規則。

## 發布與公開性

- 本 repo 為 **public**，以 GitHub Pages 從 `main` 發布。**push 到 main 等於正式上線**，push 前必須取得 Ester 確認，並說明對外可見的變更。
- 不得放入私人財務、客戶名單、內部定價、現職雇主資料或任何未公開資訊。Cloudflare Web Analytics token 是公開前端 token，維持現狀即可。
- 不改 DNS 與 `CNAME`，除非使用者明確要求。

## 內容規則

- 定位與對外文案依 `../aestum-os/WORKFLOW.md` 與 `../aestum-os/biz/positioning.md`：講客戶成果，不講工具清單。
- 中英雙語必須同步修改；新增或修改文案時兩種語言都要處理。
- 應用情境與 AI 摘要是虛構示意資料，不得寫成已部署的客戶成果，也不得取材自現職雇主的系統（邊界見 `../aestum-os/biz/legal-notes.md`）。
- 維持無建置、無外部依賴的架構；不加入後端、登入、金流或追蹤 cookie。
- 品牌色與 logo 處理照 `README.md`，不要重繪 logo。

## 驗證

- 修改後執行 `node scripts/check.mjs`（需要 Node.js 22+ 與 Chrome），回報實際結果。
- 本機預覽：`python -m http.server 8080 --bind 127.0.0.1`，不要把測試 server 暴露到網際網路。

## AI 工具共用方式

- 本檔是 Codex、Claude Code 與其他 AI 工具共用的專案規則；`CLAUDE.md` 僅匯入本檔。修改規則只改本檔。
- 值得跨對話保留的背景、決定與進度寫入 repo 文件；不假設能讀取其他工具的私有記憶或歷史對話。
- 工具名稱不同時，使用目前環境的等效讀檔、搜尋、執行與圖片工具；缺少能力時明說限制。
- `.claude/`、`.codex/` 的權限、hooks 與 MCP 設定各自生效，不能當成另一工具的授權；跨 repo 存取以目前 workspace 權限為準。
