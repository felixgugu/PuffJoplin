# PuffJoplin

PuffJoplin 是一套以 **Go + Wails** 重寫的離線桌面筆記軟體，源自 Joplin 的資料格式與使用經驗。首版專注於 Windows x64 免安裝版，不包含同步、帳號、雲端、E2EE、外掛、AI、OCR 或行動版。

## 功能

- 筆記本、標籤、待辦與垃圾桶
- 多個釘選分頁與單一自動替換的預覽分頁
- 筆記釘選、摘要精簡模式與目錄遞迴瀏覽
- Vditor Markdown 編輯器（即時渲染、所見即所得、分屏預覽）
- 單篇筆記 PDF／自包含 HTML 匯出，PDF 保留可選文字與標題書籤
- 剪貼簿圖片、拖放檔案與工具列附件會存到本機 `data/resources/`
- SQLite FTS5 全文搜尋
- 附件、圖片與本機檔案開啟
- 匯入 Joplin profile、JEX、ENEX 與 Markdown
- 匯出 JEX 與 Markdown
- 可攜式資料目錄與單一實例保護
- 深色／亮色主題

所有筆記資料都保存在 `PuffJoplin.exe` 同層的 `data/`。移動整個程式資料夾即可一併搬移筆記。

`data/` 保存筆記資料庫、附件與程式日誌；WebView2 的 cache、Local Storage 與 GPU cache 則使用 Windows 的 `%APPDATA%\PuffJoplin.exe`。

Vditor 的 CSS、JavaScript、圖示與語言檔會在建置時複製到 `frontend/public/vditor/` 並內嵌到程式，執行時不需要連線 CDN。

## 開發

需求：

- Windows 10/11 x64
- Go 1.24 以上
- Node.js 22 以上
- Wails CLI v2.17
- Microsoft Edge WebView2 Runtime

```powershell
go install github.com/wailsapp/wails/v2/cmd/wails@v2.17.0
npm --prefix frontend install
wails dev
```

## 測試與建置

```powershell
npm run test:all
npm run build
```

免安裝程式輸出於 `build/bin/PuffJoplin.exe`。要製作可攜壓縮檔，可將 exe 放入空的 `PuffJoplin/` 資料夾後壓縮；首次啟動會在 exe 旁建立 `data/`。

## Joplin 資料匯入

首次啟動時，PuffJoplin 會自動偵測 Joplin profile，顯示筆記、筆記本、附件與加密筆記數量，再由使用者按下「匯入 Joplin 筆記」。也可以在「設定與資料」中隨時手動匯入。預設偵測位置包含：

```text
%USERPROFILE%\.config\joplin-desktop
```

匯入過程以唯讀方式讀取來源資料庫，並在交易中寫入 PuffJoplin 自己的 SQLite。來源 Joplin profile 不會被修改。選擇「稍後」後不會再次主動提示，但仍可從設定手動匯入。加密或 note-lock 筆記不在首版支援範圍，匯入報告會列出被略過的項目。

## 資料位置

```text
PuffJoplin.exe
data/
  puffjoplin.sqlite
  resources/
  logs/
```

程式不允許兩個實例同時操作同一份資料。若程式目錄不可寫入，請將整個 portable 資料夾移到使用者可寫入的位置。舊版遺留的 `data/webview` 不再使用，可在程式關閉後刪除。

## 授權與來源

PuffJoplin 是 Joplin 的 fork，依 AGPL-3.0-or-later 授權發佈。原始 Joplin 專案：<https://github.com/laurent22/joplin>。完整授權條文請見 [LICENSE](LICENSE)。
