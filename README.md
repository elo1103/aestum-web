# Aestum Website

Aestum 品牌網站第一版。純 HTML、CSS 與 JavaScript，無套件安裝、建置程序或外部字型。

## 本機預覽

Windows 可雙擊 `open-preview.cmd`；或直接用瀏覽器開啟 `index.html`，包括情境切換與備料試算。

也可在本資料夾執行：

```powershell
python -m http.server 8080 --bind 127.0.0.1
```

接著開啟 `http://127.0.0.1:8080`。使用 `?lang=en` 或 `?lang=zh` 指定語言。

## 內容

- `index.html`：中英文首頁、四個應用情境、免費工具、合作方式、經歷與聯絡。
- `material-check.html` / `material-check.js`：單一工單備料檢查，支援輸入驗證、CSV 匯出與列印。
- `privacy.html`：目前網站實際資料處理方式。
- `site.js`：語言、導覽、情境頁籤、聯絡郵件草稿。
- `styles.css`：共用視覺、響應式與列印樣式。
- `assets/material-readiness-template.csv`：含虛構資料的雙語欄位範本，無公式；可下載自行使用。

## 品牌圖檔

導覽列、頁尾與示意工作台沿用既有 Aestum `AES / TUM` 深藍透明版 logo。`assets/aestum-logo.png` 與 `automatter-lab-os/assets/aestum-logo-grid-rounded-frame-extra-tight-semibold-navy-knockout-transparent.png` 完全相同，未重繪、改色或變更字距。CSS 僅在顯示時略去外圍透明留白。網站主色使用與 logo 相同的 `#17324D`，避免原本鮮亮藍色與深藍標誌並列時的視覺落差。`favicon.svg` 內嵌同一份 PNG，避免依賴外部圖檔。

## 使用邊界

- 四個情境是虛構資料的示意，AI 摘要是預寫內容；不代表已部署的客戶成果。
- 免費工具不串接庫存或 ERP。資料僅留在目前頁面的記憶體，重新整理即清除。
- 數量以每列相同單位計算，最多 6 位小數、單值上限十億。保留量僅指其他工單的保留；超過現有量時需核對，不能直接當作可用量。
- 到貨日期不增加現有量；數量足夠不代表品質、規格或開工條件已確認。
- CSV 匯出為留存快照，不支援重新匯入；文字欄位有基本試算表公式注入防護。
- 聯絡表單開啟 `mailto:` 草稿，不會代替使用者寄信。未加入分析追蹤、登入、購物車、金流或後端。

## 驗證

需要 Node.js 22+ 及 Chrome；Windows 預設使用 `C:/Program Files/Google/Chrome/Application/chrome.exe`，其他環境可指定 `CHROME_PATH`。

```powershell
node scripts/check.mjs
```

檢查本機連結、雙語、桌機與行動版溢出、頁籤鍵盤操作、郵件草稿、備料計算、無效輸入、到貨狀態、CSV 實際下載、切換語言後資料保留與直接開 HTML。截圖與測試下載寫入系統暫存目錄。

## 發布

目前為本機可預覽版本，尚未部署到公開網址。可部署至支援靜態 HTML 的網站代管服務；正式上線前確認網址、對外文案、聯絡信箱，以及免費資源的發放安排。不要將測試用 HTTP server 暴露到網際網路。

個人網站 `ELO_web` 另行維護，未被此專案修改。
