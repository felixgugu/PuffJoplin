# PuffJoplin UI 區塊命名

本文件定義 PuffJoplin 桌面介面的統一區塊名稱。與使用者討論、撰寫需求、程式註解與測試名稱時，應優先使用這些名稱。

## 全域版面

```
應用標題列
├─ 左側導覽欄 │ 拖曳把手 │ 筆記清單欄 │ 拖曳把手 │ 筆記編輯區
```

| 統一稱呼 | 程式對應 | 說明 |
|---|---|---|
| 應用標題列 | `.window-titlebar` | 視窗最上方的一列，包含目前位置、搜尋、佈景、設定與視窗控制鈕。 |
| 左側導覽欄 | `.sidebar` | 最左側的筆記本／標籤導覽區域。 |
| 筆記清單欄 | `.note-list-panel` | 中間的筆記卡片清單。 |
| 筆記編輯區 | `.editor-panel` | 右側的筆記標題、混合 Markdown 編輯器與底部狀態列。 |

## 應用標題列

| 統一稱呼 | 程式對應 | 說明 |
|---|---|---|
| 目前位置 | `.titlebar-context` | 顯示目前檢視名稱與筆記數。 |
| 全域搜尋框 | `.titlebar-search` | 搜尋全部筆記。 |
| 搜尋範圍 | `.titlebar-search-scope` | 切換「全部筆記本」或「目前目錄含子目錄」。 |
| 佈景按鈕 | `.titlebar-tool` 的第一個按鈕 | 切換深色／亮色模式。 |
| 設定按鈕 | `.titlebar-tool` 的設定按鈕 | 開啟「設定」視窗。 |
| 視窗控制區 | `.window-actions` | 最小化、最大化／還原、關閉。 |

## 左側導覽欄

| 統一稱呼 | 程式對應 | 說明 |
|---|---|---|
| 側欄頂列 | `.sidebar-head` | 左側導覽最上方的單列控制，不使用品牌標誌或名稱。 |
| 主要導覽 | `.nav-section` | 單行圖示列，包含「全部筆記」、「待辦」與「垃圾桶」。 |
| 待辦檢視 | 主要導覽的「待辦」按鈕 | 跨筆記本顯示待辦筆記，不改變筆記所屬筆記本。 |
| 導覽分頁列 | `.sidebar-tabs` | 在「筆記本」與「標籤」分頁之間切換。 |
| 筆記本樹 | `.notebook-tab-content`、`.notebook-row` | 階層式筆記本與展開／收合控制；文字使用主要字級 `1rem`。 |
| 新增或開啟筆記本選單 | `.new-notebook-picker`、`.new-notebook-menu` | 從筆記本分頁的「＋」開啟，可新增一般筆記本或直接管理 Markdown 目錄。 |
| 直接管理筆記本 | `.notebook-row.is-managed` | 對應磁碟上的實體目錄；根目錄與子目錄會同步成筆記本樹。 |
| 標籤雲 | `.tag-cloud`、`.tag-chip` | 左側「標籤」分頁內的標籤按鈕。 |
| 收合導覽列 | `.rail-nav` | 左側導覽欄收合後顯示的圖示列。 |

## 筆記清單欄

| 統一稱呼 | 程式對應 | 說明 |
|---|---|---|
| 筆記清單 | `.note-list` | 目前檢視下的筆記卡片集合。 |
| **筆記清單工具列** | `.note-list-header` | 筆記清單上方的排序、摘要、定位與新增筆記控制。 |
| 排序方式 | `.note-sort-select` | 選擇字母、新增日期或修改日期；待辦檢視另提供到期日。 |
| 排序方向 | `.note-sort-direction` | 切換正序或倒序。 |
| 待辦狀態篩選 | `.todo-status-filter` | 在待辦檢視切換「未完成」、「已完成」或「全部」。 |
| 筆記摘要切換 | `.toggle-note-summary-button` | 顯示或隱藏摘要；隱藏後卡片只留標題與釘選。 |
| 定位筆記本按鈕 | `.locate-notebook-button` | 展開筆記本樹並切換到目前筆記的目錄。 |
| 新增筆記按鈕 | `.new-note-button` | 在目前筆記本新增筆記。 |
| 筆記卡片 | `.note-card` | 單篇筆記的標題、摘要、日期、標籤與附件數。 |
| 待辦勾選框 | `.todo-checkbox` | 筆記卡片左側的完成狀態切換；只出現在待辦筆記。 |
| 待辦到期標籤 | `.todo-due-badge` | 筆記卡片上的到期、今天到期或逾期提示。 |
| 釘選筆記按鈕 | `.pin-note-button` | 將筆記釘選至清單最上方，不受排序與方向影響。 |
| 筆記拖曳 | `.note-card[draggable="true"]` | 將筆記拖到筆記本樹以變更目錄。 |
| 筆記本放置目標 | `.notebook-row.drop-target` | 拖曳筆記時可接受的筆記本目錄。 |
| 空清單提示 | `.empty-list` | 沒有筆記或搜尋無結果時顯示。 |
| **筆記卡片右鍵選單** | `.note-context-menu` | 筆記卡片右鍵操作；實體 Markdown 筆記另有複製檔案路徑與檔案總管定位。 |

