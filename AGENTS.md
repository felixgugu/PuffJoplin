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
| 筆記編輯區 | `.editor-panel` | 右側的筆記標題、Vditor 編輯器與底部狀態列。 |

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
| 主要導覽 | `.nav-section` | 單行圖示列，包含「全部筆記」與「垃圾桶」。 |
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
| 排序方式 | `.note-sort-select` | 選擇字母、新增日期或修改日期。 |
| 排序方向 | `.note-sort-direction` | 切換正序或倒序。 |
| 筆記摘要切換 | `.toggle-note-summary-button` | 顯示或隱藏摘要；隱藏後卡片只留標題與釘選。 |
| 定位筆記本按鈕 | `.locate-notebook-button` | 展開筆記本樹並切換到目前筆記的目錄。 |
| 新增筆記按鈕 | `.new-note-button` | 在目前筆記本新增筆記。 |
| 筆記卡片 | `.note-card` | 單篇筆記的標題、摘要、日期、標籤與附件數。 |
| 釘選筆記按鈕 | `.pin-note-button` | 將筆記釘選至清單最上方，不受排序與方向影響。 |
| 筆記拖曳 | `.note-card[draggable="true"]` | 將筆記拖到筆記本樹以變更目錄。 |
| 筆記本放置目標 | `.notebook-row.drop-target` | 拖曳筆記時可接受的筆記本目錄。 |
| 空清單提示 | `.empty-list` | 沒有筆記或搜尋無結果時顯示。 |

## 筆記編輯區

| 統一稱呼 | 程式對應 | 說明 |
|---|---|---|
| 垃圾桶提示列 | `.trash-banner` | 筆記位於垃圾桶時顯示還原／永久刪除。 |
| **筆記分頁列** | `.editor-tabs` | 編輯區最上方的已開啟筆記分頁。 |
| 釘選分頁 | `.editor-tab.is-pinned` | 永久保留的多個筆記分頁。 |
| 預覽分頁 | `.editor-tab.is-preview` | 唯一未釘選分頁，開啟其他未釘選筆記時被替換。 |
| 分頁釘選按鈕 | `.editor-tab-pin` | 釘選或取消釘選分頁。 |
| 分頁關閉按鈕 | `.editor-tab-close` | 關閉釘選分頁；預覽分頁不顯示。 |
| **筆記標題列** | `.editor-heading` | 編輯區上方固定單列。包含筆記路徑、名稱、儲存狀態與右側操作。 |
| 收合筆記清單按鈕 | `.collapse-note-list-button` | 筆記標題列最前方的雙向控制；完全隱藏或恢復筆記清單。 |
| 筆記路徑 | `.editor-breadcrumbs` | 「筆記本 / 筆記名稱 (儲存狀態)」的整體。 |
| 完整筆記路徑 | `.note-path-label` | 顯示從根目錄到目前筆記本的完整路徑，不可直接下拉切換。 |
| 筆記名稱 | `.title-input` | 可直接編輯的單行筆記標題。 |
| 儲存狀態 | `.save-state` | 顯示 `(已儲存)`、`(編輯中)`、`(儲存中)` 或 `(儲存失敗)`。 |
| 筆記操作區 | `.editor-heading-actions` | 筆記標題列右側的操作群組。 |
| 匯出按鈕 | `.export-action-button` | 開啟 PDF／HTML 匯出選單。 |
| 匯出選單 | `.editor-export-menu` | 選擇「PDF」或「HTML」。 |
| 待辦按鈕 | `.todo-action-button` | 轉為待辦、標記完成或標記未完成。 |
| 移至垃圾桶按鈕 | `.trash-action-button` | 將目前筆記移至垃圾桶。 |
| Vditor 編輯器 | `.editor-main`、`.vditor-editor-host` | 完整的 Vditor 元件。 |
| 編輯工具列 | `.vditor-toolbar` | 標題、粗體、清單、附件、復原、模式切換等工具。 |
| 筆記內容區 | `.vditor-content` | IR、所見即所得或原始碼模式的書寫區域。 |
| **筆記底部列** | `.editor-footer` | 編輯區最下方固定狀態列。 |
| **標籤膠囊列** | `.note-tags`、`.tag-capsule-bar` | 筆記底部列中顯示目前標籤的單行區域；「Tag 區」統一稱為此名稱。 |
| 標籤膠囊 | `.tag-capsule` | 顯示單一 `#標籤名稱` 的圓角膠囊。 |
| 標籤溢出計數 | `.tag-capsule-count` | 無法容納時顯示的 `+N`。 |
| 標籤管理選單 | `.tag-editor-popover` | 從標籤膠囊列向上展開的標籤清單。 |
| 標籤管理列 | `.tag-editor-item` | 選單中的單一 `#Name` 與右側 `X`。 |
| 新標籤輸入 | `.tag-editor-new input` | 標籤管理選單底部的「輸入新的標籤」。 |
| 附件按鈕 | `.attachment-trigger` | 顯示「附件 N」，用來開啟附件清單。 |
| 附件選單 | `.attachment-popover` | 向上展開的附件清單；每列可開啟或另存。 |
| 字數與時間 | `.word-count` | 字元數與筆記更新時間。 |

