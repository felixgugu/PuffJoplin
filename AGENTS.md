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
| 全域搜尋框 | `.titlebar-search` | 固定高度的跨筆記搜尋列，包含搜尋選項、文字輸入、大小寫、完整單詞與清除控制。 |
| 搜尋選項按鈕 | `.search-options-trigger` | 開啟整合式搜尋選項面板，並顯示目前是全部或目前目錄。 |
| 搜尋選項面板 | `.search-options-menu` | Fluent 浮層，切換筆記本範圍與「標題＋內文」或「只搜尋標題」。 |
| 大小寫切換 | `.search-filter-toggle` 的 `Aa` | 切換全域搜尋是否區分大小寫。 |
| 完整單詞切換 | `.search-whole-word` | 切換英文與數字的完整單詞比對；連續中文視為完整詞段。 |
| 佈景按鈕 | `.titlebar-tool` 的第一個按鈕 | 切換深色／亮色模式。 |
| 設定按鈕 | `.titlebar-tool` 的設定按鈕 | 開啟「設定」視窗。 |
| 視窗控制區 | `.window-actions` | 最小化、最大化／還原、關閉。 |

## 左側導覽欄

| 統一稱呼 | 程式對應 | 說明 |
|---|---|---|
| 側欄頂列 | `.sidebar-head` | 左側導覽最上方的單列控制，不使用品牌標誌或名稱。 |
| 主要導覽 | `.nav-section` | 單行圖示列，包含「儀錶板」、「全部筆記」、「待辦」與「垃圾桶」。 |
| 儀錶板 | `.dashboard-panel` | 全寬工作台，彙整今日待辦、最近筆記、活動、筆記本、標籤、媒體與資料健康。 |
| 今日焦點 | `.dashboard-focus` | 依逾期、今天到期、未來七天與稍後到期分組顯示未完成待辦。 |
| 資料健康 | `.dashboard-health` | 顯示可回收資源、遺失附件、資料目錄與直接管理根目錄狀態。 |
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
| **筆記卡片右鍵選單** | `.note-context-menu` | 筆記卡片的釘選、匯出、移動、Todo、實體檔案與垃圾桶操作。 |
| 筆記匯出子選單 | `.note-context-export-menu` | 從筆記卡片右鍵選單展開 PDF、HTML、Markdown、DOCX、Mermaid SVG／PNG。 |

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
| 原始碼浮動預覽 | `.source-line-preview` | 從工具列相簿或原始碼圖稿開啟的媒體 Dialog；支援拖曳、八向調整大小、縮放、平移、最大化、定位內文與刪除引用。 |
| 原始碼媒體畫廊 | `.source-line-preview-gallery` | Dialog 底部的水平縮圖列，合併目前筆記的圖片與 Mermaid，支援循環切換上一張／下一張；透明 Mermaid 使用白色顯示背景。 |
| 原始碼媒體縮圖 | `.source-line-preview-thumbnail` | 單一圖片或 Mermaid 的畫廊縮圖與選取狀態。 |
| 原始碼媒體調整把手 | `.source-line-preview-resize` | Dialog 邊框與角落的八向拖曳控制。 |
| 編輯工具列 | `.vditor-toolbar` | 標題、粗體、清單、附件、復原、模式切換等工具；圖示由 Font Awesome registry 提供。 |
| 工具列 SVG | `.puff-toolbar-svg` | 由 `toolbarIcons.ts` 載入並內嵌的 Font Awesome SVG，使用 `currentColor` 跟隨佈景。 |
| 上一頁按鈕 | `.vditor-toolbar` 的 `page-prev` | 將目前筆記內容向上捲動約一個可視頁面；快捷鍵為 `Alt+←`。 |
| 下一頁按鈕 | `.vditor-toolbar` 的 `page-next` | 將目前筆記內容向下捲動約一個可視頁面；快捷鍵為 `Alt+→`。 |
| 原始碼全部收合按鈕 | `.vditor-toolbar` 的 `fold-all` | 在原始碼模式使用 CodeMirror 遞迴收合所有可折疊區段，包含巢狀節點；其他模式停用，快捷鍵為 `Ctrl+Alt+[`。 |
| 原始碼全部展開按鈕 | `.vditor-toolbar` 的 `unfold-all` | 在原始碼模式使用 CodeMirror 展開所有已折疊區段；其他模式停用，快捷鍵為 `Ctrl+Alt+]`。 |
| 格式化表格按鈕 | `.vditor-toolbar` 的 `format-table` | 在原始碼模式格式化游標所在的 Markdown 表格；有選取內容時批次格式化範圍內所有表格，其他模式停用。 |
| 自動換行按鈕 | `.vditor-toolbar` 的 `source-word-wrap` | 在原始碼模式切換 CodeMirror 自動換行；狀態與設定視窗同步，其他模式停用。 |
| 相簿按鈕 | `.vditor-toolbar` 的 `gallery` | 在任何編輯模式開啟目前筆記的圖片與 Mermaid 畫廊；沒有媒體時顯示提示。 |
| Mermaid 設定按鈕 | `.vditor-toolbar` 的 `mermaid-config` | 開啟 Mermaid 設定 Dialog，產生可貼進 mermaid 區塊最前面的設定文字。 |
| Mermaid 設定 Dialog | `.mermaid-config-dialog` | 調整主題、字級、顏色、間距與輸出格式；按「複製」寫入剪貼簿後關閉。 |
| Mermaid 設定輸出預覽 | `.mermaid-config-output` | 顯示目前選擇的 `%%{init}%%`、frontmatter 或 JSON 設定文字。 |
| Mermaid 設定複製按鈕 | `.mermaid-config-dialog` 底部列的「複製」 | 將設定文字寫入系統剪貼簿，成功後關閉 Dialog。 |
| 文字顏色按鈕 | `.vditor-toolbar` 的 `text-color` | 開啟 16 色文字顏色面板。 |
| 文字顏色面板 | `.editor-text-color-palette` | 16 色色盤與「恢復預設色」操作。 |
| 顏色色票 | `.text-color-swatch` | 單一常用文字顏色按鈕。 |
| 分割預覽把手 | `.puff-preview-splitter` | Both 模式左右編輯／預覽的垂直拖曳分隔線。 |
| Vditor 自訂捲軸 | `.puff-editor-scrollbar` | 編輯區與預覽區的 overlay 垂直／水平捲軸軌道。 |
| Vditor 水平捲軸 | `.puff-editor-scrollbar.is-horizontal` | 內容超出寬度（例如原始碼關閉自動換行）時顯示的水平拖曳軸。 |
| Vditor 捲軸拇指 | `.puff-editor-scrollbar-thumb` | 最短 52px 的自訂捲軸拖曳把手。 |
| 筆記內容區 | `.vditor-content` | IR／所見即所得由 Vditor 顯示，原始碼由 CodeMirror 顯示的共用書寫區域。 |
| 筆記載入佔位 | `.editor-pane-skeleton`、`.editor-pane-loading` | 首次開啟或切換筆記時覆蓋初始化中的編輯器，避免內容閃爍。 |
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
| **附加資訊按鈕** | `.note-info-trigger` | 位於標籤膠囊列右側，開啟「筆記附加資訊 Dialog」。 |
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
| 筆記本右鍵選單 | `.notebook-context-menu` | 重新命名、新增子筆記本、匯入、Markdown 匯出與刪除。 |
| 直接管理筆記本右鍵選單 | `.notebook-context-menu` 搭配 `.notebook-row.is-managed` | 新增子資料夾、重新整理、在檔案總管顯示、Markdown 匯出與停止管理；不提供匯入、JEX、DOCX 或一般刪除。 |
| Markdown 目錄匯出 | 「匯出 Markdown 目錄…」 | 選擇目的目錄後直接寫出 `.md`；圖片放 `images/`，其它附件放 `resources/`。 |
| 筆記右鍵選單 | `.note-context-menu` | 依筆記狀態提供釘選、匯出、移動、Todo、移至垃圾桶；垃圾桶內提供還原與永久刪除。 |
| 待辦到期日對話框 | `.todo-due-dialog` | 設定或清除目前待辦筆記的到期日。 |
| 筆記附加資訊 Dialog | `.note-info-dialog` | 編輯目前筆記的 12 個 PDF 封面參數名稱與值。 |
| 筆記本名稱對話框 | `.notebook-name-dialog` | 新增最上層／子筆記本與重新命名筆記本的統一輸入視窗。 |
| 筆記本選擇器 | `.note-move-dialog` | 搜尋完整目錄路徑並移動筆記。 |
| 共用確認對話框 | `.confirm-dialog` | 應用程式內統一的確認視窗，用於刪除、移至垃圾桶、停止管理與資源檔清理等不可逆或需確認操作。 |
| 通知提示 | `.toast` | 操作成功或失敗的短暫提示。 |
| 匯入進度浮層 | `.progress-overlay` | 匯入期間的進度顯示。 |
| 第一次啟動匯入視窗 | `.onboarding-card` | 偵測 Joplin profile 後顯示的匯入提示。 |
| 設定視窗 | `.modal-card.settings-modal` | 加寬的分頁式設定視窗，頁首、分類列與版本底列固定，內容區獨立捲動。 |
| 設定分頁列 | `.settings-tabs` | 在「外觀」、「編輯」、「PDF」、「快捷鍵」與「資料」五個設定分頁間切換。 |
| 設定內容區 | `.settings-content` | 顯示目前設定分頁的可捲動內容。 |
| 設定最大化按鈕 | `.settings-window-actions` | 設定視窗右上角的最大化／還原與關閉控制；最大化只放大設定 Dialog。 |
| 編輯分頁 | `.settings-editor` | 管理預設編輯模式、原始碼行號與亮色／暗色 CodeMirror 原始碼外觀。 |
| 原始碼外觀自訂區 | `.source-appearance-controls` | 編輯目前選取佈景的基礎顏色、Markdown 語法色、字重與排版參數。 |
| 原始碼配色預覽 | `.source-appearance-preview` | 以範例 Markdown 即時顯示目前原始碼前景、背景與語法色。 |
| 原始碼程式碼區塊背景 | `.puff-source-code-block` | CodeMirror fenced code 與縮排程式碼區塊的獨立行背景，由「程式碼區塊背景」色票控制。 |
| 原始碼行內程式碼 | `.puff-source-inline-code` | CodeMirror Markdown 行內程式碼範圍，獨立使用「行內程式碼文字」與「行內程式碼背景」色票。 |
| PDF 匯出設定 | `.settings-pdf` | 設定 PDF 封面、裝飾總開關、每頁頁尾版權文字、浮水印文字與可調圖樣參數。 |
| 封面設計器 | `.pdf-cover-designer` | PDF 設定頁中的封面啟用、A4 預覽、變數清單與屬性面板。 |
| 封面預覽捲動區 | `.pdf-cover-canvas-shell` | 固定於設定視窗可視高度的 A4 封面滾動容器，使用獨立垂直捲軸查看完整頁面。 |
| A4 封面畫布 | `.pdf-cover-canvas` | 可拖曳封面變數並顯示目前筆記資料的預覽畫布。 |
| 封面邊距參考框 | `.pdf-cover-margin-guide` | 顯示上 25.4 mm、左右各 19 mm、下 12.5 mm 的虛線頁面邊距；只供設計對齊，不輸出 PDF。 |
| 封面多選工具列 | `.pdf-cover-bulk-actions` | 顯示已選數量、文字間距與左／中對齊批次操作。 |
| 封面變數啟用鈕 | `.pdf-cover-visibility-toggle` | 控制單一封面變數是否輸出；眼睛圖示表示目前狀態。 |
| PDF 裝飾開關 | `.pdf-settings-toggles` | 分別控制版權宣告頁尾與浮水印，預設為頁尾開啟、浮水印關閉。 |
| PDF 浮水印 | `.pdf-watermark-layer` | 使用設定文字與匯出日期產生透明 SVG pattern；尺寸、字級、透明度與旋轉角度均可調。 |
| 原始碼行號開關 | `.source-lines-field`、`.appearance-toggle` | 編輯分頁中控制 CodeMirror 原始碼行號與折疊控制的 Fluent 切換開關。 |
| 原始碼自動換行開關 | `.source-wrap-field`、`.appearance-toggle` | 編輯分頁中控制 CodeMirror 原始碼是否自動換行；與工具列的自動換行按鈕同步。 |
| 鍵盤快捷鍵清單 | `.settings-shortcuts` | 設定頁中的唯讀快捷鍵參考，依應用程式、搜尋、格式化、編輯器與原始碼操作分組。 |
| 資料與儲存分頁 | `.settings-data` | 將匯入功能與本機儲存／Markdown 匯出分成獨立功能區。 |
| 資源清理區塊 | `.settings-resource-cleanup` | 清理一般筆記未引用的資料庫資源與本機孤兒檔，不處理直接管理筆記本的外部檔案。 |
| 資源檔清理按鈕 | `.resource-cleanup-button` | 執行未引用資源清理，並在垃圾桶引用保留後顯示清理數量與釋放空間。 |
| 資源清理結果 | `.resource-cleanup-result` | 設定頁中持續顯示最近一次資源清理結果、近期保留數與失敗數。 |
| 匯入結果視窗 | `.modal-card.import-report` | 顯示匯入統計與警告。 |
| 錯誤畫面 | `.fatal-screen`、`.fatal-card` | 無法啟動或前端發生未處理錯誤時的復原畫面。 |