## 筆記編輯區

| 統一稱呼 | 程式對應 | 說明 |
|---|---|---|
| 垃圾桶提示列 | `.trash-banner` | 筆記位於垃圾桶時顯示還原／永久刪除。 |
| **筆記分頁列** | `.editor-tabs` | 編輯區最上方的已開啟筆記分頁。 |
| 釘選分頁 | `.editor-tab.is-pinned` | 永久保留的多個筆記分頁。 |
| 預覽分頁 | `.editor-tab.is-preview` | 唯一未釘選分頁，開啟其他未釘選筆記時被替換。 |
| 分頁釘選按鈕 | `.editor-tab-pin` | 釘選或取消釘選分頁。 |
| 分頁關閉按鈕 | `.editor-tab-close` | 關閉釘選分頁；預覽分頁不顯示。 |
| **筆記標題列** | `.editor-heading` | 編輯區上方固定單列。包含筆記路徑、名稱、匯出與待辦操作。 |
| 收合筆記清單按鈕 | `.collapse-note-list-button` | 筆記標題列最前方的雙向控制；完全隱藏或恢復筆記清單。 |
| 筆記路徑 | `.editor-breadcrumbs` | 「筆記本 / 筆記名稱 (儲存狀態)」的整體。 |
| 完整筆記路徑 | `.note-path-label` | 顯示從根目錄到目前筆記本的完整路徑，不可直接下拉切換。 |
| 筆記名稱 | `.title-input` | 可直接編輯的單行筆記標題。 |
| 筆記操作區 | `.editor-heading-actions` | 筆記標題列右側的匯出與待辦操作群組。 |
| 匯出按鈕 | `.export-action-button` | 開啟目前筆記的格式匯出選單。 |
| 匯出選單 | `.editor-export-menu` | 選擇 PDF、HTML、Markdown、DOCX、Mermaid SVG 或 Mermaid PNG。 |
| Mermaid SVG | `.editor-export-menu` 的 `Mermaid SVG` | 將目前筆記的所有 Mermaid 圖表匯出為 SVG；筆記沒有 Mermaid fence 時停用。 |
| Mermaid PNG | `.editor-export-menu` 的 `Mermaid PNG` | 將目前筆記的所有 Mermaid 圖表匯出為 PNG；筆記沒有 Mermaid fence 時停用。 |
| 待辦按鈕 | `.todo-action-button` | 轉為待辦、標記完成或標記未完成。 |
| 混合 Markdown 編輯器 | `.editor-main` | 原始碼模式使用 CodeMirror 6；IR、WYSIWYG 與預覽使用 Vditor。 |
| Vditor 編輯器 | `.vditor-editor-host` | 提供 IR、WYSIWYG、預覽與共用工具列。 |
| 原始碼編輯器 | `.puff-codemirror-source` | Vditor 原始碼模式中實際使用的 CodeMirror 6 編輯區。 |
| 原始碼行號 | `.cm-gutters`、`.cm-lineNumbers` | CodeMirror 原始碼模式左側的行號；可在設定視窗的「原始碼行號」開關切換。 |
| 原始碼折疊控制 | `.cm-foldGutter`、`.puff-fold-marker` | 在可折疊的 Markdown 標題、清單、引用、程式碼與表格左側顯示收合／展開按鈕。 |
| 原始碼折疊佔位符 | `.cm-foldPlaceholder` | 內容折疊後顯示的膠囊狀省略標記，點擊可展開。 |
| 編輯工具列 | `.vditor-toolbar` | 標題、粗體、清單、附件、復原、模式切換等工具。 |
| 上一頁按鈕 | `.vditor-toolbar` 的 `page-prev` | 將目前筆記內容向上捲動約一個可視頁面；快捷鍵為 `Alt+←`。 |
| 下一頁按鈕 | `.vditor-toolbar` 的 `page-next` | 將目前筆記內容向下捲動約一個可視頁面；快捷鍵為 `Alt+→`。 |
| 文字顏色按鈕 | `.vditor-toolbar` 的 `text-color` | 開啟 16 色文字顏色面板。 |
| 文字顏色面板 | `.editor-text-color-palette` | 16 色色盤與「恢復預設色」操作。 |
| 顏色色票 | `.text-color-swatch` | 單一常用文字顏色按鈕。 |
| 分割預覽把手 | `.puff-preview-splitter` | Both 模式左右編輯／預覽的垂直拖曳分隔線。 |
| Vditor 自訂捲軸 | `.puff-editor-scrollbar` | 編輯區與預覽區的 overlay 垂直捲軸軌道。 |
| Vditor 捲軸拇指 | `.puff-editor-scrollbar-thumb` | 最短 52px 的自訂捲軸拖曳把手。 |
| 筆記內容區 | `.vditor-content` | IR／所見即所得由 Vditor 顯示，原始碼由 CodeMirror 顯示的共用書寫區域。 |
| **筆記內搜尋面板** | `.editor-find-panel` | 筆記編輯區右上方的搜尋與取代浮動面板，支援 CodeMirror 與 Vditor 模式。 |
| 搜尋列 | `.editor-find-row`、`.editor-find-field` | 搜尋字串、符合數、大小寫、全字匹配與結果導覽。 |
| 取代列 | `.editor-find-row.replace-row` | 取代文字、取代目前與全部取代。 |
| 搜尋結果標記 | `::highlight(puffjoplin-find-match)` | 所有符合文字的淡色標記。 |
| 目前搜尋結果 | `::highlight(puffjoplin-find-active)` | 目前導覽結果的強調色標記。 |
| **圖稿右鍵選單** | `.editor-media-context-menu` | 本機圖片與 Mermaid 圖表的複製影像／檔案選單。 |
| **筆記底部列** | `.editor-footer` | 編輯區最下方固定狀態列。 |
| **標籤膠囊列** | `.note-tags`、`.tag-capsule-bar` | 筆記底部列中顯示目前標籤的單行區域；「Tag 區」統一稱為此名稱。 |
| 標籤膠囊 | `.tag-capsule` | 顯示單一 `#標籤名稱` 的圓角膠囊。 |
| 標籤溢出計數 | `.tag-capsule-count` | 無法容納時顯示的 `+N`。 |
| 標籤管理選單 | `.tag-editor-popover` | 從標籤膠囊列向上展開的標籤清單。 |
| 標籤管理列 | `.tag-editor-item` | 選單中的單一 `#Name` 與右側 `X`。 |
| 新標籤輸入 | `.tag-editor-new input` | 標籤管理選單底部的「輸入新的標籤」。 |
| 附件按鈕 | `.attachment-trigger` | 顯示「附件 N」，用來開啟附件清單。 |
| 附件選單 | `.attachment-popover` | 向上展開的附件清單；每列可開啟或另存。 |
| 筆記底部操作區 | `.editor-footer-actions` | 筆記底部列右側的附件、字元、日期、儲存狀態與刪除操作。 |
| 待辦到期日按鈕 | `.editor-footer-due` | 待辦筆記底部顯示目前到期狀態，點擊可設定或變更日期。 |
| 字元數 | `.word-count` | 顯示目前筆記的字元數。 |
| 更新日期 | `.editor-footer-date` | 顯示目前筆記的更新日期。 |
| 儲存狀態 | `.save-state` | 顯示 `已儲存`、`編輯中`、`儲存中` 或 `儲存失敗`。 |
| 刪除按鈕 | `.editor-footer-trash` | 顯示「刪除」，實際動作是將目前筆記移至垃圾桶。 |

