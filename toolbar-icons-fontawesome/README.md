# Font Awesome 編輯器工具列

來源：https://github.com/FortAwesome/Font-Awesome/tree/7.x
Font Awesome Free Classic Solid；下載日期 2026-10-25。
32 個位置、32 個獨立 SVG，其中 30 個為 Font Awesome Free，2 個為依使用者截圖重畫的 mode-*。

## 授權
Font Awesome Free by Fonticons, Inc. https://fontawesome.com
Font Awesome SVG 使用 CC BY 4.0，請保留來源標示與 LICENSE.txt；SVG 內原始授權註解已保留。
mode-wysiwyg.svg 與 mode-instant-render.svg 為依截圖重畫，非 Font Awesome 原生或 Pro 檔案。

## 對應差異
- 即見即所得：方框 A；即時渲染：方框閃電，沿用使用者指定外觀。
- 文字顏色：font，實際顏色底線可由介面 CSS 呈現。
- 程式碼區塊：file-code；行內程式碼：code；原始碼模式：file-code-regular-full。
- 分割視窗：table-columns。

preview.html 可離線預覽，含深色工具列及名稱對照。
mapping.json 提供順序、名稱與來源。svg/ 提供原始個別 SVG（各自保留 viewBox）。
sprite.svg 提供 symbol 集合；外部引用建議透過 HTTP 使用。

## 補充功能

| 功能 | Font Awesome 圖示 |
|---|---|
| 減少縮排 | outdent |
| 增加縮排 | indent |
| 向前插入 | arrow-up-long |
| 向後插入 | arrow-down-long |
| 大綱 | list |

向前／向後插入以向上／向下長箭頭圖示對應，表示在目前區塊之前／之後插入。