## 浮層與對話框

| 統一稱呼 | 程式對應 | 說明 |
|---|---|---|
| 筆記本右鍵選單 | `.notebook-context-menu` | 重新命名、新增子筆記本、匯入、JEX／Markdown／DOCX 匯出與刪除。 |
| 直接管理筆記本右鍵選單 | `.notebook-context-menu` 搭配 `.notebook-row.is-managed` | 新增子資料夾、重新整理、在檔案總管顯示、Markdown／DOCX 匯出與停止管理；不提供匯入、JEX 或一般刪除。 |
| Markdown 目錄匯出 | 「匯出 Markdown 目錄…」 | 選擇目的目錄後直接寫出 `.md`；圖片放 `images/`，其它附件放 `resources/`。 |
| DOCX 匯出 | 「匯出 DOCX…」 | 將所選筆記本及子筆記本合併為一個 Word 文件，並內嵌本機附件；Mermaid fenced blocks 會先轉成 PNG 再嵌入。 |
| 筆記右鍵選單 | `.note-context-menu` | 提供筆記的「移至筆記本」入口。 |
| 筆記本名稱對話框 | `.notebook-name-dialog` | 新增最上層／子筆記本與重新命名筆記本的統一輸入視窗。 |
| 筆記本選擇器 | `.note-move-dialog` | 搜尋完整目錄路徑並移動筆記。 |
| 通知提示 | `.toast` | 操作成功或失敗的短暫提示。 |
| 匯入進度浮層 | `.progress-overlay` | 匯入期間的進度顯示。 |
| 第一次啟動匯入視窗 | `.onboarding-card` | 偵測 Joplin profile 後顯示的匯入提示。 |
| 設定視窗 | `.modal-card` 搭配 `modal.kind === "settings"` | 字型、字體大小、匯入與資料位置設定。 |
| 匯入結果視窗 | `.modal-card.import-report` | 顯示匯入統計與警告。 |
| 錯誤畫面 | `.fatal-screen`、`.fatal-card` | 無法啟動或前端發生未處理錯誤時的復原畫面。 |

## 溝通用語規則

- 「標題列」可能混淆時，必須明確說「應用標題列」或「筆記標題列」。
- 「目錄」在筆記編輯區指完整筆記本路徑中的目前目錄；整體稱為「完整筆記路徑」。
- 「Tag 區」統一對應「標籤膠囊列」，展開後的浮層稱為「標籤管理選單」，不要與左側導覽欄的「標籤雲」混用。
- 「附件區」統一對應「附件按鈕」與「附件選單」，不包含筆記內嵌圖片。
- 「直接管理筆記本」指以磁碟目錄為資料來源的模式，不是匯入；其筆記檔案與 `images/` 目錄以檔案系統為準，SQLite 只保存索引、標籤、待辦與釘選。
- 「停止管理」只移除 PuffJoplin 中的目錄索引，不會刪除磁碟檔案；不要稱為「刪除資料夾」。
- 「上方」優先改說「應用標題列」或「筆記標題列」；「下方」優先改說「筆記底部列」。
- 「右側」優先改說「筆記編輯區」或「筆記操作區」，避免與視窗控制區混淆。
- 主要筆記總覽統一稱為「全部筆記」，不再使用「所有筆記」。

## 主要程式位置

- 主介面與區塊組合：`frontend/src/App.tsx`
- 主介面樣式：`frontend/src/styles.css`
- Vditor 編輯器：`frontend/src/VditorEditor.tsx`
- 前端 API 介面：`frontend/src/api.ts`