## 溝通用語規則

- 「標題列」可能混淆時，必須明確說「應用標題列」或「筆記標題列」。
- 「目錄」在筆記編輯區指完整筆記本路徑中的目前目錄；整體稱為「完整筆記路徑」。
- 「Tag 區」統一對應「標籤膠囊列」，展開後的浮層稱為「標籤管理選單」，不要與左側導覽欄的「標籤雲」混用。
- 「附件區」統一對應「附件按鈕」與「附件選單」，不包含筆記內嵌圖片。
- 「筆記卡片右鍵選單」對應筆記清單中的單篇筆記操作，不與「筆記本右鍵選單」混用。
- 「直接管理筆記本」指以磁碟目錄為資料來源的模式，不是匯入；其筆記檔案與 `images/` 目錄以檔案系統為準，SQLite 保存索引、標籤、待辦、釘選與 PDF 封面附加資訊。
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
- Vditor 工具列圖示 registry：`frontend/src/toolbarIcons.ts`
- 工具列 SVG 與授權：`frontend/src/assets/toolbar-icons-fontawesome/`
- 筆記內搜尋面板：`frontend/src/EditorFindPanel.tsx`
- 筆記內搜尋與取代核心：`frontend/src/editorSearch.ts`
- 筆記附加資訊 Dialog：`frontend/src/NoteAdditionalInfoDialog.tsx`
- PDF 封面設計器：`frontend/src/PdfCoverDesigner.tsx`
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
