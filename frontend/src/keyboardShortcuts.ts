export interface KeyboardShortcut {
  keys: string[];
  action: string;
}

export interface KeyboardShortcutGroup {
  id: string;
  title: string;
  description: string;
  shortcuts: KeyboardShortcut[];
}

export const KEYBOARD_SHORTCUT_GROUPS: KeyboardShortcutGroup[] = [
  {
    id: 'application',
    title: '應用程式',
    description: '在主要視窗與全域畫面使用。',
    shortcuts: [
      { keys: ['Ctrl', 'S'], action: '儲存目前筆記' },
      { keys: ['Ctrl', 'N'], action: '新增筆記' },
      { keys: ['Ctrl', 'F'], action: '全域搜尋（游標不在筆記編輯區時）' },
      { keys: ['Esc'], action: '關閉目前開啟的選單或浮層' },
    ],
  },
  {
    id: 'note-search',
    title: '筆記內搜尋',
    description: '游標位於筆記編輯區時使用。',
    shortcuts: [
      { keys: ['Ctrl', 'F'], action: '搜尋目前筆記' },
      { keys: ['Ctrl', 'H'], action: '搜尋與取代' },
      { keys: ['Enter'], action: '下一個搜尋結果' },
      { keys: ['Shift', 'Enter'], action: '上一個搜尋結果' },
      { keys: ['Ctrl', 'Enter'], action: '全部取代（游標位於取代欄位時）' },
      { keys: ['Esc'], action: '關閉搜尋與取代面板' },
    ],
  },
  {
    id: 'markdown-formatting',
    title: 'Markdown 格式化',
    description: '適用於 Vditor 的所見即所得與即時渲染模式。',
    shortcuts: [
      { keys: ['Ctrl', 'Alt', '1–6'], action: '套用標題 1 至標題 6' },
      { keys: ['Ctrl', 'B'], action: '粗體' },
      { keys: ['Ctrl', 'I'], action: '斜體' },
      { keys: ['Ctrl', 'D'], action: '刪除線' },
      { keys: ['Ctrl', 'K'], action: '插入連結' },
      { keys: ['Ctrl', 'L'], action: '項目清單' },
      { keys: ['Ctrl', 'O'], action: '編號清單' },
      { keys: ['Ctrl', 'J'], action: '工作清單' },
      { keys: ['Ctrl', 'Shift', 'I'], action: '減少縮排' },
      { keys: ['Ctrl', 'Shift', 'O'], action: '增加縮排' },
      { keys: ['Ctrl', ';'], action: '引用區塊' },
      { keys: ['Ctrl', 'Shift', 'H'], action: '分隔線' },
      { keys: ['Ctrl', 'U'], action: '程式碼區塊' },
      { keys: ['Ctrl', 'G'], action: '行內程式碼' },
      { keys: ['Ctrl', 'Shift', 'B'], action: '在目前區塊前插入內容' },
      { keys: ['Ctrl', 'Shift', 'E'], action: '在目前區塊後插入內容' },
      { keys: ['Ctrl', 'M'], action: '插入表格' },
      { keys: ['Ctrl', 'E'], action: '插入 Emoji' },
    ],
  },
  {
    id: 'editor-navigation',
    title: '編輯器與頁面',
    description: '切換檢視、全螢幕與筆記頁面導覽。',
    shortcuts: [
      { keys: ['Ctrl', 'Alt', '7'], action: '切換為所見即所得模式' },
      { keys: ['Ctrl', 'Alt', '8'], action: '切換為即時渲染模式' },
      { keys: ['Ctrl', 'Alt', '9'], action: '切換為原始碼模式' },
      { keys: ['Ctrl', "'"], action: '切換全螢幕' },
      { keys: ['Ctrl', 'P'], action: '切換分割預覽' },
      { keys: ['Alt', '←'], action: '上一頁' },
      { keys: ['Alt', '→'], action: '下一頁' },
    ],
  },
  {
    id: 'source-editor',
    title: 'CodeMirror 原始碼',
    description: '僅在原始碼模式使用。',
    shortcuts: [
      { keys: ['Ctrl', 'Shift', '['], action: '折疊目前區段' },
      { keys: ['Ctrl', 'Shift', ']'], action: '展開目前區段' },
      { keys: ['Ctrl', 'Alt', '['], action: '全部折疊' },
      { keys: ['Ctrl', 'Alt', ']'], action: '全部展開' },
      { keys: ['Alt', '↑'], action: '將目前行向上移動' },
      { keys: ['Alt', '↓'], action: '將目前行向下移動' },
      { keys: ['Shift', 'Alt', '↑'], action: '向上複製目前行' },
      { keys: ['Shift', 'Alt', '↓'], action: '向下複製目前行' },
      { keys: ['Ctrl', 'Enter'], action: '在目前位置插入空白行' },
      { keys: ['Ctrl', '/'], action: '切換 Markdown 註解' },
    ],
  },
  {
    id: 'text-editing',
    title: '通用文字編輯',
    description: '在文字欄位與兩種筆記編輯器中使用。',
    shortcuts: [
      { keys: ['Ctrl', 'Z'], action: '復原' },
      { keys: ['Ctrl', 'Y'], action: '重做' },
      { keys: ['Ctrl', 'A'], action: '全選' },
      { keys: ['Ctrl', 'C'], action: '複製' },
      { keys: ['Ctrl', 'X'], action: '剪下' },
      { keys: ['Ctrl', 'V'], action: '貼上' },
      { keys: ['Tab'], action: '增加縮排' },
      { keys: ['Shift', 'Tab'], action: '減少縮排' },
    ],
  },
];