## 浮層與對話框

| 統一稱呼 | 程式對應 | 說明 |
|---|---|---|
| 筆記本右鍵選單 | `.notebook-context-menu` | 重新命名、新增子筆記本、匯入、JEX／Markdown／DOCX 匯出與刪除。 |
| 直接管理筆記本右鍵選單 | `.notebook-context-menu` 搭配 `.notebook-row.is-managed` | 新增子資料夾、重新整理、在檔案總管顯示、Markdown／DOCX 匯出與停止管理；不提供匯入、JEX 或一般刪除。 |
| Markdown 目錄匯出 | 「匯出 Markdown 目錄…」 | 選擇目的目錄後直接寫出 `.md`；圖片放 `images/`，其它附件放 `resources/`。 |
| DOCX 匯出 | 「匯出 DOCX…」 | 將所選筆記本及子筆記本合併為一個 Word 文件，並內嵌本機附件；Mermaid fenced blocks 會先轉成 PNG 再嵌入。 |
| 筆記右鍵選單 | `.note-context-menu` | 提供筆記的「移至筆記本」入口。 |
| 待辦到期日對話框 | `.todo-due-dialog` | 設定或清除目前待辦筆記的到期日。 |
| 筆記本名稱對話框 | `.notebook-name-dialog` | 新增最上層／子筆記本與重新命名筆記本的統一輸入視窗。 |
| 筆記本選擇器 | `.note-move-dialog` | 搜尋完整目錄路徑並移動筆記。 |
| 通知提示 | `.toast` | 操作成功或失敗的短暫提示。 |
| 匯入進度浮層 | `.progress-overlay` | 匯入期間的進度顯示。 |
| 第一次啟動匯入視窗 | `.onboarding-card` | 偵測 Joplin profile 後顯示的匯入提示。 |
| 設定視窗 | `.modal-card.settings-modal` | 加寬的分頁式設定視窗，頁首、分類列與版本底列固定，內容區獨立捲動。 |
| 設定分頁列 | `.settings-tabs` | 在「外觀」、「快捷鍵」與「資料」三個設定分頁間切換。 |
| 設定內容區 | `.settings-content` | 顯示目前設定分頁的可捲動內容。 |
| 原始碼行號開關 | `.source-lines-field`、`.appearance-toggle` | 設定頁中控制 CodeMirror 原始碼行號的 Fluent 切換開關。 |
| 鍵盤快捷鍵清單 | `.settings-shortcuts` | 設定頁中的唯讀快捷鍵參考，依應用程式、搜尋、格式化、編輯器與原始碼操作分組。 |
| 資料與儲存分頁 | `.settings-data` | 將匯入功能與本機儲存／Markdown 匯出分成獨立功能區。 |
| 匯入結果視窗 | `.modal-card.import-report` | 顯示匯入統計與警告。 |
| 錯誤畫面 | `.fatal-screen`、`.fatal-card` | 無法啟動或前端發生未處理錯誤時的復原畫面。 |

## 溝通用語規則

- 「標題列」可能混淆時，必須明確說「應用標題列」或「筆記標題列」。
- 「目錄」在筆記編輯區指完整筆記本路徑中的目前目錄；整體稱為「完整筆記路徑」。
- 「Tag 區」統一對應「標籤膠囊列」，展開後的浮層稱為「標籤管理選單」，不要與左側導覽欄的「標籤雲」混用。
- 「附件區」統一對應「附件按鈕」與「附件選單」，不包含筆記內嵌圖片。
- 「筆記卡片右鍵選單」對應筆記清單中的單篇筆記操作，不與「筆記本右鍵選單」混用。
- 「直接管理筆記本」指以磁碟目錄為資料來源的模式，不是匯入；其筆記檔案與 `images/` 目錄以檔案系統為準，SQLite 只保存索引、標籤、待辦與釘選。
- 「停止管理」只移除 PuffJoplin 中的目錄索引，不會刪除磁碟檔案；不要稱為「刪除資料夾」。
- 「上方」優先改說「應用標題列」或「筆記標題列」；「下方」優先改說「筆記底部列」。
- 「右側」優先改說「筆記編輯區」或「筆記操作區」，避免與視窗控制區混淆。
- 編輯器內的找字與換字功能統一稱為「筆記內搜尋面板」；全域跨筆記搜尋則稱為「全域搜尋框」。
- 編輯器內右鍵圖片與 Mermaid 圖表時顯示的選單統一稱為「圖稿右鍵選單」。
- 工具列開啟的 16 色浮層統一稱為「文字顏色面板」，不要與「佈景」或「標籤」混用。
- 主要筆記總覽統一稱為「全部筆記」，不再使用「所有筆記」。
- 跨筆記本的待辦清單統一稱為「待辦檢視」；「未完成」、「已完成」與「全部」是其狀態篩選。

## 主要程式位置

- 主介面與區塊組合：`frontend/src/App.tsx`
- 主介面樣式：`frontend/src/styles.css`
- 混合 Markdown 編輯器整合：`frontend/src/VditorEditor.tsx`
- CodeMirror 原始碼編輯器：`frontend/src/codeMirrorSource.ts`
- 筆記內搜尋面板：`frontend/src/EditorFindPanel.tsx`
- 筆記內搜尋與取代核心：`frontend/src/editorSearch.ts`
- 圖稿右鍵選單：`frontend/src/EditorMediaContextMenu.tsx`
- 文字顏色面板：`frontend/src/TextColorPalette.tsx`
- 文字顏色核心：`frontend/src/textColor.ts`
- Vditor 分割與自訂捲軸：`frontend/src/editorViewportController.ts`
- 前端 API 介面：`frontend/src/api.ts`

## CSS 維護規則

- `frontend/src/styles.css` 是唯一主樣式入口，分層順序固定為 Base、Fluent、Windows shell、Typography、Icon、Fullscreen。
- 同一 class 在不同 cascade layer 重複出現是刻意覆蓋；除非同步驗證 computed style，不得跨層搬移、合併或重排。
- 已移除的舊元件 class 不得重新加入；Vditor 與 CodeMirror 動態產生的 `.vditor*`、`.cm-*` class 不列入死碼判定。
- 修改樣式後執行 `npm --prefix frontend test`，`styles.test.ts` 會檢查死碼 class、完全相同規則、空規則與分區順序。
