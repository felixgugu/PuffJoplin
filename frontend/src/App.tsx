import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { api, onEvent } from './api';
import {
  parsePDFCoverDesign,
  PDF_COVER_DESIGN_KEY,
  resetPDFCoverDesign,
  serializePDFCoverDesign,
  type PDFCoverDesign,
} from './coverDesign';
import Dashboard from './Dashboard';
import { convertNotebookMarkdownToDocx } from './docxExport';
import EditorTabBar from './EditorTabBar';
import EditorSettings from './EditorSettings';
import FluentSelect from './FluentSelect';
import {
  placeSidebarActionMenu,
  type FloatingMenuPosition,
} from './floatingMenu';
import FreeNumberInput from './FreeNumberInput';
import {
  activateEditorTab as activateEditorTabState,
  closeEditorTab,
  editorModeForTab,
  EDITOR_TABS_KEY,
  loadEditorTabs,
  normalizeEditorTabs,
  openEditorNote,
  removeNoteFromEditorTabs,
  toggleEditorTabPin,
  updateEditorTabTitle,
  updateEditorTabMode,
  updateEditorTabPreviewMode,
  type EditorTab,
  type EditorTabsState,
} from './editorTabs';
import {
  defaultEditorPreferences,
  EDITOR_PREFERENCES_KEY,
  EDITOR_PREFERENCES_SETTING,
  parseEditorPreferences,
  serializeEditorPreferences,
  SOURCE_APPEARANCE_VARIABLE_NAMES,
  SOURCE_LINE_NUMBERS_KEY,
  sourceColorCSSVariables,
  sourceTypographyCSSVariables,
} from './editorPreferences';
import GlobalSearch from './GlobalSearch';
import { KEYBOARD_SHORTCUT_GROUPS } from './keyboardShortcuts';
import {
  addManagedExclusionName,
  emptyManagedDirectoryExclusions,
  managedDirectoryExclusionMessage,
  managedDirectoryExclusionsEqual,
  removeManagedExclusionName,
} from './managedDirectoryExclusions';
import { onboardingDecision } from './onboarding';
import { noteInfoFilledCount } from './noteInfo';
import NoteAdditionalInfoDialog from './NoteAdditionalInfoDialog';
import PdfCoverDesigner from './PdfCoverDesigner';
import { resourceCleanupMessage } from './resourceCleanup';
import { toEditorMarkdown } from './resourceUrls';
import { useConfirmDialog } from './useConfirmDialog';
import { extractMermaidBlocks } from './mermaidBlocks';
import {
  bytesToBase64,
  renderMermaidImage,
  replaceMermaidCodeBlocksWithImages,
  type MermaidImageFormat,
} from './mermaidExport';
import NoteTags from './NoteTags';
import {
  DEFAULT_PDF_WATERMARK_FONT_SIZE,
  DEFAULT_PDF_WATERMARK_HEIGHT,
  DEFAULT_PDF_WATERMARK_OPACITY,
  DEFAULT_PDF_WATERMARK_WIDTH,
  DEFAULT_PDF_WATERMARK_ANGLE,
  decodePDFSettingNumber,
  decodePDFSettingText,
  normalizePDFInteger,
  parsePDFDecorationsEnabled,
  parsePDFWatermarkShowBorder,
  PDF_FOOTER_MAX_LENGTH,
  PDF_FOOTER_ENABLED_KEY,
  PDF_FOOTER_TEXT_KEY,
  PDF_WATERMARK_ENABLED_KEY,
  PDF_WATERMARK_FONT_SIZE_KEY,
  PDF_WATERMARK_FONT_SIZE_RANGE,
  PDF_WATERMARK_HEIGHT_KEY,
  PDF_WATERMARK_HEIGHT_RANGE,
  PDF_WATERMARK_MAX_LENGTH,
  PDF_WATERMARK_OPACITY_KEY,
  PDF_WATERMARK_OPACITY_RANGE,
  PDF_WATERMARK_ANGLE_KEY,
  PDF_WATERMARK_ANGLE_RANGE,
  PDF_WATERMARK_SHOW_BORDER_KEY,
  PDF_WATERMARK_TEXT_KEY,
  PDF_WATERMARK_WIDTH_KEY,
  PDF_WATERMARK_WIDTH_RANGE,
  sanitizePDFSettingText,
} from './pdfSettings';
import {
  prepareNotebookDialogSubmission,
  type NotebookDialogMode,
} from './notebookDialog';
import UiIcon from './UiIcon';
import VditorEditor, { type VditorEditorHandle } from './VditorEditor';
import Vditor from 'vditor';
import {
  MAX_NOTE_TAG_PANEL_RATIO,
  MIN_NOTE_TAG_PANEL_RATIO,
  NOTE_LIST_COLLAPSED_KEY,
  NOTE_LIST_SUMMARY_KEY,
  NOTE_TAG_PANEL_OPEN_KEY,
  NOTE_TAG_PANEL_RATIO_KEY,
  NOTE_SORT_BY_KEY,
  NOTE_SORT_DIRECTION_KEY,
  TODO_SORT_BY_KEY,
  TODO_SORT_DIRECTION_KEY,
  TODO_STATUS_KEY,
  DEFAULT_TODO_SORT_DIRECTION,
  DEFAULT_TODO_STATUS,
  parseSearchField,
  parseNoteSortBy,
  parseNoteSortDirection,
  parseNoteTagPanelOpen,
  parseNoteTagPanelRatio,
  parseSearchToggle,
  parseShowNoteSummary,
  parseSearchScope,
  parseTodoStatus,
  parseTodoSortBy,
  SEARCH_CASE_SENSITIVE_KEY,
  SEARCH_FIELD_KEY,
  SEARCH_SCOPE_KEY,
  SEARCH_WHOLE_WORD_KEY,
  shouldExpandNoteList,
} from './noteListPreferences';
import { collectNoteTags, filterNotesByTag } from './noteTagPanel';
import {
  buildNotebookRows,
  COLLAPSED_NOTEBOOKS_KEY,
  NOTE_LIST_WIDTH_KEY,
  parseCollapsedNotebookIds,
  SIDEBAR_COLLAPSED_KEY,
  SIDEBAR_TAB_KEY,
  SIDEBAR_WIDTH_KEY,
} from './notebookTree';
import { notebookAncestorIDs, notebookPath } from './notebookPath';
import { formatTagLabel } from './tagFormatting';
import {
  cancelTodo,
  convertToTodo,
  nextTodoState,
  todoActionLabel,
  todoDueClassName,
  todoDueDateValue,
  todoDueFromDateValue,
  todoDueLabel,
} from './noteTodo';
import { buildNoteListQuery } from './noteQuery';
import {
  BASE_FONT_SIZE_KEY,
  decodeStoredString,
  DEFAULT_BASE_FONT_SIZE,
  DEFAULT_FONT_FAMILY,
  FONT_FAMILY_KEY,
  FONT_FAMILY_SETTING,
  FONT_PRESETS,
  FONT_SIZE_SETTING,
  fontFamilyStack,
  normalizeBaseFontSize,
  sanitizeFontFamily,
  typographyScale,
} from './typography';
import type {
  BootstrapState,
  DashboardSnapshot,
  ImportReport,
  JoplinProfilePreview,
  ManagedDirectoryExclusions,
  Note,
  NoteExportFormat,
  NoteInfoField,
  NoteInput,
  NoteSummary,
  NoteSortBy,
  NoteSortDirection,
  Notebook,
  Resource,
  SearchField,
  SearchScope,
  Tag,
  TodoStatus,
  View,
} from './types';

const emptyNote: Note = {
  id: '',
  notebookId: '',
  storageKind: 'database',
  externalPath: '',
  externalMTime: 0,
  externalSize: 0,
  title: '',
  body: '',
  isTodo: false,
  todoDue: 0,
  todoCompleted: 0,
  sourceUrl: '',
  author: '',
  isConflict: false,
  isPinned: false,
  createdAt: 0,
  updatedAt: 0,
  deletedAt: 0,
  tags: [],
  resources: [],
  additionalInfo: [],
};

function formatDate(value: number): string {
  if (!value) return '';
  const date = new Date(value);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString('zh-TW', { month: '2-digit', day: '2-digit' });
}

function noteToInput(note: Note): NoteInput {
  return {
    id: note.id,
    notebookId: note.notebookId,
    title: note.title,
    body: note.body,
    isTodo: note.isTodo,
    todoDue: note.todoDue,
    todoCompleted: note.todoCompleted,
    sourceUrl: note.sourceUrl,
    author: note.author,
  };
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error ?? '未知錯誤');
}

function storedWidth(key: string, fallback: number, min: number, max: number): number {
  const value = Number(localStorage.getItem(key));
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, value));
}

const saveStateLabel = {
  saved: '已儲存',
  dirty: '編輯中',
  saving: '儲存中',
  error: '儲存失敗',
} as const;

const noteDragMime = 'application/x-puffjoplin-note-id';

type NoteExportAction = NoteExportFormat | `mermaid-${MermaidImageFormat}`;
type TodoDueNote = Pick<
  NoteSummary,
  'id' | 'title' | 'isTodo' | 'todoDue' | 'todoCompleted'
>;

type NotebookDialogState = {
  mode: NotebookDialogMode;
  parentId: string;
  notebook: Notebook | null;
  value: string;
  error: string;
  saving: boolean;
};

const SETTINGS_TABS = [
  { id: 'appearance', label: '外觀' },
  { id: 'editor', label: '編輯' },
  { id: 'pdf', label: 'PDF' },
  { id: 'shortcuts', label: '快捷鍵' },
  { id: 'data', label: '資料' },
] as const;

type SettingsTab = typeof SETTINGS_TABS[number]['id'];

export default function App() {
  const [bootstrap, setBootstrap] = useState<BootstrapState | null>(null);
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [notes, setNotes] = useState<NoteSummary[]>([]);
  const [current, setCurrent] = useState<Note>(emptyNote);
  const [editorNoteCache, setEditorNoteCache] = useState<Record<string, Note>>({});
  const [mountedEditorIDs, setMountedEditorIDs] = useState<Set<string>>(() => new Set());
  const [editorTabs, setEditorTabs] = useState<EditorTabsState>(
    () => loadEditorTabs(localStorage.getItem(EDITOR_TABS_KEY)),
  );
  const [view, setView] = useState<View>({ kind: 'all' });
  const [search, setSearch] = useState('');
  const [saveState, setSaveState] = useState<'saved' | 'dirty' | 'saving' | 'error'>('saved');
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [attachmentMenuOpen, setAttachmentMenuOpen] = useState(false);
  const [noteInfoDialogOpen, setNoteInfoDialogOpen] = useState(false);
  const [exportingFormat, setExportingFormat] = useState<NoteExportAction | null>(null);
  const [tagSaving, setTagSaving] = useState(false);
  const [toast, setToast] = useState('');
  const [fatalError, setFatalError] = useState('');
  const [dashboardSnapshot, setDashboardSnapshot] = useState<DashboardSnapshot | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [dashboardError, setDashboardError] = useState('');
  const [joplinPreview, setJoplinPreview] = useState<JoplinProfilePreview | null>(null);
  const [modal, setModal] = useState<
    | { kind: 'import-report'; report: ImportReport }
    | { kind: 'settings' }
    | null
  >(null);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>('appearance');
  const [settingsMaximized, setSettingsMaximized] = useState(false);
  const [pdfFooterCopyright, setPdfFooterCopyright] = useState('');
  const [pdfWatermarkText, setPdfWatermarkText] = useState('');
  const [pdfFooterEnabled, setPdfFooterEnabled] = useState(true);
  const [pdfWatermarkEnabled, setPdfWatermarkEnabled] = useState(false);
  const [pdfCoverDesign, setPdfCoverDesign] = useState<PDFCoverDesign>(
    () => parsePDFCoverDesign(undefined),
  );
  const [pdfWatermarkWidth, setPdfWatermarkWidth] = useState(DEFAULT_PDF_WATERMARK_WIDTH);
  const [pdfWatermarkHeight, setPdfWatermarkHeight] = useState(DEFAULT_PDF_WATERMARK_HEIGHT);
  const [pdfWatermarkFontSize, setPdfWatermarkFontSize] = useState(DEFAULT_PDF_WATERMARK_FONT_SIZE);
  const [pdfWatermarkOpacity, setPdfWatermarkOpacity] = useState(DEFAULT_PDF_WATERMARK_OPACITY);
  const [pdfWatermarkAngle, setPdfWatermarkAngle] = useState(DEFAULT_PDF_WATERMARK_ANGLE);
  const [pdfWatermarkShowBorder, setPdfWatermarkShowBorder] = useState(false);
  const [pdfSettingsLoaded, setPdfSettingsLoaded] = useState(false);
  const [importProgress, setImportProgress] = useState<{ progress: number; message: string } | null>(null);
  const [resourceCleanupRunning, setResourceCleanupRunning] = useState(false);
  const [resourceCleanupResult, setResourceCleanupResult] = useState('');
  const [managedExclusions, setManagedExclusions] = useState<ManagedDirectoryExclusions>(
    emptyManagedDirectoryExclusions,
  );
  const [savedManagedExclusions, setSavedManagedExclusions] = useState<ManagedDirectoryExclusions>(
    emptyManagedDirectoryExclusions,
  );
  const [folderExclusionInput, setFolderExclusionInput] = useState('');
  const [markdownExclusionInput, setMarkdownExclusionInput] = useState('');
  const [managedExclusionsLoading, setManagedExclusionsLoading] = useState(false);
  const [managedExclusionsApplying, setManagedExclusionsApplying] = useState(false);
  const [managedExclusionsError, setManagedExclusionsError] = useState('');
  const [managedExclusionsResult, setManagedExclusionsResult] = useState('');
  const [leftWidth, setLeftWidth] = useState(() => storedWidth(SIDEBAR_WIDTH_KEY, 270, 210, 420));
  const [listWidth, setListWidth] = useState(() => storedWidth(NOTE_LIST_WIDTH_KEY, 330, 250, 480));
  const [noteListCollapsed, setNoteListCollapsed] = useState(
    () => localStorage.getItem(NOTE_LIST_COLLAPSED_KEY) === 'true',
  );
  const [noteSortBy, setNoteSortBy] = useState<NoteSortBy>(
    () => parseNoteSortBy(localStorage.getItem(NOTE_SORT_BY_KEY)),
  );
  const [noteSortDirection, setNoteSortDirection] = useState<NoteSortDirection>(
    () => parseNoteSortDirection(localStorage.getItem(NOTE_SORT_DIRECTION_KEY)),
  );
  const [todoSortBy, setTodoSortBy] = useState<NoteSortBy>(
    () => parseTodoSortBy(localStorage.getItem(TODO_SORT_BY_KEY)),
  );
  const [todoSortDirection, setTodoSortDirection] = useState<NoteSortDirection>(
    () => {
      const stored = localStorage.getItem(TODO_SORT_DIRECTION_KEY);
      return stored === 'asc' || stored === 'desc'
        ? stored
        : DEFAULT_TODO_SORT_DIRECTION;
    },
  );
  const [todoStatus, setTodoStatus] = useState<TodoStatus>(
    () => parseTodoStatus(localStorage.getItem(TODO_STATUS_KEY)),
  );
  const [showNoteSummary, setShowNoteSummary] = useState(
    () => parseShowNoteSummary(localStorage.getItem(NOTE_LIST_SUMMARY_KEY)),
  );
  const [noteTagPanelOpen, setNoteTagPanelOpen] = useState(
    () => parseNoteTagPanelOpen(localStorage.getItem(NOTE_TAG_PANEL_OPEN_KEY)),
  );
  const [noteTagPanelRatio, setNoteTagPanelRatio] = useState(
    () => parseNoteTagPanelRatio(localStorage.getItem(NOTE_TAG_PANEL_RATIO_KEY)),
  );
  const [selectedNoteTag, setSelectedNoteTag] = useState('');
  const [editorPreferences, setEditorPreferences] = useState(
    () => parseEditorPreferences(
      localStorage.getItem(EDITOR_PREFERENCES_KEY),
      localStorage.getItem(SOURCE_LINE_NUMBERS_KEY),
      window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
    ),
  );
  const [editorPreferencesLoaded, setEditorPreferencesLoaded] = useState(false);
  const [searchScope, setSearchScope] = useState<SearchScope>(
    () => parseSearchScope(localStorage.getItem(SEARCH_SCOPE_KEY)),
  );
  const [searchField, setSearchField] = useState<SearchField>(
    () => parseSearchField(localStorage.getItem(SEARCH_FIELD_KEY)),
  );
  const [searchCaseSensitive, setSearchCaseSensitive] = useState(
    () => parseSearchToggle(localStorage.getItem(SEARCH_CASE_SENSITIVE_KEY)),
  );
  const [searchWholeWord, setSearchWholeWord] = useState(
    () => parseSearchToggle(localStorage.getItem(SEARCH_WHOLE_WORD_KEY)),
  );
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() =>
    localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true',
  );
  const [collapsedNotebookIds, setCollapsedNotebookIds] = useState<Set<string>>(() =>
    parseCollapsedNotebookIds(localStorage.getItem(COLLAPSED_NOTEBOOKS_KEY)),
  );
  const [sidebarTab, setSidebarTab] = useState<'notebooks' | 'tags'>(() =>
    localStorage.getItem(SIDEBAR_TAB_KEY) === 'tags' ? 'tags' : 'notebooks',
  );
  const [notebookContextMenu, setNotebookContextMenu] = useState<{
    notebook: Notebook;
    x: number;
    y: number;
  } | null>(null);
  const [noteContextMenu, setNoteContextMenu] = useState<{
    note: NoteSummary;
    x: number;
    y: number;
  } | null>(null);
  const [noteContextExportOpen, setNoteContextExportOpen] = useState(false);
  const [moveNoteDialog, setMoveNoteDialog] = useState<NoteSummary | null>(null);
  const [todoDueDialog, setTodoDueDialog] = useState<{
    note: TodoDueNote;
    value: string;
  } | null>(null);
  const [notebookDialog, setNotebookDialog] = useState<NotebookDialogState | null>(null);
  const [newNotebookMenuOpen, setNewNotebookMenuOpen] = useState(false);
  const [newNotebookMenuPosition, setNewNotebookMenuPosition] =
    useState<FloatingMenuPosition | null>(null);
  const [notebookPickerSearch, setNotebookPickerSearch] = useState('');
  const [draggingNoteID, setDraggingNoteID] = useState('');
  const [dropNotebookID, setDropNotebookID] = useState('');
  const [isWindowMaximized, setIsWindowMaximized] = useState(false);
  const [baseFontSize, setBaseFontSize] = useState(() =>
    normalizeBaseFontSize(localStorage.getItem(BASE_FONT_SIZE_KEY) ?? DEFAULT_BASE_FONT_SIZE),
  );
  const [fontFamily, setFontFamily] = useState(() =>
    sanitizeFontFamily(localStorage.getItem(FONT_FAMILY_KEY)) || DEFAULT_FONT_FAMILY,
  );
  const [customFontSelected, setCustomFontSelected] = useState(() => {
    const stored = sanitizeFontFamily(localStorage.getItem(FONT_FAMILY_KEY));
    return !!stored && !FONT_PRESETS.some((preset) => preset.value === stored);
  });
  const [appearanceLoaded, setAppearanceLoaded] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>(() =>
    window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
  );
  const { confirm: confirmAction, dialog: confirmDialog } = useConfirmDialog();
  const saveTimer = useRef<number | null>(null);
  const editorRef = useRef<VditorEditorHandle | null>(null);
  const notebookDialogInputRef = useRef<HTMLInputElement | null>(null);
  const newNotebookMenuRef = useRef<HTMLDivElement | null>(null);
  const newNotebookMenuPopoverRef = useRef<HTMLDivElement | null>(null);
  const noteListContentRef = useRef<HTMLDivElement | null>(null);
  const editorTabsRef = useRef(editorTabs);
  const viewRef = useRef(view);
  const currentRef = useRef(current);
  const editorNoteCacheRef = useRef(editorNoteCache);
  const initializedRef = useRef(false);
  const dirtyRef = useRef(false);
  const savingRef = useRef(false);
  const pendingSaveRef = useRef(false);
  const listRequestRef = useRef(0);
  const dashboardRequestRef = useRef(0);
  const lastListFilterRef = useRef('');
  const lastSummaryToggleAtRef = useRef(0);

  currentRef.current = current;
  viewRef.current = view;
  editorTabsRef.current = editorTabs;
  editorNoteCacheRef.current = editorNoteCache;

  useEffect(() => {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(sidebarCollapsed));
    if (sidebarCollapsed) setNewNotebookMenuOpen(false);
  }, [sidebarCollapsed]);

  useEffect(() => {
    localStorage.setItem(COLLAPSED_NOTEBOOKS_KEY, JSON.stringify([...collapsedNotebookIds]));
  }, [collapsedNotebookIds]);

  useEffect(() => {
    localStorage.setItem(SIDEBAR_TAB_KEY, sidebarTab);
    setNotebookContextMenu(null);
    setNewNotebookMenuOpen(false);
  }, [sidebarTab]);

  useEffect(() => {
    if (!notebookContextMenu) return;
    const close = () => setNotebookContextMenu(null);
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    window.addEventListener('pointerdown', close);
    window.addEventListener('blur', close);
    window.addEventListener('keydown', closeOnEscape);
    document.addEventListener('scroll', close, true);
    return () => {
      window.removeEventListener('pointerdown', close);
      window.removeEventListener('blur', close);
      window.removeEventListener('keydown', closeOnEscape);
      document.removeEventListener('scroll', close, true);
    };
  }, [notebookContextMenu]);

  useEffect(() => {
    if (!newNotebookMenuOpen) return undefined;
    const trigger = newNotebookMenuRef.current;
    const popover = newNotebookMenuPopoverRef.current;
    const close = (event: PointerEvent) => {
      const target = event.target as Node;
      if (trigger?.contains(target) || popover?.contains(target)) return;
      setNewNotebookMenuOpen(false);
    };
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setNewNotebookMenuOpen(false);
      window.requestAnimationFrame(() => trigger?.querySelector('button')?.focus());
    };
    const closeOnViewportChange = () => setNewNotebookMenuOpen(false);
    window.addEventListener('pointerdown', close);
    window.addEventListener('blur', closeOnViewportChange);
    window.addEventListener('resize', closeOnViewportChange);
    window.addEventListener('keydown', closeOnEscape);
    document.addEventListener('scroll', closeOnViewportChange, true);
    return () => {
      window.removeEventListener('pointerdown', close);
      window.removeEventListener('blur', closeOnViewportChange);
      window.removeEventListener('resize', closeOnViewportChange);
      window.removeEventListener('keydown', closeOnEscape);
      document.removeEventListener('scroll', closeOnViewportChange, true);
    };
  }, [newNotebookMenuOpen]);

  useEffect(() => {
    if (!newNotebookMenuOpen) return undefined;
    const frame = window.requestAnimationFrame(() => {
      newNotebookMenuPopoverRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [newNotebookMenuOpen]);

  useEffect(() => {
    if (!noteContextMenu) return;
    const close = () => {
      setNoteContextMenu(null);
      setNoteContextExportOpen(false);
    };
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    window.addEventListener('pointerdown', close);
    window.addEventListener('blur', close);
    window.addEventListener('keydown', closeOnEscape);
    document.addEventListener('scroll', close, true);
    return () => {
      window.removeEventListener('pointerdown', close);
      window.removeEventListener('blur', close);
      window.removeEventListener('keydown', closeOnEscape);
      document.removeEventListener('scroll', close, true);
    };
  }, [noteContextMenu]);

  useEffect(() => {
    if (!notebookDialog) return undefined;
    const frame = window.requestAnimationFrame(() => {
      notebookDialogInputRef.current?.focus();
      if (notebookDialog.mode === 'rename') notebookDialogInputRef.current?.select();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [notebookDialog?.mode, notebookDialog?.notebook?.id]);

  useEffect(() => {
    if (!exportMenuOpen) return;
    const close = () => setExportMenuOpen(false);
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    window.addEventListener('pointerdown', close);
    window.addEventListener('blur', close);
    window.addEventListener('keydown', closeOnEscape);
    document.addEventListener('scroll', close, true);
    return () => {
      window.removeEventListener('pointerdown', close);
      window.removeEventListener('blur', close);
      window.removeEventListener('keydown', closeOnEscape);
      document.removeEventListener('scroll', close, true);
    };
  }, [exportMenuOpen]);

  useEffect(() => {
    if (!attachmentMenuOpen) return;
    const close = () => setAttachmentMenuOpen(false);
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    window.addEventListener('pointerdown', close);
    window.addEventListener('blur', close);
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      window.removeEventListener('pointerdown', close);
      window.removeEventListener('blur', close);
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [attachmentMenuOpen]);

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, String(leftWidth));
  }, [leftWidth]);

  useEffect(() => {
    localStorage.setItem(NOTE_LIST_WIDTH_KEY, String(listWidth));
  }, [listWidth]);

  useEffect(() => {
    localStorage.setItem(NOTE_LIST_COLLAPSED_KEY, String(noteListCollapsed));
  }, [noteListCollapsed]);

  useEffect(() => {
    localStorage.setItem(NOTE_SORT_BY_KEY, noteSortBy);
  }, [noteSortBy]);

  useEffect(() => {
    localStorage.setItem(NOTE_SORT_DIRECTION_KEY, noteSortDirection);
  }, [noteSortDirection]);

  useEffect(() => {
    localStorage.setItem(TODO_SORT_BY_KEY, todoSortBy);
  }, [todoSortBy]);

  useEffect(() => {
    localStorage.setItem(TODO_SORT_DIRECTION_KEY, todoSortDirection);
  }, [todoSortDirection]);

  useEffect(() => {
    localStorage.setItem(TODO_STATUS_KEY, todoStatus);
  }, [todoStatus]);

  useEffect(() => {
    localStorage.setItem(NOTE_LIST_SUMMARY_KEY, String(showNoteSummary));
  }, [showNoteSummary]);

  useEffect(() => {
    localStorage.setItem(NOTE_TAG_PANEL_OPEN_KEY, String(noteTagPanelOpen));
  }, [noteTagPanelOpen]);

  useEffect(() => {
    localStorage.setItem(NOTE_TAG_PANEL_RATIO_KEY, String(noteTagPanelRatio));
  }, [noteTagPanelRatio]);

  useEffect(() => {
    if (!noteTagPanelOpen) setSelectedNoteTag('');
  }, [noteTagPanelOpen]);

  useEffect(() => {
    const root = document.documentElement;
    for (const variable of SOURCE_APPEARANCE_VARIABLE_NAMES) {
      root.style.removeProperty(variable);
    }
    for (
      const [variable, value] of Object.entries(
        sourceTypographyCSSVariables(editorPreferences.sourceTypography),
      )
    ) {
      root.style.setProperty(variable, value);
    }
    if (editorPreferences.customSourceAppearance) {
      const profile = editorPreferences.sourceAppearance[theme];
      for (const [variable, value] of Object.entries(sourceColorCSSVariables(profile))) {
        root.style.setProperty(variable, value);
      }
    }
  }, [editorPreferences, theme]);

  useEffect(() => {
    if (!editorPreferencesLoaded) return undefined;
    const serialized = serializeEditorPreferences(editorPreferences);
    localStorage.setItem(EDITOR_PREFERENCES_KEY, serialized);
    const timer = window.setTimeout(() => {
      void api.setSetting(EDITOR_PREFERENCES_SETTING, serialized);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [editorPreferences, editorPreferencesLoaded]);

  useEffect(() => {
    localStorage.setItem(SEARCH_SCOPE_KEY, searchScope);
  }, [searchScope]);

  useEffect(() => {
    localStorage.setItem(SEARCH_FIELD_KEY, searchField);
  }, [searchField]);

  useEffect(() => {
    localStorage.setItem(SEARCH_CASE_SENSITIVE_KEY, String(searchCaseSensitive));
  }, [searchCaseSensitive]);

  useEffect(() => {
    localStorage.setItem(SEARCH_WHOLE_WORD_KEY, String(searchWholeWord));
  }, [searchWholeWord]);

  useEffect(() => {
    localStorage.setItem(EDITOR_TABS_KEY, JSON.stringify(editorTabs));
  }, [editorTabs]);

  useEffect(() => {
    if (!current.id) return;
    setEditorTabs((tabs) => updateEditorTabTitle(tabs, current.id, current.title || '未命名筆記'));
  }, [current.id, current.title]);

  useEffect(() => {
    if (shouldExpandNoteList(noteListCollapsed, Boolean(current.id))) {
      setNoteListCollapsed(false);
    }
  }, [current.id, noteListCollapsed]);

  useEffect(() => {
    const scale = typographyScale(baseFontSize);
    const root = document.documentElement;
    root.style.setProperty('--font-size-base', `${scale.base}px`);
    root.style.setProperty('--font-size-display', `${scale.display}px`);
    root.style.setProperty('--font-size-subtitle', `${scale.subtitle}px`);
    root.style.setProperty('--font-size-secondary', `${scale.secondary}px`);
    root.style.setProperty('--font-family-ui', fontFamilyStack(fontFamily));
  }, [baseFontSize, fontFamily]);

  useEffect(() => {
    if (!appearanceLoaded) return;
    localStorage.setItem(BASE_FONT_SIZE_KEY, String(baseFontSize));
    localStorage.setItem(FONT_FAMILY_KEY, fontFamily);
    void api.setSetting(FONT_SIZE_SETTING, JSON.stringify(baseFontSize));
    void api.setSetting(FONT_FAMILY_SETTING, JSON.stringify(fontFamily));
  }, [appearanceLoaded, baseFontSize, fontFamily]);

  useEffect(() => {
    if (!pdfSettingsLoaded) return undefined;
    const timer = window.setTimeout(() => {
      void api.setSetting(
        PDF_FOOTER_TEXT_KEY,
        JSON.stringify(sanitizePDFSettingText(pdfFooterCopyright, PDF_FOOTER_MAX_LENGTH)),
      );
      void api.setSetting(
        PDF_WATERMARK_TEXT_KEY,
        JSON.stringify(sanitizePDFSettingText(pdfWatermarkText, PDF_WATERMARK_MAX_LENGTH)),
      );
      void api.setSetting(
        PDF_FOOTER_ENABLED_KEY,
        String(pdfFooterEnabled),
      );
      void api.setSetting(
        PDF_WATERMARK_ENABLED_KEY,
        String(pdfWatermarkEnabled),
      );
      void api.setSetting(PDF_WATERMARK_WIDTH_KEY, String(pdfWatermarkWidth));
      void api.setSetting(PDF_WATERMARK_HEIGHT_KEY, String(pdfWatermarkHeight));
      void api.setSetting(PDF_WATERMARK_FONT_SIZE_KEY, String(pdfWatermarkFontSize));
      void api.setSetting(PDF_WATERMARK_OPACITY_KEY, String(pdfWatermarkOpacity));
      void api.setSetting(PDF_WATERMARK_ANGLE_KEY, String(pdfWatermarkAngle));
      void api.setSetting(
        PDF_WATERMARK_SHOW_BORDER_KEY,
        String(pdfWatermarkShowBorder),
      );
      void api.setSetting(
        PDF_COVER_DESIGN_KEY,
        serializePDFCoverDesign(pdfCoverDesign),
      );
    }, 250);
    return () => window.clearTimeout(timer);
  }, [
    pdfFooterEnabled,
    pdfCoverDesign,
    pdfFooterCopyright,
    pdfSettingsLoaded,
    pdfWatermarkAngle,
    pdfWatermarkFontSize,
    pdfWatermarkHeight,
    pdfWatermarkOpacity,
    pdfWatermarkShowBorder,
    pdfWatermarkText,
    pdfWatermarkWidth,
    pdfWatermarkEnabled,
  ]);

  useEffect(() => {
    const syncWindowState = () => {
      void api.isWindowMaximized().then(setIsWindowMaximized);
    };
    window.addEventListener('resize', syncWindowState);
    syncWindowState();
    return () => window.removeEventListener('resize', syncWindowState);
  }, []);

  const notify = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast((value) => value === message ? '' : value), 2800);
  }, []);

  const refreshDashboard = useCallback(async () => {
    const requestID = ++dashboardRequestRef.current;
    setDashboardLoading(true);
    try {
      const snapshot = await api.dashboard();
      if (requestID !== dashboardRequestRef.current) return;
      setDashboardSnapshot(snapshot);
      setDashboardError('');
    } catch (error) {
      if (requestID !== dashboardRequestRef.current) return;
      setDashboardError(errorMessage(error));
    } finally {
      if (requestID === dashboardRequestRef.current) setDashboardLoading(false);
    }
  }, []);

  const cacheEditorNote = useCallback((note: Note) => {
    if (!note.id) return;
    if (editorNoteCacheRef.current[note.id] === note) return;
    const next = { ...editorNoteCacheRef.current, [note.id]: note };
    editorNoteCacheRef.current = next;
    setEditorNoteCache(next);
  }, []);

  const forgetEditorNotes = useCallback((ids: string[]) => {
    const forgotten = new Set(ids.filter(Boolean));
    if (forgotten.size === 0) return;
    const nextCache = Object.fromEntries(
      Object.entries(editorNoteCacheRef.current).filter(([id]) => !forgotten.has(id)),
    ) as Record<string, Note>;
    editorNoteCacheRef.current = nextCache;
    setEditorNoteCache(nextCache);
    setMountedEditorIDs((mounted) => {
      if (![...forgotten].some((id) => mounted.has(id))) return mounted;
      return new Set([...mounted].filter((id) => !forgotten.has(id)));
    });
  }, []);

  const mountEditorNote = useCallback((id: string) => {
    if (!id) return;
    setMountedEditorIDs((mounted) => {
      if (mounted.has(id)) return mounted;
      const next = new Set(mounted);
      next.add(id);
      return next;
    });
  }, []);

  const refreshTaxonomy = useCallback(async () => {
    const [nextNotebooks, nextTags] = await Promise.all([api.listNotebooks(), api.listTags()]);
    setNotebooks(nextNotebooks);
    setTags(nextTags);
    setView((current) => {
      if (current.kind === 'notebook' &&
        !nextNotebooks.some((notebook) => notebook.id === current.id)) {
        return { kind: 'all' };
      }
      if (current.kind === 'tag' && !nextTags.some((tag) => tag.id === current.id)) {
        return { kind: 'all' };
      }
      return current;
    });
  }, []);

  const searchNotebookID = view.kind === 'notebook' ? view.id : current.notebookId;
  const effectiveSearchScope = searchNotebookID ? searchScope : 'all';
  const searching = search.trim() !== '';
  const activeSortBy = view.kind === 'todo' ? todoSortBy : noteSortBy;
  const activeSortDirection = view.kind === 'todo'
    ? todoSortDirection
    : noteSortDirection;
  const updateActiveSortBy = (value: NoteSortBy) => {
    if (view.kind === 'todo') setTodoSortBy(value);
    else setNoteSortBy(value);
  };
  const toggleActiveSortDirection = () => {
    if (view.kind === 'todo') {
      setTodoSortDirection((value) => value === 'asc' ? 'desc' : 'asc');
    } else {
      setNoteSortDirection((value) => value === 'asc' ? 'desc' : 'asc');
    }
  };

  const listQuery = useCallback(() => {
    return buildNoteListQuery({
      view,
      search,
      searchScope: effectiveSearchScope,
      searchField,
      searchCaseSensitive,
      searchWholeWord,
      searchNotebookID,
      sortBy: activeSortBy,
      sortDirection: activeSortDirection,
      todoStatus: view.kind === 'todo' ? todoStatus : undefined,
      limit: 300,
      offset: 0,
    });
  }, [
    activeSortBy,
    activeSortDirection,
    effectiveSearchScope,
    search,
    searchCaseSensitive,
    searchField,
    searchNotebookID,
    searchWholeWord,
    todoStatus,
    view,
  ]);

  const listFilterKey = [
    view.kind,
    view.kind === 'notebook' || view.kind === 'tag' ? view.id : '',
    search,
    searching ? effectiveSearchScope : '',
    searching ? searchNotebookID : '',
    searchField,
    searchCaseSensitive ? 'case' : 'nocase',
    searchWholeWord ? 'word' : 'substring',
    view.kind === 'todo' ? todoStatus : '',
  ].join(':');

  const noteTags = useMemo(() => collectNoteTags(notes), [notes]);
  const visibleNotes = useMemo(
    () => filterNotesByTag(notes, selectedNoteTag),
    [notes, selectedNoteTag],
  );

  useEffect(() => {
    setSelectedNoteTag('');
  }, [listFilterKey]);

  useEffect(() => {
    if (
      selectedNoteTag &&
      !noteTags.some((tag) => tag.title === selectedNoteTag)
    ) {
      setSelectedNoteTag('');
    }
  }, [noteTags, selectedNoteTag]);

  const refreshNotes = useCallback(async () => {
    const requestID = ++listRequestRef.current;
    const preserveCurrent = lastListFilterRef.current === listFilterKey;
    lastListFilterRef.current = listFilterKey;
    try {
      const page = await api.listNotes(listQuery());
      if (requestID !== listRequestRef.current) return;
      setNotes(page.items);
      if (!preserveCurrent &&
        currentRef.current.id &&
        !page.items.some((note) => note.id === currentRef.current.id)) {
        setCurrent(emptyNote);
      }
    } catch (error) {
      if (requestID === listRequestRef.current) notify(errorMessage(error));
    }
  }, [listFilterKey, listQuery, notify]);

  const saveCurrent = useCallback(async (showConfirmation = false): Promise<boolean> => {
    const value = currentRef.current;
    if (!value.id) return false;
    if (savingRef.current) {
      pendingSaveRef.current = true;
      return false;
    }
    if (!dirtyRef.current) {
      if (showConfirmation) notify('沒有需要儲存的變更');
      return true;
    }
    const snapshotTitle = value.title;
    const snapshotBody = value.body;
    savingRef.current = true;
    setSaveState('saving');
    let saveFailed = false;
    try {
      const updated = await api.updateNote(noteToInput(value));
      cacheEditorNote({
        ...value,
        title: updated.title,
        updatedAt: updated.updatedAt,
        tags: updated.tags,
      });
      setCurrent((existing) => existing.id === updated.id
        ? { ...existing, title: updated.title, updatedAt: updated.updatedAt, tags: updated.tags }
        : existing);
      if (currentRef.current.id === updated.id &&
        currentRef.current.title === snapshotTitle &&
        currentRef.current.body === snapshotBody) {
        dirtyRef.current = false;
      }
      await refreshNotes();
      if (showConfirmation) notify('筆記已儲存');
    } catch (error) {
      saveFailed = true;
      notify(`儲存失敗：${errorMessage(error)}`);
    } finally {
      savingRef.current = false;
      setSaveState(dirtyRef.current ? 'dirty' : saveFailed ? 'error' : 'saved');
      if (pendingSaveRef.current) {
        pendingSaveRef.current = false;
        if (dirtyRef.current && !saveFailed) {
          window.setTimeout(() => { void saveCurrent(); }, 0);
        }
      }
    }
    return !saveFailed && !dirtyRef.current;
  }, [cacheEditorNote, notify, refreshNotes]);

  const cleanupUnusedResources = useCallback(async () => {
    if (resourceCleanupRunning) return;
    const confirmed = await confirmAction({
      title: '資源檔清理',
      message: '將永久刪除未被任何筆記引用的 PuffJoplin 資源，以及 data\\resources 內沒有索引的孤兒檔。垃圾桶中的引用會保留；直接管理筆記本的外部檔案不會處理。',
      confirmLabel: '開始清理',
      tone: 'danger',
    });
    if (!confirmed) return;
    if (savingRef.current) {
      const message = '筆記正在儲存，請稍後再執行資源檔清理。';
      setResourceCleanupResult(message);
      notify(message);
      return;
    }
    if (saveTimer.current !== null) {
      window.clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    if (dirtyRef.current) {
      const saved = await saveCurrent();
      if (!saved) {
        const message = '筆記尚未儲存完成，已取消資源檔清理。';
        setResourceCleanupResult(message);
        notify(message);
        return;
      }
    }

    setResourceCleanupRunning(true);
    setResourceCleanupResult('');
    try {
      const report = await api.cleanupUnusedResources();
      const message = resourceCleanupMessage(report);
      setResourceCleanupResult(message);
      notify(message);
      try {
        await Promise.all([refreshNotes(), refreshDashboard()]);
        const activeID = currentRef.current.id;
        if (activeID) {
          const refreshed = await api.getNote(activeID);
          cacheEditorNote(refreshed);
          setCurrent((note) => note.id === refreshed.id ? refreshed : note);
        }
      } catch (error) {
        notify(`資源已清理，但重新整理筆記失敗：${errorMessage(error)}`);
      }
    } catch (error) {
      const message = `資源清理失敗：${errorMessage(error)}`;
      setResourceCleanupResult(message);
      notify(message);
    } finally {
      setResourceCleanupRunning(false);
    }
  }, [
    cacheEditorNote,
    notify,
    refreshDashboard,
    refreshNotes,
    resourceCleanupRunning,
    saveCurrent,
    confirmAction,
  ]);

  const loadManagedDirectoryExclusions = useCallback(async () => {
    setManagedExclusionsLoading(true);
    setManagedExclusionsError('');
    setManagedExclusionsResult('');
    setFolderExclusionInput('');
    setMarkdownExclusionInput('');
    try {
      const value = await api.getManagedDirectoryExclusions();
      setManagedExclusions(value);
      setSavedManagedExclusions(value);
    } catch (error) {
      const message = `讀取直接管理筆記本排除設定失敗：${errorMessage(error)}`;
      setManagedExclusionsError(message);
      notify(message);
    } finally {
      setManagedExclusionsLoading(false);
    }
  }, [notify]);

  const addManagedExclusion = (kind: 'folder' | 'markdown') => {
    const input = kind === 'folder' ? folderExclusionInput : markdownExclusionInput;
    const result = addManagedExclusionName(managedExclusions, kind, input);
    if (result.error) {
      setManagedExclusionsError(result.error);
      return;
    }
    setManagedExclusions(result.exclusions);
    setManagedExclusionsError('');
    setManagedExclusionsResult('');
    if (kind === 'folder') setFolderExclusionInput('');
    else setMarkdownExclusionInput('');
  };

  const removeManagedExclusion = (kind: 'folder' | 'markdown', name: string) => {
    setManagedExclusions((value) => removeManagedExclusionName(value, kind, name));
    setManagedExclusionsError('');
    setManagedExclusionsResult('');
  };

  const applyManagedDirectoryExclusions = async () => {
    if (managedExclusionsApplying) return;
    if (managedDirectoryExclusionsEqual(managedExclusions, savedManagedExclusions)) {
      setManagedExclusionsResult('目前沒有尚未套用的變更。');
      return;
    }
    const confirmed = await confirmAction({
      title: '套用直接管理筆記本排除',
      message: '規則會套用到所有直接管理筆記本。符合規則的筆記與資料夾會立即從 PuffJoplin 隱藏，已開啟的相關分頁會關閉；磁碟上的檔案不會被刪除。',
      confirmLabel: '套用規則',
    });
    if (!confirmed) return;
    setManagedExclusionsApplying(true);
    setManagedExclusionsError('');
    setManagedExclusionsResult('');
    try {
      const report = await api.setManagedDirectoryExclusions(managedExclusions);
      setManagedExclusions(report.exclusions);
      setSavedManagedExclusions(report.exclusions);
      const message = managedDirectoryExclusionMessage(report);
      setManagedExclusionsResult(message);
      notify(message);
    } catch (error) {
      const message = `套用直接管理筆記本排除失敗：${errorMessage(error)}`;
      setManagedExclusionsError(message);
      notify(message);
    } finally {
      setManagedExclusionsApplying(false);
    }
  };

  const scheduleSave = useCallback(() => {
    if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      saveTimer.current = null;
      void saveCurrent();
    }, 650);
  }, [saveCurrent]);

  const selectNote = useCallback(async (id: string, mode: 'open' | 'activate' = 'open') => {
    if (!id || currentRef.current.id === id) return;
    if (currentRef.current.id && currentRef.current.id !== id) {
      cacheEditorNote(currentRef.current);
    }
    if (currentRef.current.id && currentRef.current.id !== id && dirtyRef.current) {
      const saved = await saveCurrent();
      if (!saved) return;
    }
    const tabs = editorTabsRef.current;
    const tabIsOpen = tabs.activeID === id ||
      tabs.preview?.id === id ||
      tabs.pinned.some((tab) => tab.id === id);
    let note = tabIsOpen ? editorNoteCacheRef.current[id] : undefined;
    if (!note) {
      try {
        note = await api.getNote(id);
      } catch (error) {
        setEditorTabs((state) => removeNoteFromEditorTabs(state, id));
        forgetEditorNotes([id]);
        notify(`無法開啟筆記：${errorMessage(error)}`);
        return;
      }
    }
    cacheEditorNote(note);
    mountEditorNote(note.id);
    setCurrent(note);
    setEditorTabs((state) => mode === 'open'
      ? openEditorNote(state, { id: note.id, title: note.title || '未命名筆記' })
      : activateEditorTabState(state, note.id));
    setSaveState('saved');
    setExportMenuOpen(false);
    setAttachmentMenuOpen(false);
  }, [cacheEditorNote, forgetEditorNotes, mountEditorNote, notify, saveCurrent]);

  const openDashboardNote = useCallback(async (noteID: string) => {
    setView({ kind: 'all' });
    await selectNote(noteID);
  }, [selectNote]);

  const completeDashboardTodo = useCallback(async (noteID: string, todoDue: number) => {
    try {
      const completedAt = Date.now();
      await api.setNoteTodo(noteID, true, todoDue, completedAt);
      if (currentRef.current.id === noteID) {
        const updated = {
          ...currentRef.current,
          isTodo: true,
          todoDue,
          todoCompleted: completedAt,
        };
        cacheEditorNote(updated);
        setCurrent(updated);
      }
      await Promise.all([refreshNotes(), refreshDashboard()]);
      notify('待辦已標記完成');
    } catch (error) {
      notify(`完成待辦失敗：${errorMessage(error)}`);
    }
  }, [cacheEditorNote, notify, refreshDashboard, refreshNotes]);

  const activateEditorTab = useCallback(async (id: string, cacheOutgoing = true) => {
    if (!id || currentRef.current.id === id) return;
    const outgoing = currentRef.current;
    if (cacheOutgoing && outgoing.id) cacheEditorNote(outgoing);
    if (cacheOutgoing && outgoing.id && dirtyRef.current) {
      const saved = await saveCurrent();
      if (!saved) return;
    }
    let note = editorNoteCacheRef.current[id];
    if (!note) {
      try {
        note = await api.getNote(id);
      } catch (error) {
        setEditorTabs((tabs) => removeNoteFromEditorTabs(tabs, id));
        forgetEditorNotes([id]);
        notify(`無法開啟筆記：${errorMessage(error)}`);
        return;
      }
    }
    cacheEditorNote(note);
    mountEditorNote(id);
    setCurrent(note);
    setEditorTabs((tabs) => activateEditorTabState(tabs, id));
    setSaveState('saved');
    setExportMenuOpen(false);
    setAttachmentMenuOpen(false);
  }, [cacheEditorNote, forgetEditorNotes, mountEditorNote, notify, saveCurrent]);

  const toggleOpenTabPin = useCallback((id: string) => {
    setEditorTabs((tabs) => toggleEditorTabPin(tabs, id));
  }, []);

  const closeOpenTab = useCallback(async (id: string) => {
    const tabs = editorTabsRef.current;
    const wasActive = tabs.activeID === id;
    if (wasActive && dirtyRef.current) {
      const saved = await saveCurrent();
      if (!saved) return;
    }
    const nextTabs = closeEditorTab(tabs, id);
    setEditorTabs(nextTabs);
    forgetEditorNotes([id]);
    if (!wasActive) return;
    if (nextTabs.activeID) await activateEditorTab(nextTabs.activeID, false);
    else setCurrent(emptyNote);
  }, [activateEditorTab, forgetEditorNotes, saveCurrent]);

  const createWelcomeNote = useCallback(async () => {
    const page = await api.listNotes({ view: 'all', limit: 1, offset: 0 });
    if (page.items.length > 0) return;
    const firstNotebook = (await api.listNotebooks())[0];
    if (!firstNotebook) return;
    const note = await api.createNote(firstNotebook.id, '歡迎使用 PuffJoplin', [
      '# 歡迎使用 PuffJoplin',
      '',
      '這是一套以 Go 與 Wails 打造的離線桌面筆記軟體。',
      '',
      '## 開始使用',
      '',
      '- 使用左側筆記本整理內容',
      '- 在筆記上加入標籤',
      '- 使用 `Ctrl+N` 建立新筆記',
      '- 從 Joplin profile 或 JEX 匯入既有資料',
      '',
      '> 所有資料都保存在程式旁的 `data` 資料夾。',
    ].join('\n'));
    cacheEditorNote(note);
    mountEditorNote(note.id);
    setCurrent(note);
    setEditorTabs((tabs) => openEditorNote(tabs, { id: note.id, title: note.title }));
    await Promise.all([refreshTaxonomy(), refreshNotes()]);
  }, [cacheEditorNote, mountEditorNote, refreshNotes, refreshTaxonomy]);

  const restoreEditorTabSession = useCallback(async (): Promise<Note | null> => {
    const saved = editorTabsRef.current;
    const notesByID = new Map<string, Note>();
    const pinned: EditorTab[] = [];
    for (const tab of saved.pinned) {
      try {
        const note = await api.getNote(tab.id);
        notesByID.set(note.id, note);
        pinned.push({
          id: note.id,
          title: note.title || '未命名筆記',
          mode: tab.mode,
          previewMode: tab.previewMode,
        });
      } catch {
        // Stale tabs are removed below.
      }
    }
    let preview: EditorTab | null = null;
    if (saved.preview) {
      try {
        const note = await api.getNote(saved.preview.id);
        notesByID.set(note.id, note);
        preview = {
          id: note.id,
          title: note.title || '未命名筆記',
          mode: saved.preview.mode,
          previewMode: saved.preview.previewMode,
        };
      } catch {
        // Stale preview is removed below.
      }
    }
    const tabs = normalizeEditorTabs({ pinned, preview, activeID: saved.activeID });
    setEditorTabs(tabs);
    const restoredCache = Object.fromEntries(notesByID) as Record<string, Note>;
    editorNoteCacheRef.current = restoredCache;
    setEditorNoteCache(restoredCache);
    if (tabs.activeID) mountEditorNote(tabs.activeID);
    if (!tabs.activeID) return null;
    if (notesByID.has(tabs.activeID)) return notesByID.get(tabs.activeID) || null;
    try {
      return await api.getNote(tabs.activeID);
    } catch {
      return null;
    }
  }, [mountEditorNote]);

  const initialize = useCallback(async () => {
    try {
      const state = await api.bootstrap();
      await refreshTaxonomy();
      const settings = await api.settings();
      const storedTheme = settings.theme?.replaceAll('"', '');
      if (storedTheme === 'dark' || storedTheme === 'light') setTheme(storedTheme);
      const storedFontSize = decodeStoredString(settings[FONT_SIZE_SETTING]);
      const storedFontFamily = sanitizeFontFamily(decodeStoredString(settings[FONT_FAMILY_SETTING]));
      const nextFontSize = storedFontSize
        ? normalizeBaseFontSize(storedFontSize)
        : normalizeBaseFontSize(localStorage.getItem(BASE_FONT_SIZE_KEY) ?? DEFAULT_BASE_FONT_SIZE);
      const nextFontFamily = storedFontFamily ||
        sanitizeFontFamily(localStorage.getItem(FONT_FAMILY_KEY)) ||
        DEFAULT_FONT_FAMILY;
      setBaseFontSize(nextFontSize);
      setFontFamily(nextFontFamily);
      setCustomFontSelected(!FONT_PRESETS.some((preset) => preset.value === nextFontFamily));
      setEditorPreferences(parseEditorPreferences(
        settings[EDITOR_PREFERENCES_SETTING] ?? localStorage.getItem(EDITOR_PREFERENCES_KEY),
        localStorage.getItem(SOURCE_LINE_NUMBERS_KEY),
        storedTheme === 'dark' || storedTheme === 'light' ? storedTheme : theme,
      ));
      setPdfFooterCopyright(sanitizePDFSettingText(
        decodePDFSettingText(settings[PDF_FOOTER_TEXT_KEY]),
        PDF_FOOTER_MAX_LENGTH,
      ));
      setPdfWatermarkText(sanitizePDFSettingText(
        decodePDFSettingText(settings[PDF_WATERMARK_TEXT_KEY]),
        PDF_WATERMARK_MAX_LENGTH,
      ));
      setPdfFooterEnabled(
        settings[PDF_FOOTER_ENABLED_KEY] === undefined
          ? true
          : parsePDFDecorationsEnabled(settings[PDF_FOOTER_ENABLED_KEY]),
      );
      setPdfWatermarkEnabled(parsePDFDecorationsEnabled(
        settings[PDF_WATERMARK_ENABLED_KEY],
      ));
      setPdfCoverDesign(parsePDFCoverDesign(settings[PDF_COVER_DESIGN_KEY]));
      setPdfWatermarkWidth(normalizePDFInteger(
        decodePDFSettingNumber(settings[PDF_WATERMARK_WIDTH_KEY]),
        DEFAULT_PDF_WATERMARK_WIDTH,
        PDF_WATERMARK_WIDTH_RANGE,
      ));
      setPdfWatermarkHeight(normalizePDFInteger(
        decodePDFSettingNumber(settings[PDF_WATERMARK_HEIGHT_KEY]),
        DEFAULT_PDF_WATERMARK_HEIGHT,
        PDF_WATERMARK_HEIGHT_RANGE,
      ));
      setPdfWatermarkFontSize(normalizePDFInteger(
        decodePDFSettingNumber(settings[PDF_WATERMARK_FONT_SIZE_KEY]),
        DEFAULT_PDF_WATERMARK_FONT_SIZE,
        PDF_WATERMARK_FONT_SIZE_RANGE,
      ));
      setPdfWatermarkOpacity(normalizePDFInteger(
        decodePDFSettingNumber(settings[PDF_WATERMARK_OPACITY_KEY]),
        DEFAULT_PDF_WATERMARK_OPACITY,
        PDF_WATERMARK_OPACITY_RANGE,
      ));
      setPdfWatermarkAngle(normalizePDFInteger(
        decodePDFSettingNumber(settings[PDF_WATERMARK_ANGLE_KEY]),
        DEFAULT_PDF_WATERMARK_ANGLE,
        PDF_WATERMARK_ANGLE_RANGE,
      ));
      setPdfWatermarkShowBorder(parsePDFWatermarkShowBorder(
        settings[PDF_WATERMARK_SHOW_BORDER_KEY],
      ));
      setPdfSettingsLoaded(true);
      setAppearanceLoaded(true);
      setEditorPreferencesLoaded(true);
      setBootstrap(state);
      const page = await api.listNotes({ view: 'all', limit: 300, offset: 0 });
      setNotes(page.items);
      const decision = onboardingDecision(state);
      const restoredNote = await restoreEditorTabSession();
      if (restoredNote) {
        setCurrent(restoredNote);
        setSaveState('saved');
      } else if (page.items.length > 0) {
        await selectNote(page.items[0].id);
      } else if (decision === 'prompt-joplin') {
        try {
          setJoplinPreview(await api.inspectJoplinProfile());
        } catch (error) {
          setJoplinPreview({
            available: false,
            profilePath: state.joplinProfile,
            displayName: 'Joplin',
            notes: 0,
            notebooks: 0,
            resources: 0,
            encryptedNotes: 0,
            error: errorMessage(error),
          });
        }
      } else {
        await createWelcomeNote();
      }
    } catch (error) {
      setFatalError(errorMessage(error));
    }
  }, [createWelcomeNote, refreshTaxonomy, restoreEditorTabSession, selectNote]);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    void initialize();
  }, [initialize]);

  useEffect(() => {
    if (view.kind === 'dashboard') void refreshDashboard();
  }, [refreshDashboard, view.kind]);

  useEffect(() => {
    const cleanups = [
      onEvent('notes.changed', () => {
        void refreshNotes();
        if (viewRef.current.kind === 'dashboard') void refreshDashboard();
      }),
      onEvent('notebooks.changed', () => {
        void refreshTaxonomy();
        if (viewRef.current.kind === 'dashboard') void refreshDashboard();
      }),
      onEvent('tags.changed', () => {
        void refreshTaxonomy();
        if (viewRef.current.kind === 'dashboard') void refreshDashboard();
      }),
      onEvent('import.progress', (value) => {
        setImportProgress(value as { progress: number; message: string });
      }),
      onEvent('import.finished', () => setImportProgress(null)),
      onEvent('app.error', (value) => setFatalError(String(value))),
      onEvent('managedDirectory.refreshed', () => {
        const tabs = editorTabsRef.current;
        const openIDs = [...new Set([
          ...tabs.pinned.map((tab) => tab.id),
          ...(tabs.preview ? [tabs.preview.id] : []),
        ])];
        const directoryIDs = openIDs.filter((id) => {
          const note = id === currentRef.current.id
            ? currentRef.current
            : editorNoteCacheRef.current[id];
          return note?.storageKind === 'directory';
        });
        if (directoryIDs.length === 0) return;
        void Promise.allSettled(directoryIDs.map((id) => api.getNote(id)))
          .then(async (results) => {
            const missing: string[] = [];
            results.forEach((result, index) => {
              const id = directoryIDs[index];
              if (result.status === 'rejected') {
                missing.push(id);
                return;
              }
              const updated = result.value;
              const isActive = currentRef.current.id === updated.id;
              if (isActive && (dirtyRef.current || savingRef.current)) return;
              cacheEditorNote(updated);
              setEditorTabs((state) => updateEditorTabTitle(state, updated.id, updated.title));
              if (isActive && currentRef.current.id === updated.id) setCurrent(updated);
            });
            if (missing.length === 0) return;
            const nextTabs = missing.reduce(
              (state, id) => removeNoteFromEditorTabs(state, id),
              editorTabsRef.current,
            );
            setEditorTabs(nextTabs);
            forgetEditorNotes(missing);
            if (missing.includes(currentRef.current.id)) {
              if (nextTabs.activeID) await activateEditorTab(nextTabs.activeID, false);
              else setCurrent(emptyNote);
            }
          })
          .catch(() => undefined);
      }),
    ];
    return () => cleanups.forEach((cleanup) => cleanup());
  }, [
    activateEditorTab,
    cacheEditorNote,
    forgetEditorNotes,
    refreshDashboard,
    refreshNotes,
    refreshTaxonomy,
  ]);

  useEffect(() => {
    const onBeforeUnload = () => {
      if (currentRef.current.id) {
        void api.updateNote(noteToInput(currentRef.current));
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  useEffect(() => {
    void refreshNotes();
  }, [refreshNotes]);

  useEffect(() => {
    if (theme === 'dark') document.documentElement.dataset.theme = 'dark';
    else delete document.documentElement.dataset.theme;
    void api.setWindowTheme(theme);
    if (appearanceLoaded) void api.setSetting('theme', JSON.stringify(theme));
  }, [appearanceLoaded, theme]);

  useEffect(() => {
    const handler = (event: globalThis.KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      if (event.key.toLowerCase() === 's') {
        event.preventDefault();
        void saveCurrent(true);
      } else if (event.key.toLowerCase() === 'n') {
        event.preventDefault();
        void createNote();
      } else if (event.key.toLowerCase() === 'f') {
        event.preventDefault();
        document.getElementById('search-input')?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

  const activeNotebookId = view.kind === 'notebook'
    ? view.id
    : current.notebookId || notebooks[0]?.id || '';

  const createNote = useCallback(async () => {
    if (!activeNotebookId) {
      notify('請先建立筆記本');
      return;
    }
    try {
      await saveCurrent();
      let note = await api.createNote(activeNotebookId);
      if (view.kind === 'todo') {
        await api.setNoteTodo(note.id, true, 0, 0);
        note = { ...note, isTodo: true, todoDue: 0, todoCompleted: 0 };
      }
      cacheEditorNote(note);
      mountEditorNote(note.id);
      setCurrent(note);
      setEditorTabs((tabs) => openEditorNote(tabs, { id: note.id, title: note.title }));
      if (view.kind !== 'todo') setView({ kind: 'notebook', id: activeNotebookId });
      await Promise.all([refreshNotes(), refreshTaxonomy()]);
    } catch (error) {
      notify(`無法建立筆記：${errorMessage(error)}`);
    }
  }, [
    activeNotebookId,
    cacheEditorNote,
    mountEditorNote,
    notify,
    refreshNotes,
    refreshTaxonomy,
    saveCurrent,
    view.kind,
  ]);

  const toggleNewNotebookMenu = () => {
    if (newNotebookMenuOpen) {
      setNewNotebookMenuOpen(false);
      return;
    }
    const trigger = newNotebookMenuRef.current?.querySelector<HTMLButtonElement>('button');
    const sidebar = trigger?.closest<HTMLElement>('.sidebar');
    if (!trigger || !sidebar) return;
    const triggerRect = trigger.getBoundingClientRect();
    const sidebarRect = sidebar.getBoundingClientRect();
    setNewNotebookMenuPosition(placeSidebarActionMenu({
      triggerRight: triggerRect.right,
      triggerBottom: triggerRect.bottom,
      sidebarLeft: sidebarRect.left,
      sidebarRight: sidebarRect.right,
      preferredWidth: 224,
      viewportWidth: window.innerWidth,
    }));
    setNewNotebookMenuOpen(true);
  };

  const openCreateNotebookDialog = useCallback((parentID = '') => {
    setNewNotebookMenuOpen(false);
    setNotebookDialog({
      mode: 'create',
      parentId: parentID,
      notebook: null,
      value: '',
      error: '',
      saving: false,
    });
  }, []);

  const openManagedMarkdownNotebook = useCallback(async () => {
    setNewNotebookMenuOpen(false);
    try {
      const report = await api.openManagedMarkdownNotebook();
      await refreshTaxonomy();
      setSidebarTab('notebooks');
      setView({ kind: 'notebook', id: report.notebookId });
      setCollapsedNotebookIds((current) => {
        const next = new Set(current);
        next.delete(report.notebookId);
        return next;
      });
      const warning = report.skipped > 0 ? `，略過 ${report.skipped} 個項目` : '';
      notify(`已管理 ${report.rootPath}：${report.notes} 篇筆記${warning}`);
    } catch (error) {
      notify(`無法開啟 Markdown 目錄：${errorMessage(error)}`);
    }
  }, [notify, refreshTaxonomy]);

  const openRenameNotebookDialog = useCallback((notebook: Notebook) => {
    setNotebookDialog({
      mode: 'rename',
      parentId: '',
      notebook,
      value: notebook.title,
      error: '',
      saving: false,
    });
  }, []);

  const submitNotebookDialog = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const dialog = notebookDialog;
    if (!dialog || dialog.saving) return;
    const submission = prepareNotebookDialogSubmission(
      dialog.mode,
      dialog.value,
      dialog.notebook?.title,
    );
    if (submission.error) {
      setNotebookDialog((current) => current ? { ...current, error: submission.error } : current);
      return;
    }
    if (submission.unchanged) {
      setNotebookDialog(null);
      return;
    }
    setNotebookDialog((current) => current ? { ...current, error: '', saving: true } : current);
    try {
      if (dialog.mode === 'rename' && dialog.notebook) {
        await api.renameNotebook(dialog.notebook.id, submission.title);
        await Promise.all([refreshTaxonomy(), refreshNotes()]);
        notify('已重新命名筆記本');
      } else {
        const notebook = await api.createNotebook(submission.title, dialog.parentId);
        if (dialog.parentId) {
          setCollapsedNotebookIds((current) => {
            const next = new Set(current);
            next.delete(dialog.parentId);
            return next;
          });
        }
        await refreshTaxonomy();
        setView({ kind: 'notebook', id: notebook.id });
        notify('已建立筆記本');
      }
      setNotebookDialog(null);
    } catch (error) {
      const message = dialog.mode === 'rename'
        ? `重新命名失敗：${errorMessage(error)}`
        : `建立失敗：${errorMessage(error)}`;
      setNotebookDialog((current) => current ? { ...current, saving: false, error: message } : current);
    }
  }, [notebookDialog, notify, refreshNotes, refreshTaxonomy]);

  const closeNotebookDialog = useCallback(() => {
    if (notebookDialog?.saving) return;
    setNotebookDialog(null);
  }, [notebookDialog?.saving]);

  /*
   * Notebook create and rename are intentionally dialog-driven so the UI never
   * depends on WebView2's system prompt styling.
   */
  const openChildNotebookDialog = useCallback((notebook: Notebook) => {
    openCreateNotebookDialog(notebook.id);
  }, [openCreateNotebookDialog]);

  const deleteNotebook = useCallback(async (notebook: Notebook) => {
    const managed = notebook.storageKind === 'directory';
    const confirmed = await confirmAction({
      title: managed ? '停止管理資料夾' : '刪除筆記本',
      message: managed
        ? `要停止管理「${notebook.storageRoot}」嗎？磁碟上的 Markdown 與圖片不會被刪除。`
        : `確定要刪除「${notebook.title}」及其中的所有筆記嗎？此操作無法復原。`,
      confirmLabel: managed ? '停止管理' : '刪除筆記本',
      tone: managed ? 'default' : 'danger',
    });
    if (!confirmed) return;
    try {
      await api.deleteNotebook(notebook.id, !managed);
      setView({ kind: 'all' });
      setCurrent(emptyNote);
      await Promise.all([refreshTaxonomy(), refreshNotes()]);
    } catch (error) {
      notify(`${managed ? '停止管理' : '刪除'}失敗：${errorMessage(error)}`);
    }
  }, [confirmAction, notify, refreshNotes, refreshTaxonomy]);

  const refreshManagedNotebook = useCallback(async (notebook: Notebook) => {
    try {
      const report = await api.refreshManagedNotebook(notebook.id);
      await Promise.all([refreshTaxonomy(), refreshNotes()]);
      const warning = report.skipped > 0 ? `，略過 ${report.skipped} 個項目` : '';
      notify(`已重新整理：${report.notes} 篇筆記${warning}`);
    } catch (error) {
      notify(`重新整理失敗：${errorMessage(error)}`);
    }
  }, [notify, refreshNotes, refreshTaxonomy]);

  const revealNotebook = useCallback(async (notebook: Notebook) => {
    try {
      await api.revealNotebook(notebook.id);
    } catch (error) {
      notify(`無法開啟資料夾：${errorMessage(error)}`);
    }
  }, [notify]);

  const copyNoteFilePath = useCallback(async (note: NoteSummary) => {
    setNoteContextMenu(null);
    try {
      await api.copyNoteFilePath(note.id);
      notify('已複製 Markdown 檔案路徑');
    } catch (error) {
      notify(`複製檔案路徑失敗：${errorMessage(error)}`);
    }
  }, [notify]);

  const revealNoteFile = useCallback(async (note: NoteSummary) => {
    setNoteContextMenu(null);
    try {
      await api.revealNoteFile(note.id);
    } catch (error) {
      notify(`無法開啟檔案總管：${errorMessage(error)}`);
    }
  }, [notify]);

  const removeNoteFromWorkspace = useCallback(async (noteID: string) => {
    const nextTabs = removeNoteFromEditorTabs(editorTabsRef.current, noteID);
    setEditorTabs(nextTabs);
    forgetEditorNotes([noteID]);
    if (currentRef.current.id !== noteID) return;
    if (nextTabs.activeID) await activateEditorTab(nextTabs.activeID, false);
    else setCurrent(emptyNote);
  }, [activateEditorTab, forgetEditorNotes]);

  const trashNote = useCallback(async (
    note: Pick<NoteSummary, 'id' | 'title'>,
  ) => {
    if (!note.id) return;
    if (currentRef.current.id === note.id && savingRef.current) {
      notify('筆記正在儲存，請稍後再移至垃圾桶');
      return;
    }
    const confirmed = await confirmAction({
      title: '移至垃圾桶',
      message: `要將「${note.title || '未命名筆記'}」移至垃圾桶嗎？`,
      confirmLabel: '移至垃圾桶',
      tone: 'danger',
    });
    if (!confirmed) return;
    try {
      await api.trashNote(note.id);
      if (currentRef.current.id === note.id) {
        if (saveTimer.current !== null) {
          window.clearTimeout(saveTimer.current);
          saveTimer.current = null;
        }
        dirtyRef.current = false;
        pendingSaveRef.current = false;
        setSaveState('saved');
      }
      await removeNoteFromWorkspace(note.id);
      setNoteContextMenu(null);
      setNoteContextExportOpen(false);
      await refreshNotes();
      notify('筆記已移至垃圾桶');
    } catch (error) {
      notify(`移至垃圾桶失敗：${errorMessage(error)}`);
    }
  }, [confirmAction, notify, refreshNotes, removeNoteFromWorkspace]);

  const restoreNote = useCallback(async (
    note: Pick<NoteSummary, 'id'>,
  ) => {
    if (!note.id) return;
    try {
      await api.restoreNote(note.id);
      if (currentRef.current.id === note.id) {
        setCurrent((value) => ({ ...value, deletedAt: 0 }));
        cacheEditorNote({ ...currentRef.current, deletedAt: 0 });
      }
      setNoteContextMenu(null);
      setNoteContextExportOpen(false);
      await refreshNotes();
      notify('筆記已還原');
    } catch (error) {
      notify(errorMessage(error));
    }
  }, [cacheEditorNote, notify, refreshNotes]);

  const permanentlyDeleteNote = useCallback(async (
    note: Pick<NoteSummary, 'id' | 'title'>,
  ) => {
    if (!note.id) return;
    const confirmed = await confirmAction({
      title: '永久刪除',
      message: `「${note.title || '未命名筆記'}」永久刪除後無法復原，確定繼續嗎？`,
      confirmLabel: '永久刪除',
      tone: 'danger',
    });
    if (!confirmed) return;
    try {
      await api.deleteNotePermanently(note.id);
      if (currentRef.current.id === note.id) {
        if (saveTimer.current !== null) {
          window.clearTimeout(saveTimer.current);
          saveTimer.current = null;
        }
        dirtyRef.current = false;
        pendingSaveRef.current = false;
        setSaveState('saved');
      }
      await removeNoteFromWorkspace(note.id);
      setNoteContextMenu(null);
      setNoteContextExportOpen(false);
      await refreshNotes();
    } catch (error) {
      notify(errorMessage(error));
    }
  }, [confirmAction, notify, refreshNotes, removeNoteFromWorkspace]);

  const trashCurrent = useCallback(async () => {
    await trashNote(currentRef.current);
  }, [trashNote]);

  const restoreCurrent = useCallback(async () => {
    await restoreNote(currentRef.current);
  }, [restoreNote]);

  const permanentlyDeleteCurrent = useCallback(async () => {
    await permanentlyDeleteNote(currentRef.current);
  }, [permanentlyDeleteNote]);

  const importProfile = useCallback(async () => {
    try {
      setImportProgress({ progress: 0.01, message: '準備匯入 Joplin profile' });
      const report = await api.importJoplinProfile();
      setModal({ kind: 'import-report', report });
      await Promise.all([refreshTaxonomy(), refreshNotes()]);
    } catch (error) {
      notify(`匯入失敗：${errorMessage(error)}`);
    } finally {
      setImportProgress(null);
    }
  }, [notify, refreshNotes, refreshTaxonomy]);

  const importDetectedJoplinProfile = useCallback(async () => {
    if (!joplinPreview?.available) return;
    try {
      setImportProgress({ progress: 0.01, message: '準備匯入 Joplin profile' });
      const report = await api.importJoplinProfile(joplinPreview.profilePath);
      setJoplinPreview(null);
      setModal({ kind: 'import-report', report });
      await Promise.all([refreshTaxonomy(), refreshNotes()]);
    } catch (error) {
      const message = errorMessage(error);
      setJoplinPreview((preview) => preview ? { ...preview, error: message } : preview);
      notify(`匯入失敗：${message}`);
    } finally {
      setImportProgress(null);
    }
  }, [joplinPreview, notify, refreshNotes, refreshTaxonomy]);

  const chooseAndImportJoplinProfile = useCallback(async () => {
    try {
      const path = await api.selectJoplinProfile();
      if (!path) return;
      setImportProgress({ progress: 0.01, message: '準備匯入 Joplin profile' });
      const report = await api.importJoplinProfile(path);
      setJoplinPreview(null);
      setModal({ kind: 'import-report', report });
      await Promise.all([refreshTaxonomy(), refreshNotes()]);
    } catch (error) {
      const message = errorMessage(error);
      setJoplinPreview((preview) => preview ? { ...preview, error: message } : preview);
      notify(`匯入失敗：${message}`);
    } finally {
      setImportProgress(null);
    }
  }, [notify, refreshNotes, refreshTaxonomy]);

  const dismissJoplinImportPrompt = useCallback(async () => {
    try {
      await api.dismissJoplinImportPrompt();
      setJoplinPreview(null);
      await createWelcomeNote();
    } catch (error) {
      notify(`無法儲存選擇：${errorMessage(error)}`);
    }
  }, [createWelcomeNote, notify]);

  const importFile = useCallback(async () => {
    try {
      setImportProgress({ progress: 0.01, message: '準備匯入檔案' });
      const report = await api.importArchive();
      setModal({ kind: 'import-report', report });
      await Promise.all([refreshTaxonomy(), refreshNotes()]);
    } catch (error) {
      notify(`匯入失敗：${errorMessage(error)}`);
    } finally {
      setImportProgress(null);
    }
  }, [notify, refreshNotes, refreshTaxonomy]);

  const importFileIntoNotebook = useCallback(async (notebook: Notebook) => {
    setNotebookContextMenu(null);
    try {
      setImportProgress({ progress: 0.01, message: `準備匯入到「${notebook.title}」` });
      const report = await api.importArchiveToNotebook(notebook.id);
      setModal({ kind: 'import-report', report });
      setSidebarTab('notebooks');
      setView({ kind: 'notebook', id: notebook.id });
      await Promise.all([refreshTaxonomy(), refreshNotes()]);
    } catch (error) {
      notify(`匯入失敗：${errorMessage(error)}`);
    } finally {
      setImportProgress(null);
    }
  }, [notify, refreshNotes, refreshTaxonomy]);

  const exportNotebook = useCallback(async (
    format: 'jex' | 'md' | 'docx',
    notebookID = activeNotebookId,
  ) => {
    if (!notebookID) {
      notify('目前沒有可匯出的筆記本');
      return;
    }
    try {
      let path = '';
      if (format === 'docx') {
        const notebook = notebooks.find((item) => item.id === notebookID);
        notify('正在準備 DOCX…');
        const prepared = await api.prepareNotebookDocx(notebookID);
        if (!prepared.path) return;
        const dataBase64 = await convertNotebookMarkdownToDocx(
          prepared.markdown,
          notebook?.title || prepared.defaultFilename,
        );
        await api.saveDocxExport(prepared.path, dataBase64);
        path = prepared.path;
      } else {
        path = await api.exportNotebook(notebookID, format);
      }
      if (path) notify(`已匯出至 ${path}`);
    } catch (error) {
      const message = errorMessage(error);
      if (format === 'docx') {
        const stack = error instanceof Error ? error.stack || '' : '';
        void api.reportFrontendError(`DOCX export failed: ${message}`, stack, 'docx-export');
      }
      notify(`匯出失敗：${message}`);
    }
  }, [activeNotebookId, notebooks, notify]);

  const loadNoteForExport = useCallback(async (
    note: Pick<NoteSummary, 'id' | 'title'>,
  ): Promise<Note | null> => {
    if (currentRef.current.id === note.id) {
      if (dirtyRef.current) {
        const saved = await saveCurrent();
        if (!saved) {
          notify('筆記尚未儲存完成，請稍後再匯出');
          return null;
        }
      }
      return currentRef.current;
    }
    try {
      return await api.getNote(note.id);
    } catch (error) {
      notify(`無法讀取筆記：${errorMessage(error)}`);
      return null;
    }
  }, [notify, saveCurrent]);

  const renderNoteExportHTML = useCallback(async (note: Note): Promise<string> => {
    const mermaidCodes = extractMermaidBlocks(note.body).map((block) => block.code);
    if (currentRef.current.id === note.id) {
      const renderedHTML = editorRef.current?.getHTML();
      if (renderedHTML) {
        return await replaceMermaidCodeBlocksWithImages(renderedHTML, mermaidCodes);
      }
    }
    const host = document.createElement('div');
    host.className = 'note-export-render-host';
    host.setAttribute('aria-hidden', 'true');
    document.body.appendChild(host);
    try {
      await Vditor.preview(
        host,
        toEditorMarkdown(note.body, note.resources),
        {
          cdn: '/vditor',
          lang: 'zh_TW',
          icon: 'material',
          mode: theme === 'dark' ? 'dark' : 'light',
          theme: {
            current: theme === 'dark' ? 'dark' : 'light',
            path: '/vditor/dist/css/content-theme',
          },
          hljs: {
            enable: true,
            style: theme === 'dark' ? 'github-dark' : 'github',
          },
          markdown: {
            sanitize: true,
            gfmAutoLink: true,
            footnotes: true,
            toc: true,
            codeBlockPreview: true,
          },
        },
      );
      return await replaceMermaidCodeBlocksWithImages(host.innerHTML, mermaidCodes);
    } finally {
      host.remove();
    }
  }, [theme]);

  const exportNoteToFile = useCallback(async (
    note: Pick<NoteSummary, 'id' | 'title'>,
    format: NoteExportFormat,
  ) => {
    setExportMenuOpen(false);
    setNoteContextMenu(null);
    setNoteContextExportOpen(false);
    if (!note.id || exportingFormat) return;
    setExportingFormat(format);
    try {
      const loaded = await loadNoteForExport(note);
      if (!loaded) return;
      if (format === 'docx') {
        const prepared = await api.prepareNoteDocx(note.id);
        if (!prepared.path) return;
        const dataBase64 = await convertNotebookMarkdownToDocx(
          prepared.markdown,
          loaded.title || '未命名筆記',
        );
        await api.saveDocxExport(prepared.path, dataBase64);
        notify(`已匯出至 ${prepared.path}`);
        return;
      }
      let html: string | undefined;
      if (format === 'pdf' || format === 'html') {
        html = await renderNoteExportHTML(loaded);
      }
      const path = await api.exportNote({
        noteId: note.id,
        format,
        html,
      });
      if (path) notify(`已匯出至 ${path}`);
    } catch (error) {
      const message = errorMessage(error);
      if (format === 'docx') {
        const stack = error instanceof Error ? error.stack || '' : '';
        void api.reportFrontendError(
          `Note DOCX export failed: ${message}`,
          stack,
          'note-docx-export',
        );
      }
      notify(`匯出失敗：${message}`);
    } finally {
      setExportingFormat(null);
    }
  }, [
    exportingFormat,
    loadNoteForExport,
    notify,
    renderNoteExportHTML,
  ]);

  const exportMermaidForNote = useCallback(async (
    note: Pick<NoteSummary, 'id' | 'title'>,
    format: MermaidImageFormat,
  ) => {
    setExportMenuOpen(false);
    setNoteContextMenu(null);
    setNoteContextExportOpen(false);
    if (!note.id || exportingFormat) return;
    setExportingFormat(`mermaid-${format}`);
    try {
      const loaded = await loadNoteForExport(note);
      if (!loaded) return;
      const blocks = extractMermaidBlocks(loaded.body);
      if (blocks.length === 0) {
        notify('這篇筆記沒有 Mermaid 圖表');
        return;
      }
      const images: string[] = [];
      for (const block of blocks) {
        const image = await renderMermaidImage(block.code, format);
        images.push(bytesToBase64(image.data));
      }
      const directory = await api.exportMermaidImages(note.id, format, images);
      if (directory) {
        notify(`已將 ${blocks.length} 張 Mermaid ${format.toUpperCase()} 匯出至 ${directory}`);
      }
    } catch (error) {
      const message = errorMessage(error);
      const stack = error instanceof Error ? error.stack || '' : '';
      void api.reportFrontendError(
        `Mermaid ${format} export failed: ${message}`,
        stack,
        `mermaid-${format}-export`,
      );
      notify(`Mermaid 匯出失敗：${message}`);
    } finally {
      setExportingFormat(null);
    }
  }, [exportingFormat, loadNoteForExport, notify]);

  const exportCurrentNote = useCallback(async (format: NoteExportFormat) => {
    await exportNoteToFile(currentRef.current, format);
  }, [exportNoteToFile]);

  const exportCurrentMermaid = useCallback(async (format: MermaidImageFormat) => {
    await exportMermaidForNote(currentRef.current, format);
  }, [exportMermaidForNote]);

  const updateNoteTodo = useCallback(async (
    note: Pick<NoteSummary, 'id' | 'isTodo' | 'todoDue' | 'todoCompleted'>,
    changes: Partial<Pick<NoteSummary, 'isTodo' | 'todoDue' | 'todoCompleted'>>,
  ): Promise<boolean> => {
    const next = {
      isTodo: changes.isTodo ?? note.isTodo,
      todoDue: changes.todoDue ?? note.todoDue,
      todoCompleted: changes.todoCompleted ?? note.todoCompleted,
    };
    setNotes((items) => items.map((item) => item.id === note.id ? { ...item, ...next } : item));
    setCurrent((value) => value.id === note.id ? { ...value, ...next } : value);
    const cached = editorNoteCacheRef.current[note.id];
    if (cached) cacheEditorNote({ ...cached, ...next });
    try {
      await api.setNoteTodo(note.id, next.isTodo, next.todoDue, next.todoCompleted);
      await refreshNotes();
      return true;
    } catch (error) {
      const previous = {
        isTodo: note.isTodo,
        todoDue: note.todoDue,
        todoCompleted: note.todoCompleted,
      };
      setNotes((items) => items.map((item) => item.id === note.id ? { ...item, ...previous } : item));
      setCurrent((value) => value.id === note.id ? { ...value, ...previous } : value);
      const previousCached = editorNoteCacheRef.current[note.id];
      if (previousCached) cacheEditorNote({ ...previousCached, ...previous });
      notify(`更新待辦狀態失敗：${errorMessage(error)}`);
      return false;
    }
  }, [cacheEditorNote, notify, refreshNotes]);

  const toggleTodoState = () => {
    void updateNoteTodo(current, nextTodoState(current));
  };

  const openTodoDueDialog = useCallback((
    note: TodoDueNote,
  ) => {
    setNoteContextMenu(null);
    setTodoDueDialog({
      note,
      value: todoDueDateValue(note.todoDue),
    });
  }, []);

  const saveTodoDue = useCallback(async () => {
    if (!todoDueDialog) return;
    const saved = await updateNoteTodo(todoDueDialog.note, {
      todoDue: todoDueFromDateValue(todoDueDialog.value),
    });
    if (saved) setTodoDueDialog(null);
  }, [todoDueDialog, updateNoteTodo]);

  const clearTodoDue = useCallback(async () => {
    if (!todoDueDialog) return;
    const saved = await updateNoteTodo(todoDueDialog.note, { todoDue: 0 });
    if (saved) setTodoDueDialog(null);
  }, [todoDueDialog, updateNoteTodo]);

  const openAttachment = useCallback(async (resource: Resource) => {
    try {
      await api.openResource(resource.id);
    } catch (error) {
      notify(`無法開啟附件：${errorMessage(error)}`);
    }
  }, [notify]);

  const saveAttachment = useCallback(async (resource: Resource) => {
    try {
      const path = await api.saveResourceAs(resource.id);
      if (path) notify(`附件已儲存至 ${path}`);
    } catch (error) {
      notify(`另存附件失敗：${errorMessage(error)}`);
    }
  }, [notify]);

  const togglePinned = useCallback(async (note: NoteSummary) => {
    const pinned = !note.isPinned;
    setNotes((items) => items.map((item) => item.id === note.id ? { ...item, isPinned: pinned } : item));
    setCurrent((value) => value.id === note.id ? { ...value, isPinned: pinned } : value);
    try {
      await api.setNotePinned(note.id, pinned);
      await refreshNotes();
    } catch (error) {
      setNotes((items) => items.map((item) => item.id === note.id ? { ...item, isPinned: note.isPinned } : item));
      setCurrent((value) => value.id === note.id ? { ...value, isPinned: note.isPinned } : value);
      notify(`更新釘選失敗：${errorMessage(error)}`);
    }
  }, [notify, refreshNotes]);

  const updateDraft = (changes: Partial<Note>) => {
    dirtyRef.current = true;
    setCurrent((value) => ({ ...value, ...changes }));
    setSaveState('dirty');
    scheduleSave();
  };

  const updateTags = useCallback(async (nextTags: string[]) => {
    const noteID = currentRef.current.id;
    if (!noteID || tagSaving) return;
    const previousTags = currentRef.current.tags;
    cacheEditorNote({ ...currentRef.current, tags: nextTags });
    setCurrent((note) => note.id === noteID ? { ...note, tags: nextTags } : note);
    setTagSaving(true);
    try {
      await api.setNoteTags(noteID, nextTags);
      await Promise.all([refreshTaxonomy(), refreshNotes()]);
    } catch (error) {
      cacheEditorNote({ ...currentRef.current, tags: previousTags });
      setCurrent((note) => note.id === noteID ? { ...note, tags: previousTags } : note);
      notify(`更新標籤失敗：${errorMessage(error)}`);
    } finally {
      setTagSaving(false);
    }
  }, [cacheEditorNote, notify, refreshNotes, refreshTaxonomy, tagSaving]);

  const saveNoteAdditionalInfo = useCallback(async (fields: NoteInfoField[]) => {
    const noteID = currentRef.current.id;
    if (!noteID) throw new Error('目前沒有開啟的筆記');
    const saved = await api.setNoteAdditionalInfo(noteID, fields);
    const updated = { ...currentRef.current, additionalInfo: saved };
    cacheEditorNote(updated);
    setCurrent((note) => note.id === noteID ? { ...note, additionalInfo: saved } : note);
    setNoteInfoDialogOpen(false);
    notify('附加資訊已儲存');
  }, [cacheEditorNote, notify]);

  const moveNoteToNotebook = useCallback(async (note: NoteSummary, notebookID: string) => {
    if (!notebookID || notebookID === note.notebookId) {
      setMoveNoteDialog(null);
      return;
    }
    try {
      if (currentRef.current.id === note.id && dirtyRef.current) {
        const saved = await saveCurrent();
        if (!saved) {
          notify('筆記尚未儲存完成，請稍後再移動');
          return;
        }
      }
      const moved = await api.moveNote(note.id, notebookID);
      cacheEditorNote(moved);
      if (currentRef.current.id === moved.id) setCurrent(moved);
      setMoveNoteDialog(null);
      setNoteContextMenu(null);
      await refreshNotes();
      notify('筆記已移至新的筆記本');
    } catch (error) {
      notify(`移動失敗：${errorMessage(error)}`);
    }
  }, [cacheEditorNote, notify, refreshNotes, saveCurrent]);

  const canMoveNoteToNotebook = useCallback((note: NoteSummary, notebook: Notebook) => {
    if (note.storageKind === 'directory') {
      const source = notebooks.find((item) => item.id === note.notebookId);
      return notebook.storageKind === 'directory' &&
        !!source &&
        source.storageRoot.toLocaleLowerCase() === notebook.storageRoot.toLocaleLowerCase();
    }
    return notebook.storageKind !== 'directory';
  }, [notebooks]);

  const notebookRows = useMemo(
    () => buildNotebookRows(notebooks, collapsedNotebookIds),
    [collapsedNotebookIds, notebooks],
  );

  const activeNotebook = notebooks.find((notebook) => notebook.id === activeNotebookId);
  const currentNotebookPath = useMemo(
    () => notebookPath(notebooks, current.notebookId),
    [current.notebookId, notebooks],
  );
  const currentMermaidBlocks = useMemo(
    () => extractMermaidBlocks(current.body),
    [current.body],
  );
  const openEditorTabs = useMemo(
    () => editorTabs.preview ? [...editorTabs.pinned, editorTabs.preview] : editorTabs.pinned,
    [editorTabs],
  );
  const openEditorIDsKey = openEditorTabs.map((tab) => tab.id).join('|');
  useEffect(() => {
    const openIDs = new Set(openEditorIDsKey ? openEditorIDsKey.split('|') : []);
    setMountedEditorIDs((mounted) => {
      const next = new Set([...mounted].filter((id) => openIDs.has(id)));
      if (current.id && openIDs.has(current.id)) next.add(current.id);
      if (next.size === mounted.size && [...next].every((id) => mounted.has(id))) {
        return mounted;
      }
      return next;
    });
    setEditorNoteCache((cache) => {
      const next = Object.fromEntries(
        Object.entries(cache).filter(([id]) => openIDs.has(id)),
      ) as Record<string, Note>;
      editorNoteCacheRef.current = next;
      return Object.keys(next).length === Object.keys(cache).length ? cache : next;
    });
  }, [current.id, openEditorIDsKey]);
  const notebookDialogParentPath = useMemo(
    () => notebookDialog?.parentId ? notebookPath(notebooks, notebookDialog.parentId) : '',
    [notebookDialog?.parentId, notebooks],
  );
  const notebookChoices = useMemo(() => {
    const search = notebookPickerSearch.trim().toLocaleLowerCase();
    const sourceNotebook = moveNoteDialog
      ? notebooks.find((notebook) => notebook.id === moveNoteDialog.notebookId)
      : null;
    return notebooks
      .map((notebook) => ({ notebook, path: notebookPath(notebooks, notebook.id) }))
      .filter(({ path }) => !search || path.toLocaleLowerCase().includes(search))
      .filter(({ notebook }) => {
        if (!moveNoteDialog) return true;
        if (moveNoteDialog.storageKind === 'directory') {
          return notebook.storageKind === 'directory' &&
            !!sourceNotebook &&
            notebook.storageRoot.toLocaleLowerCase() === sourceNotebook.storageRoot.toLocaleLowerCase();
        }
        return notebook.storageKind !== 'directory';
      })
      .sort((left, right) => left.path.localeCompare(right.path, 'zh-TW', { sensitivity: 'base' }));
  }, [moveNoteDialog, notebookPickerSearch, notebooks]);
  const activeViewTitle = view.kind === 'dashboard'
    ? '儀錶板'
    : view.kind === 'trash'
      ? '垃圾桶'
      : view.kind === 'todo'
        ? '待辦'
        : view.kind === 'tag'
          ? `#${tags.find((tag) => tag.id === view.id)?.title || ''}`
          : view.kind === 'notebook'
            ? activeNotebook?.title || '筆記本'
            : '全部筆記';
  const noteContextMenuHeight = noteContextMenu
    ? Math.min(
      window.innerHeight - 16,
      42 +
        34 +
        (noteContextExportOpen ? 216 : 34) +
        (noteContextMenu.note.isTodo ? 112 : 42) +
        34 +
        (noteContextMenu.note.storageKind === 'directory' ? 72 : 0) +
        (noteContextMenu.note.deletedAt > 0 ? 72 : 34) +
        30,
    )
    : 0;

  const toggleNotebook = (notebookID: string) => {
    setCollapsedNotebookIds((current) => {
      const next = new Set(current);
      if (next.has(notebookID)) next.delete(notebookID);
      else next.add(notebookID);
      return next;
    });
  };

  const locateCurrentNotebook = useCallback(() => {
    const notebookID = currentRef.current.notebookId;
    if (!notebookID) {
      notify('目前沒有可定位的筆記');
      return;
    }
    setSidebarCollapsed(false);
    setSidebarTab('notebooks');
    setCollapsedNotebookIds((current) => {
      const next = new Set(current);
      for (const ancestorID of notebookAncestorIDs(notebooks, notebookID)) {
        next.delete(ancestorID);
      }
      return next;
    });
    setView({ kind: 'notebook', id: notebookID });
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        document.getElementById(`notebook-row-${notebookID}`)?.scrollIntoView({ block: 'nearest' });
      });
    });
  }, [notebooks, notify]);

  const parentNotebookIDs = useMemo(() => {
    const parentIDs = new Set<string>();
    for (const notebook of notebooks) {
      if (notebook.parentId) parentIDs.add(notebook.parentId);
    }
    return parentIDs;
  }, [notebooks]);

  const hasCollapsedNotebooks = [...parentNotebookIDs].some((id) => collapsedNotebookIds.has(id));

  const toggleAllNotebooks = () => {
    setCollapsedNotebookIds(hasCollapsedNotebooks ? new Set() : new Set(parentNotebookIDs));
  };

  const openNotebookContextMenu = (
    event: React.MouseEvent<HTMLElement>,
    notebook: Notebook,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    setNotebookContextMenu({ notebook, x: event.clientX, y: event.clientY });
  };

  const toggleMaximizeWindow = async () => {
    setIsWindowMaximized(await api.toggleMaximizeWindow());
  };

  const handleTitlebarDoubleClick = (event: React.MouseEvent<HTMLElement>) => {
    if ((event.target as HTMLElement).closest('button, input, label, select, textarea')) return;
    void toggleMaximizeWindow();
  };

  const beginResize = (kind: 'left' | 'list', event: React.PointerEvent) => {
    event.preventDefault();
    const startX = event.clientX;
    const initial = kind === 'left' ? leftWidth : listWidth;
    const move = (moveEvent: PointerEvent) => {
      const next = Math.max(200, Math.min(500, initial + moveEvent.clientX - startX));
      if (kind === 'left') setLeftWidth(next);
      else setListWidth(next);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const beginNoteTagPanelResize = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const content = noteListContentRef.current;
    if (!content) return;
    const rect = content.getBoundingClientRect();
    const updateRatio = (clientY: number) => {
      const minimumTop = Math.min(0.45, 120 / rect.height);
      const minimumBottom = Math.min(0.45, 96 / rect.height);
      const lower = Math.max(MIN_NOTE_TAG_PANEL_RATIO, minimumBottom);
      const upper = Math.max(
        lower,
        Math.min(MAX_NOTE_TAG_PANEL_RATIO, 1 - minimumTop),
      );
      const next = Math.max(lower, Math.min(upper, (rect.bottom - clientY) / rect.height));
      setNoteTagPanelRatio(next);
    };
    updateRatio(event.clientY);
    const move = (moveEvent: PointerEvent) => updateRatio(moveEvent.clientY);
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const adjustNoteTagPanelRatio = (delta: number) => {
    setNoteTagPanelRatio((value) => Math.max(
      MIN_NOTE_TAG_PANEL_RATIO,
      Math.min(MAX_NOTE_TAG_PANEL_RATIO, value + delta),
    ));
  };

  const toggleNoteTagPanel = () => {
    if (noteTagPanelOpen) setSelectedNoteTag('');
    setNoteTagPanelOpen(!noteTagPanelOpen);
  };

  const toggleNoteTag = (title: string) => {
    setSelectedNoteTag((selected) => selected === title ? '' : title);
  };

  if (fatalError) {
    return (
      <main className="fatal-screen">
        <div className="fatal-card">
          <div className="brand-mark large">P</div>
          <h1>PuffJoplin 無法啟動</h1>
          <p>{fatalError}</p>
          <button className="primary" onClick={() => api.openDataFolder()}>開啟資料資料夾</button>
          <button onClick={() => window.location.reload()}>重試</button>
        </div>
      </main>
    );
  }

  if (!bootstrap) {
    return (
      <main className="splash">
        <div className="brand-mark large">P</div>
        <div className="splash-title">PuffJoplin</div>
        <div className="loader"><span /></div>
      </main>
    );
  }

  return (
    <main
      className={`app-shell ${sidebarCollapsed ? 'sidebar-collapsed' : ''} ${noteListCollapsed ? 'note-list-collapsed' : ''} ${view.kind === 'dashboard' ? 'is-dashboard' : ''} ${isWindowMaximized ? 'is-maximized' : ''}`}
      style={{
        '--sidebar-resize-width': `${leftWidth}px`,
        '--list-resize-width': `${listWidth}px`,
      } as CSSProperties}
    >
      <header className="window-titlebar" onDoubleClick={handleTitlebarDoubleClick}>
        <div className="titlebar-context">
          <span className="titlebar-location">{activeViewTitle}</span>
          <span className="titlebar-count">
            {view.kind === 'dashboard'
              ? `${dashboardSnapshot?.counts.activeNotes ?? 0} 篇`
              : `${notes.length} 篇`}
          </span>
        </div>
        <GlobalSearch
          query={search}
          scope={effectiveSearchScope}
          field={searchField}
          caseSensitive={searchCaseSensitive}
          wholeWord={searchWholeWord}
          hasCurrentNotebook={Boolean(searchNotebookID)}
          onQueryChange={setSearch}
          onScopeChange={setSearchScope}
          onFieldChange={setSearchField}
          onCaseSensitiveChange={setSearchCaseSensitive}
          onWholeWordChange={setSearchWholeWord}
        />
        <div className="window-actions window-control">
          <button
            className="icon-button titlebar-tool"
            type="button"
            aria-label={theme === 'dark' ? '切換亮色模式' : '切換深色模式'}
            title={theme === 'dark' ? '切換亮色模式' : '切換深色模式'}
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          >
            <UiIcon name={theme === 'dark' ? 'sun' : 'moon'} />
          </button>
          <button
            className="icon-button titlebar-tool"
            type="button"
            aria-label="開啟設定"
            title="設定"
            onClick={() => {
              setSettingsMaximized(false);
              setModal({ kind: 'settings' });
              void loadManagedDirectoryExclusions();
            }}
          >
            <UiIcon name="settings" />
          </button>
          <button className="window-button" type="button" aria-label="最小化" title="最小化" onClick={() => api.minimizeWindow()}>
            <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2 6.5h8" /></svg>
          </button>
          <button
            className="window-button"
            type="button"
            aria-label={isWindowMaximized ? '還原視窗' : '最大化'}
            title={isWindowMaximized ? '還原視窗' : '最大化'}
            onClick={() => void toggleMaximizeWindow()}
          >
            {isWindowMaximized ? (
              <svg viewBox="0 0 12 12" aria-hidden="true">
                <path d="M3.5 3.5h5v5h-5zM2 2h5v1.5H3.5V7H2z" />
              </svg>
            ) : (
              <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 2.5h7v7h-7z" /></svg>
            )}
          </button>
          <button className="window-button close-button" type="button" aria-label="關閉" title="關閉" onClick={() => api.closeWindow()}>
            <svg viewBox="0 0 12 12" aria-hidden="true"><path d="m2.5 2.5 7 7m0-7-7 7" /></svg>
          </button>
        </div>
      </header>

      <aside className={`sidebar ${sidebarCollapsed ? 'is-collapsed' : ''}`}>
        <div className="sidebar-head">
          {sidebarCollapsed ? (
            <button
              className="icon-button sidebar-toggle"
              type="button"
              aria-label="展開側欄"
              title="展開側欄"
              onClick={() => setSidebarCollapsed(false)}
            >
              <UiIcon name="panel-open" />
            </button>
          ) : (
            <>
              <nav className="nav-section" aria-label="主要導覽">
                <button
                  className={`icon-button nav-item ${view.kind === 'dashboard' ? 'active' : ''}`}
                  type="button"
                  title="儀錶板"
                  aria-label="儀錶板"
                  onClick={() => setView({ kind: 'dashboard' })}
                >
                  <UiIcon name="dashboard" />
                </button>
                <button
                  className={`icon-button nav-item ${view.kind === 'all' ? 'active' : ''}`}
                  type="button"
                  title="全部筆記"
                  aria-label="全部筆記"
                  onClick={() => setView({ kind: 'all' })}
                >
                  <UiIcon name="all-notes" />
                </button>
                <button
                  className={`icon-button nav-item ${view.kind === 'todo' ? 'active' : ''}`}
                  type="button"
                  title="待辦"
                  aria-label="待辦"
                  onClick={() => setView({ kind: 'todo' })}
                >
                  <UiIcon name="todo" />
                </button>
                <span className="sidebar-nav-divider" aria-hidden="true" />
                <button
                  className={`icon-button nav-item ${view.kind === 'trash' ? 'active' : ''}`}
                  type="button"
                  title="垃圾桶"
                  aria-label="垃圾桶"
                  onClick={() => setView({ kind: 'trash' })}
                >
                  <UiIcon name="trash" />
                </button>
              </nav>
              <div className="sidebar-head-spacer" />
              <button
                className="icon-button sidebar-toggle"
                type="button"
                aria-label="收合側欄"
                title="收合側欄"
                onClick={() => setSidebarCollapsed(true)}
              >
                <UiIcon name="panel-close" />
              </button>
            </>
          )}
        </div>

        {sidebarCollapsed ? (
          <nav className="rail-nav" aria-label="精簡側邊導覽">
            <button
              className="icon-button rail-action primary-rail"
              title="新增筆記"
              aria-label="新增筆記"
              onClick={() => void createNote()}
            >
              <UiIcon name="plus" />
            </button>
            <button
              className={`icon-button rail-action ${view.kind === 'dashboard' ? 'active' : ''}`}
              title="儀錶板"
              aria-label="儀錶板"
              onClick={() => setView({ kind: 'dashboard' })}
            >
              <UiIcon name="dashboard" />
            </button>
            <button
              className={`icon-button rail-action ${view.kind === 'all' ? 'active' : ''}`}
              title="全部筆記"
              aria-label="全部筆記"
              onClick={() => setView({ kind: 'all' })}
            >
              <UiIcon name="all-notes" />
            </button>
            <button
              className={`icon-button rail-action ${view.kind === 'todo' ? 'active' : ''}`}
              title="待辦"
              aria-label="待辦"
              onClick={() => setView({ kind: 'todo' })}
            >
              <UiIcon name="todo" />
            </button>
            <button
              className={`icon-button rail-action ${view.kind === 'trash' ? 'active' : ''}`}
              title="垃圾桶"
              aria-label="垃圾桶"
              onClick={() => setView({ kind: 'trash' })}
            >
              <UiIcon name="trash" />
            </button>
            {view.kind === 'notebook' && (
              <button
                className="icon-button rail-action active"
                title={`${activeViewTitle}（展開筆記本樹）`}
                aria-label={`目前筆記本 ${activeViewTitle}，展開筆記本樹`}
                onClick={() => setSidebarCollapsed(false)}
              >
                <UiIcon name="folder" />
              </button>
            )}
            <div className="rail-spacer" />
          </nav>
        ) : (
          <>
            <div className="sidebar-tabs">
              <div className="sidebar-tablist" role="tablist" aria-label="側欄內容">
                <button
                  className={sidebarTab === 'notebooks' ? 'active' : ''}
                  type="button"
                  role="tab"
                  aria-selected={sidebarTab === 'notebooks'}
                  onClick={() => setSidebarTab('notebooks')}
                >
                  筆記本
                </button>
                <button
                  className={sidebarTab === 'tags' ? 'active' : ''}
                  type="button"
                  role="tab"
                  aria-selected={sidebarTab === 'tags'}
                  onClick={() => setSidebarTab('tags')}
                >
                  標籤
                </button>
              </div>
              <div className="sidebar-tab-actions">
                {sidebarTab === 'notebooks' && (
                  <>
                    <div ref={newNotebookMenuRef} className="new-notebook-picker">
                      <button
                        className={`icon-button sidebar-tab-action ${newNotebookMenuOpen ? 'active' : ''}`}
                        type="button"
                        title="新增或開啟筆記本"
                        aria-label="新增或開啟筆記本"
                        aria-haspopup="menu"
                        aria-expanded={newNotebookMenuOpen}
                        onClick={toggleNewNotebookMenu}
                      >
                        <UiIcon name="plus" />
                      </button>
                    </div>
                    {newNotebookMenuOpen && newNotebookMenuPosition && createPortal(
                      <div
                        ref={newNotebookMenuPopoverRef}
                        className="new-notebook-menu"
                        role="menu"
                        aria-label="新增或開啟筆記本"
                        style={{
                          left: newNotebookMenuPosition.left,
                          top: newNotebookMenuPosition.top,
                          width: newNotebookMenuPosition.width,
                        }}
                      >
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => openCreateNotebookDialog()}
                        >
                          <UiIcon name="folder" />
                          <span>新增一般筆記本</span>
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => void openManagedMarkdownNotebook()}
                        >
                          <UiIcon name="folder-managed" />
                          <span>開啟 Markdown 目錄…</span>
                        </button>
                      </div>,
                      document.body,
                    )}
                  </>
                )}
                {sidebarTab === 'notebooks' && (
                  <button
                    className="icon-button sidebar-tab-action"
                    type="button"
                    title={hasCollapsedNotebooks ? '展開全部筆記本' : '收合全部筆記本'}
                    aria-label={hasCollapsedNotebooks ? '展開全部筆記本' : '收合全部筆記本'}
                    onClick={toggleAllNotebooks}
                  >
                    <UiIcon name={hasCollapsedNotebooks ? 'expand-all' : 'collapse-all'} />
                  </button>
                )}
              </div>
            </div>
            <div className="nav-scroll sidebar-tab-content">
              {sidebarTab === 'notebooks' ? (
                <div className="notebook-tab-content" role="tabpanel" aria-label="筆記本">
                  {notebookRows.map(({ notebook, depth, hasChildren }) => {
                    const collapsed = collapsedNotebookIds.has(notebook.id);
                    return (
                      <div
                        key={notebook.id}
                        id={`notebook-row-${notebook.id}`}
                        className={`notebook-row ${notebook.storageKind === 'directory' ? 'is-managed' : ''} ${view.kind === 'notebook' && view.id === notebook.id ? 'active' : ''} ${dropNotebookID === notebook.id ? 'drop-target' : ''}`}
                        style={{ paddingLeft: 6 + depth * 11 }}
                        title={notebook.storageKind === 'directory' ? notebook.storageRoot : undefined}
                        onContextMenu={(event) => openNotebookContextMenu(event, notebook)}
                        onDragOver={(event) => {
                          if (!draggingNoteID) return;
                          const draggedNote = notes.find((item) => item.id === draggingNoteID);
                          if (!draggedNote || !canMoveNoteToNotebook(draggedNote, notebook)) return;
                          event.preventDefault();
                          event.dataTransfer.dropEffect = 'move';
                          setDropNotebookID(notebook.id);
                        }}
                        onDragLeave={(event) => {
                          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                            setDropNotebookID((current) => current === notebook.id ? '' : current);
                          }
                        }}
                        onDrop={(event) => {
                          event.preventDefault();
                          const noteID = event.dataTransfer.getData(noteDragMime) ||
                            event.dataTransfer.getData('text/plain') ||
                            draggingNoteID;
                          const note = notes.find((item) => item.id === noteID);
                          setDraggingNoteID('');
                          setDropNotebookID('');
                          if (note && canMoveNoteToNotebook(note, notebook)) {
                            void moveNoteToNotebook(note, notebook.id);
                          }
                        }}
                      >
                        <button
                          className={`icon-button notebook-chevron ${hasChildren ? '' : 'empty'}`}
                          type="button"
                          aria-label={collapsed ? `展開 ${notebook.title}` : `收合 ${notebook.title}`}
                          aria-expanded={hasChildren ? !collapsed : undefined}
                          disabled={!hasChildren}
                          onClick={() => toggleNotebook(notebook.id)}
                        >
                          <UiIcon name={collapsed ? 'chevron-right' : 'chevron-down'} />
                        </button>
                        <button className="notebook-name" onClick={() => setView({ kind: 'notebook', id: notebook.id })}>
                          <UiIcon
                            name={notebook.storageKind === 'directory' ? 'folder-managed' : 'folder'}
                            className="notebook-icon"
                          />
                          <span>{notebook.title}</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="tag-cloud" role="group" aria-label="標籤">
                  {tags.map((tag) => (
                    <button
                      key={tag.id}
                      className={`tag-chip ${view.kind === 'tag' && view.id === tag.id ? 'active' : ''}`}
                      title={`${tag.title}，${tag.count} 篇筆記`}
                      aria-label={`標籤 ${tag.title}，${tag.count} 篇筆記`}
                      onClick={() => setView({ kind: 'tag', id: tag.id })}
                    >
                      {formatTagLabel(tag)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </aside>

      {view.kind === 'dashboard' ? (
        <Dashboard
          snapshot={dashboardSnapshot}
          loading={dashboardLoading}
          error={dashboardError}
          cleaningResources={resourceCleanupRunning}
          onRefresh={() => void refreshDashboard()}
          onOpenNote={(noteID) => void openDashboardNote(noteID)}
          onOpenView={setView}
          onCompleteTodo={(noteID, todoDue) => void completeDashboardTodo(noteID, todoDue)}
          onCleanupResources={() => void cleanupUnusedResources()}
          onOpenDataFolder={() => void api.openDataFolder()}
        />
      ) : (
        <>
      {!sidebarCollapsed && (
        <div className="resizer resizer-left" onPointerDown={(event) => beginResize('left', event)} />
      )}

      {!noteListCollapsed && (
        <section className="note-list-panel">
            <header className="note-list-header">
              <div className="note-list-sort">
                <FluentSelect<NoteSortBy>
                  className="note-sort-select"
                  value={activeSortBy}
                  ariaLabel={view.kind === 'todo' ? '待辦排序方式' : '筆記排序方式'}
                  options={[
                    { value: 'title', label: '字母' },
                    { value: 'created', label: '新增日期' },
                    { value: 'updated', label: '修改日期' },
                    ...(view.kind === 'todo'
                      ? [{ value: 'due' as const, label: '到期日' }]
                      : []),
                  ]}
                  onChange={updateActiveSortBy}
                />
                <button
                  className="note-sort-direction"
                  type="button"
                  aria-label={activeSortDirection === 'asc' ? '目前正序，切換為倒序' : '目前倒序，切換為正序'}
                  onClick={toggleActiveSortDirection}
                >
                  {activeSortDirection === 'asc' ? '正序 ↑' : '倒序 ↓'}
                </button>
              </div>
              <div className="note-list-actions">
                <button
                  className={`icon-button note-tag-panel-toggle ${noteTagPanelOpen ? 'active' : ''}`}
                  type="button"
                  aria-label={noteTagPanelOpen ? '收合標籤面板' : '展開標籤面板'}
                  aria-pressed={noteTagPanelOpen}
                  title={noteTagPanelOpen ? '收合標籤面板' : '展開標籤面板'}
                  onClick={toggleNoteTagPanel}
                >
                  <UiIcon name="tag" />
                </button>
                <button
                  className={`icon-button toggle-note-summary-button ${showNoteSummary ? 'active' : ''}`}
                  type="button"
                  aria-label={showNoteSummary ? '隱藏筆記摘要' : '顯示筆記摘要'}
                  aria-pressed={showNoteSummary}
                  title={showNoteSummary ? '隱藏筆記摘要' : '顯示筆記摘要'}
                  onClick={() => {
                    const now = performance.now();
                    if (now - lastSummaryToggleAtRef.current < 250) return;
                    lastSummaryToggleAtRef.current = now;
                    setShowNoteSummary((value) => !value);
                  }}
                >
                  <UiIcon name="summary" />
                </button>
                <button
                  className="icon-button locate-notebook-button"
                  type="button"
                  aria-label="定位目前筆記的筆記本"
                  title="定位目前筆記的筆記本"
                  disabled={!current.id}
                  onClick={locateCurrentNotebook}
                >
                  <UiIcon name="locate" />
                </button>
                <button
                  className="icon-button new-note-button"
                  type="button"
                  aria-label="新增筆記"
                  title="新增筆記"
                  onClick={() => void createNote()}
                >
                  <UiIcon name="plus" />
                </button>
              </div>
            </header>
            {view.kind === 'todo' && (
              <div className="todo-status-filter" role="group" aria-label="待辦狀態">
                {([
                  { value: 'open', label: '未完成' },
                  { value: 'completed', label: '已完成' },
                  { value: 'all', label: '全部' },
                ] as const).map((filter) => (
                  <button
                    key={filter.value}
                    className={todoStatus === filter.value ? 'active' : ''}
                    type="button"
                    aria-pressed={todoStatus === filter.value}
                    onClick={() => setTodoStatus(filter.value)}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            )}
            <div
              ref={noteListContentRef}
              className={`note-list-content ${noteTagPanelOpen ? 'has-tag-panel' : ''}`}
            >
            <div
              className={`note-list ${showNoteSummary ? '' : 'is-compact'}`}
              aria-label="筆記清單"
              style={noteTagPanelOpen
                ? { flexBasis: `${(1 - noteTagPanelRatio) * 100}%` }
                : undefined}
            >
              {visibleNotes.length === 0 && (
                <div className="empty-list">
                  <div>§</div>
                  <p>
                    {selectedNoteTag
                      ? '沒有符合所選標籤的筆記'
                      : search
                        ? '找不到符合的筆記'
                        : '這裡還沒有筆記'}
                  </p>
                  {selectedNoteTag ? (
                    <button onClick={() => setSelectedNoteTag('')}>清除標籤篩選</button>
                  ) : !search && (
                    <button onClick={() => void createNote()}>建立第一篇筆記</button>
                  )}
                </div>
              )}
              {visibleNotes.map((note) => (
                <div
                  key={note.id}
                  className={`note-card ${current.id === note.id ? 'active' : ''} ${draggingNoteID === note.id ? 'is-dragging' : ''} ${note.isTodo ? 'is-todo' : ''} ${note.todoCompleted ? 'is-completed' : ''}`}
                  draggable
                  onDragStart={(event) => {
                    event.dataTransfer.effectAllowed = 'move';
                    event.dataTransfer.setData(noteDragMime, note.id);
                    event.dataTransfer.setData('text/plain', note.id);
                    setDraggingNoteID(note.id);
                  }}
                  onDragEnd={() => {
                    setDraggingNoteID('');
                    setDropNotebookID('');
                  }}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    setNoteContextExportOpen(false);
                    setNoteContextMenu({ note, x: event.clientX, y: event.clientY });
                  }}
                >
                  {note.isTodo && (
                    <button
                      className={`icon-button todo-checkbox ${note.todoCompleted ? 'is-completed' : ''}`}
                      type="button"
                      aria-label={note.todoCompleted
                        ? `將 ${note.title || '未命名筆記'} 標記為未完成`
                        : `將 ${note.title || '未命名筆記'} 標記為完成`}
                      aria-pressed={note.todoCompleted > 0}
                      title={note.todoCompleted ? '標記未完成' : '標記完成'}
                      onClick={() => void updateNoteTodo(note, nextTodoState(note))}
                    >
                      <UiIcon
                        name={note.todoCompleted ? 'todo-checkbox-checked' : 'todo-checkbox'}
                      />
                    </button>
                  )}
                  <button
                    className={`note-card-main ${note.isTodo ? 'has-todo-checkbox' : ''}`}
                    type="button"
                    onClick={() => void selectNote(note.id)}
                  >
                    <div className="note-card-top">
                      <span className="note-card-title">{note.title || '未命名筆記'}</span>
                      <time>{formatDate(note.updatedAt)}</time>
                    </div>
                    <p>{note.snippet || '空白筆記'}</p>
                    <div className="note-card-meta">
                      <span>{note.notebookTitle}</span>
                      {note.isTodo && note.todoDue > 0 && (
                        <span className={`todo-due-badge ${todoDueClassName(note.todoDue)}`}>
                          {todoDueLabel(note.todoDue)}
                        </span>
                      )}
                      {note.attachmentCount > 0 && <span>⌘ {note.attachmentCount}</span>}
                      {note.tags.slice(0, 2).map((tag) => <span className="mini-tag" key={tag}>#{tag}</span>)}
                    </div>
                  </button>
                  <button
                    className={`icon-button pin-note-button ${note.isPinned ? 'active' : ''}`}
                    type="button"
                    aria-label={note.isPinned ? `取消釘選 ${note.title}` : `釘選 ${note.title}`}
                    aria-pressed={note.isPinned}
                    title={note.isPinned ? '取消釘選' : '釘選至最上方'}
                    onClick={() => void togglePinned(note)}
                  >
                    <UiIcon name="pin" filled={note.isPinned} />
                  </button>
                </div>
              ))}
            </div>
            {noteTagPanelOpen && (
              <>
                <div
                  className="note-tag-panel-splitter"
                  role="separator"
                  aria-label="調整標籤面板高度"
                  aria-orientation="horizontal"
                  aria-valuemin={Math.round(MIN_NOTE_TAG_PANEL_RATIO * 100)}
                  aria-valuemax={Math.round(MAX_NOTE_TAG_PANEL_RATIO * 100)}
                  aria-valuenow={Math.round(noteTagPanelRatio * 100)}
                  style={{ top: `${(1 - noteTagPanelRatio) * 100}%` }}
                  tabIndex={0}
                  onPointerDown={beginNoteTagPanelResize}
                  onKeyDown={(event) => {
                    if (event.key === 'ArrowUp') {
                      event.preventDefault();
                      adjustNoteTagPanelRatio(0.05);
                    } else if (event.key === 'ArrowDown') {
                      event.preventDefault();
                      adjustNoteTagPanelRatio(-0.05);
                    } else if (event.key === 'Home') {
                      event.preventDefault();
                      setNoteTagPanelRatio(MIN_NOTE_TAG_PANEL_RATIO);
                    } else if (event.key === 'End') {
                      event.preventDefault();
                      setNoteTagPanelRatio(MAX_NOTE_TAG_PANEL_RATIO);
                    }
                  }}
                />
                <section
                  className="note-tag-panel"
                  aria-label="標籤面板"
                  style={{ flexBasis: `${noteTagPanelRatio * 100}%` }}
                >
                  <header className="note-tag-panel-header">
                    <div>
                      <strong>標籤</strong>
                      <span>
                        {selectedNoteTag
                          ? `${visibleNotes.length} / ${notes.length} 篇`
                          : `${notes.length} 篇筆記`}
                      </span>
                    </div>
                    {selectedNoteTag && (
                      <button
                        className="note-tag-panel-clear"
                        type="button"
                        onClick={() => setSelectedNoteTag('')}
                      >
                        清除
                      </button>
                    )}
                  </header>
                  <div className="note-tag-cloud" role="group" aria-label="目前筆記清單的標籤">
                    {noteTags.length === 0 ? (
                      <p className="note-tag-panel-empty">目前筆記清單沒有標籤</p>
                    ) : noteTags.map((tag) => (
                      <button
                        className={`note-tag-chip ${selectedNoteTag === tag.title ? 'active' : ''}`}
                        type="button"
                        key={tag.title}
                        aria-pressed={selectedNoteTag === tag.title}
                        title={`${tag.title}，${tag.count} 篇筆記`}
                        onClick={() => toggleNoteTag(tag.title)}
                      >
                        <span>#{tag.title}</span>
                        <small>{tag.count}</small>
                      </button>
                    ))}
                  </div>
                </section>
              </>
            )}
            </div>
        </section>
      )}

      {!noteListCollapsed && (
        <div className="resizer resizer-right" onPointerDown={(event) => beginResize('list', event)} />
      )}

      <section className="editor-panel">
        {current.id && (
          <EditorTabBar
            tabs={editorTabs}
            onActivate={(id) => void activateEditorTab(id)}
            onTogglePin={toggleOpenTabPin}
            onClose={(id) => void closeOpenTab(id)}
          />
        )}
        {current.id ? (
          <>
            {current.deletedAt > 0 && (
              <div className="trash-banner">
                <span>這篇筆記位於垃圾桶</span>
                <button onClick={() => void restoreCurrent()}>還原</button>
                <button className="danger-text" onClick={() => void permanentlyDeleteCurrent()}>永久刪除</button>
              </div>
            )}

            <div className="editor-heading">
              <div className="editor-heading-main">
                <button
                  className="icon-button collapse-note-list-button"
                  type="button"
                  aria-label={noteListCollapsed ? '展開筆記清單' : '收合筆記清單'}
                  title={noteListCollapsed ? '展開筆記清單' : '收合筆記清單'}
                  onClick={() => setNoteListCollapsed((value) => !value)}
                >
                  <UiIcon name={noteListCollapsed ? 'panel-open' : 'panel-close'} />
                </button>
                <div className="editor-breadcrumbs">
                  <span
                    className="note-path-label"
                    title={currentNotebookPath || '未分類'}
                  >
                    {currentNotebookPath || '未分類'}
                  </span>
                  <span className="breadcrumb-separator" aria-hidden="true">/</span>
                  <input
                    className="title-input"
                    value={current.title}
                    placeholder="未命名筆記"
                    aria-label="筆記名稱"
                    onChange={(event) => updateDraft({ title: event.target.value })}
                    onBlur={() => void saveCurrent()}
                  />
                </div>
                <div className="editor-heading-actions">
                  <div
                    className="editor-export"
                    onPointerDown={(event) => event.stopPropagation()}
                  >
                    <button
                      className="editor-action-button export-action-button"
                      type="button"
                      aria-haspopup="menu"
                      aria-expanded={exportMenuOpen}
                      disabled={exportingFormat !== null}
                      onClick={() => setExportMenuOpen((value) => !value)}
                    >
                      {exportingFormat ? '匯出中…' : '匯出'} <span aria-hidden="true">▾</span>
                    </button>
                    {exportMenuOpen && (
                      <div className="editor-export-menu" role="menu" aria-label="匯出格式">
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => void exportCurrentNote('pdf')}
                        >
                          <span>PDF</span>
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => void exportCurrentNote('html')}
                        >
                          <span>HTML</span>
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => void exportCurrentNote('markdown')}
                        >
                          <span>Markdown</span>
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => void exportCurrentNote('docx')}
                        >
                          <span>DOCX</span>
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          disabled={currentMermaidBlocks.length === 0}
                          title={currentMermaidBlocks.length === 0 ? '目前筆記沒有 Mermaid 圖表' : undefined}
                          onClick={() => void exportCurrentMermaid('svg')}
                        >
                          <span>Mermaid SVG</span>
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          disabled={currentMermaidBlocks.length === 0}
                          title={currentMermaidBlocks.length === 0 ? '目前筆記沒有 Mermaid 圖表' : undefined}
                          onClick={() => void exportCurrentMermaid('png')}
                        >
                          <span>Mermaid PNG</span>
                        </button>
                      </div>
                    )}
                  </div>
                  <button
                    className={`editor-action-button todo-action-button ${current.isTodo ? 'active' : ''}`}
                    type="button"
                    onClick={toggleTodoState}
                  >
                    {todoActionLabel(current)}
                  </button>
                </div>
              </div>
            </div>

            <div className="editor-main">
              {openEditorTabs
                .filter((tab) => mountedEditorIDs.has(tab.id))
                .map((tab) => {
                  const isActive = tab.id === current.id;
                  const note = isActive ? current : editorNoteCache[tab.id];
                  if (!note?.id) {
                    return (
                      <div
                        className={`editor-pane ${isActive ? 'active' : ''}`}
                        key={tab.id}
                        aria-hidden={!isActive}
                      >
                        <div className="editor-pane-loading">正在載入筆記…</div>
                      </div>
                    );
                  }
                  return (
                    <div
                      className={`editor-pane ${isActive ? 'active' : ''}`}
                      key={tab.id}
                      aria-hidden={!isActive}
                      inert={!isActive}
                    >
                      <VditorEditor
                        ref={isActive ? editorRef : undefined}
                        key={tab.id}
                        noteID={note.id}
                        noteTitle={note.title}
                        initialMode={editorModeForTab(tab, editorPreferences.defaultMode)}
                        initialPreviewMode={tab.previewMode || 'editor'}
                        active={isActive}
                        value={note.body}
                        uploadToken={bootstrap.uploadToken}
                        storageKind={note.storageKind}
                        resources={note.resources}
                        theme={theme}
                        showSourceLineNumbers={editorPreferences.showSourceLineNumbers}
                        onChange={(body) => {
                          if (currentRef.current.id === tab.id) updateDraft({ body });
                        }}
                        onBlur={() => {
                          if (currentRef.current.id === tab.id) void saveCurrent();
                        }}
                        onModeChange={(mode) =>
                          setEditorTabs((tabs) => updateEditorTabMode(tabs, tab.id, mode))}
                        onPreviewModeChange={(previewMode) =>
                          setEditorTabs((tabs) =>
                            updateEditorTabPreviewMode(tabs, tab.id, previewMode))}
                      />
                    </div>
                  );
                })}
            </div>

            <footer className="editor-footer">
              <NoteTags
                key={current.id}
                tags={current.tags}
                disabled={tagSaving}
                onChange={(nextTags) => void updateTags(nextTags)}
              />
              <div className="editor-footer-actions">
                <button
                  className="note-info-trigger"
                  type="button"
                  title="編輯 PDF 封面附加資訊"
                  onClick={() => setNoteInfoDialogOpen(true)}
                  disabled={current.deletedAt > 0}
                >
                  附加資訊
                  {noteInfoFilledCount(current.additionalInfo) > 0 && (
                    <span className="note-info-trigger-count">
                      {noteInfoFilledCount(current.additionalInfo)}
                    </span>
                  )}
                </button>
                {current.resources.length > 0 && (
                  <div
                    className="attachment-picker"
                    onPointerDown={(event) => event.stopPropagation()}
                  >
                    <button
                      className="attachment-trigger"
                      type="button"
                      aria-haspopup="menu"
                      aria-expanded={attachmentMenuOpen}
                      onClick={() => setAttachmentMenuOpen((value) => !value)}
                    >
                      附件 {current.resources.length}
                    </button>
                    {attachmentMenuOpen && (
                      <div className="attachment-popover" role="menu" aria-label="筆記附件">
                        <div className="attachment-popover-title">筆記附件</div>
                        {current.resources.map((resource, index) => {
                          const filename = resource.filename || resource.title || `附件 ${index + 1}`;
                          return (
                            <div className="attachment-item" key={resource.id}>
                              <button
                                className="attachment-open"
                                type="button"
                                title={`開啟 ${filename}`}
                                onClick={() => void openAttachment(resource)}
                              >
                                <span aria-hidden="true">⌘</span>
                                <span>{filename}</span>
                              </button>
                              <button
                                className="attachment-save"
                                type="button"
                                title={`另存 ${filename}`}
                                onClick={() => void saveAttachment(resource)}
                              >
                                另存
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
                {current.isTodo && (
                  <button
                    className={`editor-footer-due ${todoDueClassName(current.todoDue)}`}
                    type="button"
                    title={current.todoDue ? '變更待辦到期日' : '設定待辦到期日'}
                    onClick={() => openTodoDueDialog(current)}
                  >
                    <UiIcon name="calendar" />
                    <span>{current.todoDue ? todoDueLabel(current.todoDue) : '設定到期日'}</span>
                  </button>
                )}
                <span className="word-count">
                  {current.body.length.toLocaleString('zh-TW')} 字元
                </span>
                <span className="editor-footer-date">{formatDate(current.updatedAt)}</span>
                <span
                  className={`save-state ${saveState}`}
                  aria-live="polite"
                >
                  {saveStateLabel[saveState]}
                </span>
                <button
                  className="editor-footer-trash"
                  type="button"
                  title="移至垃圾桶"
                  aria-label="移至垃圾桶"
                  onClick={() => void trashCurrent()}
                  disabled={current.deletedAt > 0}
                >
                  刪除
                </button>
              </div>
            </footer>
          </>
        ) : (
          <div className="empty-editor">
            <div className="empty-illustration">P</div>
            <h2>選擇或建立一篇筆記</h2>
            <p>你的筆記只會留在這台電腦。</p>
            <button className="primary" onClick={() => void createNote()}>新增筆記</button>
          </div>
        )}
      </section>
        </>
      )}

      {notebookContextMenu && (
        <div
          className="notebook-context-menu"
          role="menu"
          aria-label={`${notebookContextMenu.notebook.title} 操作`}
          style={{
            left: Math.max(8, Math.min(notebookContextMenu.x, window.innerWidth - 224)),
            top: Math.max(8, Math.min(notebookContextMenu.y, window.innerHeight - 360)),
          }}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <div className="context-menu-title">{notebookContextMenu.notebook.title}</div>
          {notebookContextMenu.notebook.storageKind === 'directory' ? (
            <>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  const notebook = notebookContextMenu.notebook;
                  setNotebookContextMenu(null);
                  openChildNotebookDialog(notebook);
                }}
              >
                <UiIcon name="plus" /> 新增子資料夾
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  const notebook = notebookContextMenu.notebook;
                  setNotebookContextMenu(null);
                  void refreshManagedNotebook(notebook);
                }}
              >
                <UiIcon name="summary" /> 重新整理
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  const notebook = notebookContextMenu.notebook;
                  setNotebookContextMenu(null);
                  void revealNotebook(notebook);
                }}
              >
                <UiIcon name="folder-managed" /> 在檔案總管中顯示
              </button>
              <div className="context-menu-separator" />
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  const notebook = notebookContextMenu.notebook;
                  setNotebookContextMenu(null);
                  void exportNotebook('md', notebook.id);
                }}
              >
                <UiIcon name="folder" /> 匯出 Markdown 目錄…
              </button>
              {!notebookContextMenu.notebook.storagePath && (
                <>
                  <div className="context-menu-separator" />
                  <button
                    type="button"
                    role="menuitem"
                    className="danger"
                    onClick={() => {
                      const notebook = notebookContextMenu.notebook;
                      setNotebookContextMenu(null);
                      void deleteNotebook(notebook);
                    }}
                  >
                    <UiIcon name="close" /> 停止管理此目錄
                  </button>
                </>
              )}
            </>
          ) : (
            <>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  const notebook = notebookContextMenu.notebook;
                  setNotebookContextMenu(null);
                  openChildNotebookDialog(notebook);
                }}
              >
                <UiIcon name="plus" /> 新增子筆記本
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  const notebook = notebookContextMenu.notebook;
                  setNotebookContextMenu(null);
                  openRenameNotebookDialog(notebook);
                }}
              >
                <UiIcon name="settings" /> 重新命名
              </button>
              <div className="context-menu-separator" />
              <button
                type="button"
                role="menuitem"
                onClick={() => void importFileIntoNotebook(notebookContextMenu.notebook)}
              >
                <UiIcon name="all-notes" /> 匯入到此筆記本…
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  const notebook = notebookContextMenu.notebook;
                  setNotebookContextMenu(null);
                  void exportNotebook('md', notebook.id);
                }}
              >
                <UiIcon name="folder" /> 匯出 Markdown 目錄…
              </button>
              <div className="context-menu-separator" />
              <button
                type="button"
                role="menuitem"
                className="danger"
                onClick={() => {
                  const notebook = notebookContextMenu.notebook;
                  setNotebookContextMenu(null);
                  void deleteNotebook(notebook);
                }}
              >
                <UiIcon name="trash" /> 刪除筆記本
              </button>
            </>
          )}
        </div>
      )}

      {noteContextMenu && (
        <div
          className="notebook-context-menu note-context-menu"
          role="menu"
          aria-label={`${noteContextMenu.note.title || '未命名筆記'} 操作`}
          style={{
            left: Math.max(8, Math.min(noteContextMenu.x, window.innerWidth - 256)),
            top: Math.max(
              8,
              Math.min(
                noteContextMenu.y,
                window.innerHeight - noteContextMenuHeight,
              ),
            ),
          }}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <div className="context-menu-title">{noteContextMenu.note.title || '未命名筆記'}</div>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              const note = noteContextMenu.note;
              setNoteContextMenu(null);
              setNoteContextExportOpen(false);
              void togglePinned(note);
            }}
          >
            <UiIcon name="pin" filled={noteContextMenu.note.isPinned} />
            {noteContextMenu.note.isPinned ? '取消釘選' : '釘選至最上方'}
          </button>
          <button
            className={`note-context-submenu-trigger ${noteContextExportOpen ? 'active' : ''}`}
            type="button"
            role="menuitem"
            aria-haspopup="menu"
            aria-expanded={noteContextExportOpen}
            disabled={exportingFormat !== null}
            onClick={() => setNoteContextExportOpen((value) => !value)}
          >
            <UiIcon name="download" />
            匯出
            <UiIcon name="chevron-down" className="context-menu-chevron" />
          </button>
          {noteContextExportOpen && (
            <div className="note-context-export-menu" role="group" aria-label="筆記匯出格式">
              {([
                ['pdf', 'PDF'],
                ['html', 'HTML'],
                ['markdown', 'Markdown'],
                ['docx', 'DOCX'],
              ] as const).map(([format, label]) => (
                <button
                  type="button"
                  role="menuitem"
                  disabled={exportingFormat !== null}
                  key={format}
                  onClick={() => void exportNoteToFile(noteContextMenu.note, format)}
                >
                  <span>{label}</span>
                  {exportingFormat === format && <span className="context-menu-busy">…</span>}
                </button>
              ))}
              <div className="context-menu-separator" />
              {([
                ['svg', 'Mermaid SVG'],
                ['png', 'Mermaid PNG'],
              ] as const).map(([format, label]) => (
                <button
                  type="button"
                  role="menuitem"
                  disabled={exportingFormat !== null}
                  key={format}
                  onClick={() => void exportMermaidForNote(noteContextMenu.note, format)}
                >
                  <span>{label}</span>
                  {exportingFormat === `mermaid-${format}` && (
                    <span className="context-menu-busy">…</span>
                  )}
                </button>
              ))}
            </div>
          )}
          <div className="context-menu-separator" />
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setMoveNoteDialog(noteContextMenu.note);
              setNotebookPickerSearch('');
              setNoteContextMenu(null);
              setNoteContextExportOpen(false);
            }}
          >
            <span>↪</span> 移至筆記本…
          </button>
          <div className="context-menu-separator" />
          {noteContextMenu.note.isTodo ? (
            <>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  const note = noteContextMenu.note;
                  setNoteContextMenu(null);
                  setNoteContextExportOpen(false);
                  void updateNoteTodo(note, nextTodoState(note));
                }}
              >
                <UiIcon name="todo-checkbox-checked" />
                {noteContextMenu.note.todoCompleted ? '標記未完成' : '標記完成'}
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => openTodoDueDialog(noteContextMenu.note)}
              >
                <UiIcon name="calendar" />
                {noteContextMenu.note.todoDue ? '變更到期日…' : '設定到期日…'}
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  const note = noteContextMenu.note;
                  setNoteContextMenu(null);
                  setNoteContextExportOpen(false);
                  void updateNoteTodo(note, cancelTodo());
                }}
              >
                <UiIcon name="close" />
                取消待辦
              </button>
            </>
          ) : (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                const note = noteContextMenu.note;
                setNoteContextMenu(null);
                setNoteContextExportOpen(false);
                void updateNoteTodo(note, convertToTodo());
              }}
            >
              <UiIcon name="todo" />
              轉為待辦
            </button>
          )}
          {noteContextMenu.note.storageKind === 'directory' && (
            <>
              <div className="context-menu-separator" />
              <button
                type="button"
                role="menuitem"
                onClick={() => void copyNoteFilePath(noteContextMenu.note)}
              >
                <UiIcon name="copy" />
                複製檔案路徑
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => void revealNoteFile(noteContextMenu.note)}
              >
                <UiIcon name="folder-managed" />
                開啟至檔案總管
              </button>
            </>
          )}
          <div className="context-menu-separator" />
          {noteContextMenu.note.deletedAt > 0 ? (
            <>
              <button
                type="button"
                role="menuitem"
                onClick={() => void restoreNote(noteContextMenu.note)}
              >
                <UiIcon name="todo-checkbox" />
                還原筆記
              </button>
              <button
                type="button"
                role="menuitem"
                className="danger"
                onClick={() => void permanentlyDeleteNote(noteContextMenu.note)}
              >
                <UiIcon name="trash" />
                永久刪除
              </button>
            </>
          ) : (
            <button
              type="button"
              role="menuitem"
              className="danger"
              onClick={() => void trashNote(noteContextMenu.note)}
            >
              <UiIcon name="trash" />
              移至垃圾桶
            </button>
          )}
        </div>
      )}

      {noteInfoDialogOpen && current.id && (
        <NoteAdditionalInfoDialog
          key={current.id}
          noteTitle={current.title}
          fields={current.additionalInfo}
          onCancel={() => setNoteInfoDialogOpen(false)}
          onSave={saveNoteAdditionalInfo}
        />
      )}

      {todoDueDialog && (
        <div
          className="modal-backdrop"
          onMouseDown={() => setTodoDueDialog(null)}
        >
          <form
            className="modal-card todo-due-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="todo-due-dialog-title"
            onMouseDown={(event) => event.stopPropagation()}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault();
                setTodoDueDialog(null);
              }
            }}
            onSubmit={(event) => {
              event.preventDefault();
              void saveTodoDue();
            }}
          >
            <header>
              <div>
                <span className="eyebrow">待辦到期日</span>
                <h2 id="todo-due-dialog-title">
                  {todoDueDialog.note.title || '未命名筆記'}
                </h2>
              </div>
              <button
                className="icon-button"
                type="button"
                aria-label="關閉"
                title="關閉"
                onClick={() => setTodoDueDialog(null)}
              >
                <UiIcon name="close" />
              </button>
            </header>
            <div className="todo-due-content">
              <label htmlFor="todo-due-date">到期日</label>
              <div className="todo-due-field">
                <UiIcon name="calendar" />
                <input
                  id="todo-due-date"
                  type="date"
                  value={todoDueDialog.value}
                  autoFocus
                  onChange={(event) => setTodoDueDialog((dialog) => dialog
                    ? { ...dialog, value: event.target.value }
                    : dialog)}
                />
              </div>
              <p>到期日會保留到當天結束；未設定日期時，待辦仍會顯示在清單中。</p>
            </div>
            <footer>
              <button
                type="button"
                className="todo-due-clear"
                disabled={!todoDueDialog.note.todoDue}
                onClick={() => void clearTodoDue()}
              >
                清除到期日
              </button>
              <div>
                <button type="button" onClick={() => setTodoDueDialog(null)}>
                  取消
                </button>
                <button className="primary" type="submit">
                  儲存
                </button>
              </div>
            </footer>
          </form>
        </div>
      )}

      {moveNoteDialog && (
        <div
          className="modal-backdrop"
          onMouseDown={() => {
            setMoveNoteDialog(null);
            setNotebookPickerSearch('');
          }}
        >
          <div className="modal-card note-move-dialog" onMouseDown={(event) => event.stopPropagation()}>
            <header>
              <div>
                <span className="eyebrow">移動筆記</span>
                <h2>{moveNoteDialog.title || '未命名筆記'}</h2>
              </div>
              <button
                className="icon-button"
                type="button"
                aria-label="關閉"
                onClick={() => {
                  setMoveNoteDialog(null);
                  setNotebookPickerSearch('');
                }}
              >
                <UiIcon name="close" />
              </button>
            </header>
            <div className="note-move-content">
              <input
                className="note-move-search"
                value={notebookPickerSearch}
                placeholder="搜尋筆記本路徑…"
                autoFocus
                onChange={(event) => setNotebookPickerSearch(event.target.value)}
              />
              <div className="notebook-picker-list" role="listbox" aria-label="選擇目的筆記本">
                {notebookChoices.map(({ notebook, path }) => (
                  <button
                    key={notebook.id}
                    type="button"
                    role="option"
                    aria-selected={notebook.id === moveNoteDialog.notebookId}
                    className={notebook.id === moveNoteDialog.notebookId ? 'active' : ''}
                    onClick={() => void moveNoteToNotebook(moveNoteDialog, notebook.id)}
                  >
                    <UiIcon name="folder" />
                    <span>{path || notebook.title}</span>
                  </button>
                ))}
                {notebookChoices.length === 0 && <p className="muted">找不到符合的筆記本</p>}
              </div>
            </div>
            <footer>
              <span>也可以直接把筆記拖曳到筆記本樹。</span>
              <button
                type="button"
                onClick={() => {
                  setMoveNoteDialog(null);
                  setNotebookPickerSearch('');
                }}
              >
                取消
              </button>
            </footer>
          </div>
        </div>
      )}

      {notebookDialog && (
        <div className="modal-backdrop" onMouseDown={closeNotebookDialog}>
          <form
            className="modal-card notebook-name-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="notebook-dialog-title"
            onMouseDown={(event) => event.stopPropagation()}
            onSubmit={(event) => void submitNotebookDialog(event)}
            onKeyDown={(event) => {
              if (event.key === 'Escape' && !notebookDialog.saving) {
                event.preventDefault();
                closeNotebookDialog();
              }
            }}
          >
            <header>
              <div>
                <span className="eyebrow">
                  {notebookDialog.mode === 'rename' ? '重新命名' : '新增筆記本'}
                </span>
                <h2 id="notebook-dialog-title">
                  {notebookDialog.mode === 'rename'
                    ? '修改筆記本名稱'
                    : notebookDialog.parentId
                      ? '新增子筆記本'
                      : '新增最上層筆記本'}
                </h2>
              </div>
              <button
                className="icon-button"
                type="button"
                aria-label="關閉"
                title="關閉"
                disabled={notebookDialog.saving}
                onClick={closeNotebookDialog}
              >
                <UiIcon name="close" />
              </button>
            </header>
            <div className="notebook-name-content">
              <label htmlFor="notebook-name-input">筆記本名稱</label>
              <input
                id="notebook-name-input"
                ref={notebookDialogInputRef}
                value={notebookDialog.value}
                aria-invalid={!!notebookDialog.error}
                aria-describedby={notebookDialog.error ? 'notebook-name-error' : undefined}
                autoComplete="off"
                spellCheck={false}
                disabled={notebookDialog.saving}
                onChange={(event) => {
                  const value = event.target.value;
                  setNotebookDialog((current) => current
                    ? { ...current, value, error: current.error ? '' : current.error }
                    : current);
                }}
              />
              {notebookDialogParentPath && (
                <p className="notebook-dialog-location">
                  上層筆記本：<span>{notebookDialogParentPath}</span>
                </p>
              )}
              {notebookDialog.error && (
                <p id="notebook-name-error" className="notebook-dialog-error" role="alert">
                  {notebookDialog.error}
                </p>
              )}
            </div>
            <footer>
              <span>按 Enter 儲存，Esc 取消。</span>
              <div>
                <button
                  type="button"
                  disabled={notebookDialog.saving}
                  onClick={closeNotebookDialog}
                >
                  取消
                </button>
                <button className="primary" type="submit" disabled={notebookDialog.saving}>
                  {notebookDialog.saving
                    ? '儲存中…'
                    : notebookDialog.mode === 'rename' ? '儲存' : '建立'}
                </button>
              </div>
            </footer>
          </form>
        </div>
      )}

      {confirmDialog}

      {toast && <div className="toast">{toast}</div>}

      {importProgress && (
        <div className="progress-overlay">
          <div className="progress-card">
            <h3>正在匯入</h3>
            <p>{importProgress.message}</p>
            <div className="progress-track"><span style={{ width: `${Math.max(2, importProgress.progress * 100)}%` }} /></div>
            <small>{Math.round(importProgress.progress * 100)}%</small>
          </div>
        </div>
      )}

      {joplinPreview && (
        <div className="modal-backdrop">
          <div className="modal-card onboarding-card">
            <header>
              <div>
                <span className="eyebrow">第一次啟動</span>
                <h2>找到你的 Joplin 筆記</h2>
              </div>
              <div className="onboarding-badge">J</div>
            </header>
            <div className="onboarding-content">
              <p>
                PuffJoplin 偵測到本機 Joplin profile。可以安全複製筆記、筆記本、標籤與附件，
                原始 Joplin 資料不會被修改。
              </p>
              <div className="profile-source">
                <strong>{joplinPreview.displayName || 'Joplin profile'}</strong>
                <span>{joplinPreview.profilePath || bootstrap.joplinProfile}</span>
              </div>
              {joplinPreview.available ? (
                <div className="report-stats onboarding-stats">
                  <div><strong>{joplinPreview.notes}</strong><span>筆記</span></div>
                  <div><strong>{joplinPreview.notebooks}</strong><span>筆記本</span></div>
                  <div><strong>{joplinPreview.resources}</strong><span>附件</span></div>
                  <div><strong>{joplinPreview.encryptedNotes}</strong><span>加密筆記</span></div>
                </div>
              ) : (
                <div className="onboarding-error">
                  無法讀取這個 Joplin profile。你仍可手動選擇其他資料夾，或稍後再匯入。
                </div>
              )}
              {joplinPreview.error && (
                <div className="onboarding-error">{joplinPreview.error}</div>
              )}
              {joplinPreview.encryptedNotes > 0 && (
                <div className="onboarding-note">
                  有 {joplinPreview.encryptedNotes} 篇加密筆記不會匯入；請先在 Joplin 解密。
                </div>
              )}
              <div className="onboarding-safety">
                <span>✓</span>
                唯讀讀取來源
                <span>✓</span>
                交易式匯入
                <span>✓</span>
                重複項目自動略過
              </div>
            </div>
            <footer>
              <button onClick={() => void dismissJoplinImportPrompt()}>稍後，不再提示</button>
              <div>
                <button onClick={() => void chooseAndImportJoplinProfile()}>手動選擇資料夾</button>
                {joplinPreview.available && (
                  <button className="primary" onClick={() => void importDetectedJoplinProfile()}>
                    匯入 Joplin 筆記
                  </button>
                )}
              </div>
            </footer>
          </div>
        </div>
      )}

      {modal?.kind === 'settings' && (
        <div className="modal-backdrop" onMouseDown={() => setModal(null)}>
          <div
            className={`modal-card settings-modal ${settingsMaximized ? 'is-maximized' : ''}`}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header>
              <div><span className="eyebrow">PuffJoplin</span><h2>設定</h2></div>
              <div className="settings-window-actions">
                <button
                  className="icon-button"
                  type="button"
                  aria-label={settingsMaximized ? '還原設定' : '最大化設定'}
                  title={settingsMaximized ? '還原設定' : '最大化設定'}
                  onClick={() => setSettingsMaximized((value) => !value)}
                >
                  {settingsMaximized ? (
                    <svg viewBox="0 0 12 12" aria-hidden="true">
                      <path d="M3.5 3.5h5v5h-5zM2 2h5v1.5H3.5V7H2z" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 12 12" aria-hidden="true">
                      <path d="M2.5 2.5h7v7h-7z" />
                    </svg>
                  )}
                </button>
                <button
                  className="icon-button"
                  type="button"
                  aria-label="關閉設定"
                  onClick={() => setModal(null)}
                >
                  <UiIcon name="close" />
                </button>
              </div>
            </header>
            <div
              className="settings-tabs"
              role="tablist"
              aria-label="設定分類"
              onKeyDown={(event) => {
                const currentIndex = SETTINGS_TABS.findIndex((tab) => tab.id === settingsTab);
                let nextIndex = currentIndex;
                if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % SETTINGS_TABS.length;
                else if (event.key === 'ArrowLeft') {
                  nextIndex = (currentIndex - 1 + SETTINGS_TABS.length) % SETTINGS_TABS.length;
                } else if (event.key === 'Home') nextIndex = 0;
                else if (event.key === 'End') nextIndex = SETTINGS_TABS.length - 1;
                else return;
                event.preventDefault();
                const nextTab = SETTINGS_TABS[nextIndex];
                setSettingsTab(nextTab.id);
                window.requestAnimationFrame(() => {
                  document.getElementById(`settings-tab-${nextTab.id}`)?.focus();
                });
              }}
            >
              {SETTINGS_TABS.map((tab) => (
                <button
                  id={`settings-tab-${tab.id}`}
                  className={settingsTab === tab.id ? 'active' : ''}
                  type="button"
                  role="tab"
                  aria-selected={settingsTab === tab.id}
                  aria-controls={`settings-panel-${tab.id}`}
                  tabIndex={settingsTab === tab.id ? 0 : -1}
                  key={tab.id}
                  onClick={() => setSettingsTab(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="settings-content">
              <section
                id="settings-panel-appearance"
                className="settings-appearance"
                role="tabpanel"
                aria-labelledby="settings-tab-appearance"
                tabIndex={0}
                hidden={settingsTab !== 'appearance'}
              >
                <div className="settings-section-heading">
                  <div>
                    <strong id="appearance-heading">字體外觀</strong>
                      <span>調整整體介面字級與字型。</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setBaseFontSize(DEFAULT_BASE_FONT_SIZE);
                      setFontFamily(DEFAULT_FONT_FAMILY);
                      setCustomFontSelected(false);
                    }}
                  >
                    恢復預設
                  </button>
                </div>
                <div className="appearance-controls">
                  <label className="appearance-field">
                    <span>主要字體大小</span>
                    <div className="font-size-control">
                      <input
                        type="range"
                        min={12}
                        max={20}
                        step={1}
                        value={baseFontSize}
                        onChange={(event) => setBaseFontSize(normalizeBaseFontSize(event.target.value))}
                      />
                      <FreeNumberInput
                        value={baseFontSize}
                        ariaLabel="主要字體大小（像素）"
                        min={12}
                        max={20}
                        precision={0}
                        onCommit={(value) => setBaseFontSize(normalizeBaseFontSize(value))}
                      />
                      <span>px</span>
                    </div>
                  </label>
                  <label className="appearance-field">
                    <span>字型</span>
                    <FluentSelect
                      value={customFontSelected ? '__custom' : fontFamily}
                      options={[
                        ...FONT_PRESETS.map((preset) => ({
                          value: preset.value,
                          label: preset.label,
                        })),
                        { value: '__custom', label: '自訂字型…' },
                      ]}
                      ariaLabel="字型"
                      onChange={(value) => {
                        if (value === '__custom') {
                          setCustomFontSelected(true);
                          return;
                        }
                        setCustomFontSelected(false);
                        setFontFamily(value);
                      }}
                    />
                  </label>
                  {customFontSelected && (
                    <label className="appearance-field custom-font-field">
                      <span>自訂字型名稱</span>
                      <input
                        type="text"
                        value={fontFamily}
                        spellCheck={false}
                        placeholder="例如：Noto Sans TC"
                        onChange={(event) => setFontFamily(event.target.value)}
                        onBlur={() => setFontFamily(
                          sanitizeFontFamily(fontFamily) || DEFAULT_FONT_FAMILY,
                        )}
                      />
                      <small>必須是系統已安裝的字型；找不到時會使用 Segoe UI 系統 fallback。</small>
                    </label>
                  )}
                </div>
                <div className="font-preview" aria-label="字體預覽">
                  <strong className="font-preview-brand">PuffJoplin</strong>
                  <span className="font-preview-subtitle">目前位置</span>
                  <p>主要內文以清晰的 1× 字級呈現，方便長時間閱讀與編輯。</p>
                  <small>筆記說明與次要資訊使用 0.8× 字級。</small>
                </div>
              </section>
              <EditorSettings
                preferences={editorPreferences}
                theme={theme}
                hidden={settingsTab !== 'editor'}
                onChange={setEditorPreferences}
                onReset={() => setEditorPreferences(defaultEditorPreferences())}
              />
              <section
                id="settings-panel-pdf"
                className="settings-pdf"
                role="tabpanel"
                aria-labelledby="settings-tab-pdf"
                tabIndex={0}
                hidden={settingsTab !== 'pdf'}
              >
                <div className="settings-section-heading">
                  <div>
                    <strong id="pdf-settings-heading">PDF 匯出</strong>
                    <span>設定 PDF 封面、每頁頁尾與滿版浮水印；HTML 匯出不受影響。</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setPdfFooterCopyright('');
                      setPdfWatermarkText('');
                      setPdfFooterEnabled(true);
                      setPdfWatermarkEnabled(false);
                      setPdfCoverDesign(resetPDFCoverDesign(false));
                      setPdfWatermarkWidth(DEFAULT_PDF_WATERMARK_WIDTH);
                      setPdfWatermarkHeight(DEFAULT_PDF_WATERMARK_HEIGHT);
                      setPdfWatermarkFontSize(DEFAULT_PDF_WATERMARK_FONT_SIZE);
                      setPdfWatermarkOpacity(DEFAULT_PDF_WATERMARK_OPACITY);
                      setPdfWatermarkAngle(DEFAULT_PDF_WATERMARK_ANGLE);
                      setPdfWatermarkShowBorder(false);
                    }}
                  >
                    清除設定
                  </button>
                </div>
                <PdfCoverDesigner
                  design={pdfCoverDesign}
                  noteTitle={current.title}
                  fields={current.additionalInfo}
                  globalFooterCopyright={pdfFooterCopyright}
                  onChange={setPdfCoverDesign}
                  onReset={() => setPdfCoverDesign(resetPDFCoverDesign(pdfCoverDesign.enabled))}
                />
                <div className="pdf-settings-toggles">
                  <div className="pdf-settings-enable">
                    <label className="appearance-toggle">
                      <input
                        type="checkbox"
                        checked={pdfFooterEnabled}
                        onChange={(event) => setPdfFooterEnabled(event.target.checked)}
                      />
                      <span className="appearance-toggle-track" aria-hidden="true" />
                      <span>在 PDF 加入版權宣告頁尾</span>
                    </label>
                    <small>{pdfFooterEnabled
                      ? '版權宣告會顯示於每頁內文底部；封面位置由封面變數控制。'
                      : '目前關閉；版權宣告文字仍會保留。'}</small>
                  </div>
                  <div className="pdf-settings-enable">
                    <label className="appearance-toggle">
                      <input
                        type="checkbox"
                        checked={pdfWatermarkEnabled}
                        onChange={(event) => setPdfWatermarkEnabled(event.target.checked)}
                      />
                      <span className="appearance-toggle-track" aria-hidden="true" />
                      <span>在 PDF 加入浮水印</span>
                    </label>
                    <small>{pdfWatermarkEnabled
                      ? '浮水印會套用到內文頁；封面另由封面浮水印開關控制。'
                      : '目前關閉；浮水印參數仍會保留。'}</small>
                  </div>
                </div>
                <div className="pdf-settings-controls">
                  <label className="pdf-settings-field">
                    <span className="pdf-settings-label">
                      <span>頁尾版權宣告</span>
                      <small>{Array.from(pdfFooterCopyright).length}/{PDF_FOOTER_MAX_LENGTH}</small>
                    </span>
                    <input
                      type="text"
                      value={pdfFooterCopyright}
                      maxLength={PDF_FOOTER_MAX_LENGTH}
                      placeholder="例如：© 2026 PuffJoplin. All rights reserved."
                      onChange={(event) => setPdfFooterCopyright(event.target.value)}
                      onBlur={() => setPdfFooterCopyright((value) =>
                        sanitizePDFSettingText(value, PDF_FOOTER_MAX_LENGTH))}
                    />
                    <small>空白時不顯示頁尾；文字會置中顯示於每一頁底部。</small>
                  </label>
                  <label className="pdf-settings-field">
                    <span className="pdf-settings-label">
                      <span>浮水印文字</span>
                      <small>{Array.from(pdfWatermarkText).length}/{PDF_WATERMARK_MAX_LENGTH}</small>
                    </span>
                    <input
                      type="text"
                      value={pdfWatermarkText}
                      maxLength={PDF_WATERMARK_MAX_LENGTH}
                      placeholder="例如：內部文件／PuffJoplin"
                      onChange={(event) => setPdfWatermarkText(event.target.value)}
                      onBlur={() => setPdfWatermarkText((value) =>
                        sanitizePDFSettingText(value, PDF_WATERMARK_MAX_LENGTH))}
                    />
                    <small>空白時不顯示浮水印；第二行自動使用 PDF 匯出日期。</small>
                  </label>
                </div>
                <div className="pdf-watermark-parameters">
                  <div className="pdf-watermark-parameters-heading">
                    <strong>浮水印參數</strong>
                    <span>調整圖樣尺寸、字級與整體透明度。</span>
                  </div>
                  <div className="pdf-watermark-parameter-grid">
                    <label className="pdf-watermark-parameter">
                      <span>畫布寬度</span>
                      <div>
                        <FreeNumberInput
                          value={pdfWatermarkWidth}
                          ariaLabel="浮水印畫布寬度（像素）"
                          min={PDF_WATERMARK_WIDTH_RANGE[0]}
                          max={PDF_WATERMARK_WIDTH_RANGE[1]}
                          precision={0}
                          onCommit={(value) => {
                            setPdfWatermarkWidth(normalizePDFInteger(
                              value,
                              DEFAULT_PDF_WATERMARK_WIDTH,
                              PDF_WATERMARK_WIDTH_RANGE,
                            ));
                          }}
                        />
                        <span>px</span>
                      </div>
                    </label>
                    <label className="pdf-watermark-parameter">
                      <span>畫布高度</span>
                      <div>
                        <FreeNumberInput
                          value={pdfWatermarkHeight}
                          ariaLabel="浮水印畫布高度（像素）"
                          min={PDF_WATERMARK_HEIGHT_RANGE[0]}
                          max={PDF_WATERMARK_HEIGHT_RANGE[1]}
                          precision={0}
                          onCommit={(value) => {
                            setPdfWatermarkHeight(normalizePDFInteger(
                              value,
                              DEFAULT_PDF_WATERMARK_HEIGHT,
                              PDF_WATERMARK_HEIGHT_RANGE,
                            ));
                          }}
                        />
                        <span>px</span>
                      </div>
                    </label>
                    <label className="pdf-watermark-parameter">
                      <span>字體大小</span>
                      <div>
                        <FreeNumberInput
                          value={pdfWatermarkFontSize}
                          ariaLabel="浮水印字體大小（像素）"
                          min={PDF_WATERMARK_FONT_SIZE_RANGE[0]}
                          max={PDF_WATERMARK_FONT_SIZE_RANGE[1]}
                          precision={0}
                          onCommit={(value) => {
                            setPdfWatermarkFontSize(normalizePDFInteger(
                              value,
                              DEFAULT_PDF_WATERMARK_FONT_SIZE,
                              PDF_WATERMARK_FONT_SIZE_RANGE,
                            ));
                          }}
                        />
                        <span>px</span>
                      </div>
                    </label>
                    <label className="pdf-watermark-parameter">
                      <span>旋轉角度</span>
                      <div>
                        <FreeNumberInput
                          value={pdfWatermarkAngle}
                          ariaLabel="浮水印旋轉角度"
                          min={PDF_WATERMARK_ANGLE_RANGE[0]}
                          max={PDF_WATERMARK_ANGLE_RANGE[1]}
                          precision={0}
                          onCommit={(value) => {
                            setPdfWatermarkAngle(normalizePDFInteger(
                              value,
                              DEFAULT_PDF_WATERMARK_ANGLE,
                              PDF_WATERMARK_ANGLE_RANGE,
                            ));
                          }}
                        />
                        <span>°</span>
                      </div>
                    </label>
                    <label className="pdf-watermark-parameter opacity">
                      <span>透明度</span>
                      <div>
                        <input
                          type="range"
                          min={PDF_WATERMARK_OPACITY_RANGE[0]}
                          max={PDF_WATERMARK_OPACITY_RANGE[1]}
                          value={pdfWatermarkOpacity}
                          onChange={(event) => {
                            const normalized = normalizePDFInteger(
                              event.target.value,
                              DEFAULT_PDF_WATERMARK_OPACITY,
                              PDF_WATERMARK_OPACITY_RANGE,
                            );
                            setPdfWatermarkOpacity(normalized);
                          }}
                        />
                        <FreeNumberInput
                          value={pdfWatermarkOpacity}
                          ariaLabel="浮水印透明度"
                          min={PDF_WATERMARK_OPACITY_RANGE[0]}
                          max={PDF_WATERMARK_OPACITY_RANGE[1]}
                          precision={0}
                          onCommit={(value) => {
                            setPdfWatermarkOpacity(normalizePDFInteger(
                              value,
                              DEFAULT_PDF_WATERMARK_OPACITY,
                              PDF_WATERMARK_OPACITY_RANGE,
                            ));
                          }}
                        />
                        <span>%</span>
                      </div>
                    </label>
                  </div>
                </div>
                <div className="pdf-watermark-border-toggle">
                  <label className="appearance-toggle">
                    <input
                      type="checkbox"
                      checked={pdfWatermarkShowBorder}
                      onChange={(event) => setPdfWatermarkShowBorder(event.target.checked)}
                    />
                    <span className="appearance-toggle-track" aria-hidden="true" />
                    <span>顯示圖樣邊框（測試浮水印位置）</span>
                  </label>
                  <small>啟用後，每個浮水印圖樣會顯示紅色虛線邊框。</small>
                </div>
                <div className="pdf-settings-summary">
                  <strong>輸出規則</strong>
                  <span>
                    {pdfWatermarkWidth}×{pdfWatermarkHeight} px 圖樣、
                    {pdfWatermarkFontSize} px 字級、1.5 行高、每張一組文字＋日期，
                    文字旋轉 {pdfWatermarkAngle}°，圖樣保持水平平鋪。
                  </span>
                  <span>文字色彩 #C0C0C0，整體透明度 {pdfWatermarkOpacity}%，置於正文最上層。</span>
                  <span>版權與浮水印只套用於 PDF，不影響 HTML、Markdown 或 DOCX。</span>
                </div>
              </section>
              <section
                id="settings-panel-shortcuts"
                className="settings-shortcuts"
                role="tabpanel"
                aria-labelledby="settings-tab-shortcuts"
                tabIndex={0}
                hidden={settingsTab !== 'shortcuts'}
              >
                <div className="settings-section-heading">
                  <div>
                    <strong id="shortcuts-heading">鍵盤快捷鍵</strong>
                    <span>目前版本支援的快捷鍵一覽；此清單為唯讀，不提供自訂。</span>
                  </div>
                </div>
                <div className="settings-shortcut-groups">
                  {KEYBOARD_SHORTCUT_GROUPS.map((group) => (
                    <section className="settings-shortcut-group" key={group.id}>
                      <header>
                        <h3>{group.title}</h3>
                        <p>{group.description}</p>
                      </header>
                      <div className="settings-shortcut-list">
                        {group.shortcuts.map((shortcut) => (
                          <div
                            className="settings-shortcut-row"
                            key={`${group.id}-${shortcut.keys.join('-')}-${shortcut.action}`}
                          >
                            <span>{shortcut.action}</span>
                            <span className="settings-shortcut-keys">
                              {shortcut.keys.map((key, index) => (
                                <span className="settings-shortcut-key-part" key={`${key}-${index}`}>
                                  {index > 0 && <span className="settings-shortcut-plus" aria-hidden="true">+</span>}
                                  <kbd>{key}</kbd>
                                </span>
                              ))}
                            </span>
                          </div>
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              </section>
              <section
                id="settings-panel-data"
                className="settings-data"
                role="tabpanel"
                aria-labelledby="settings-tab-data"
                tabIndex={0}
                hidden={settingsTab !== 'data'}
              >
                <div className="settings-section-heading">
                  <div>
                    <strong id="data-heading">資料與儲存</strong>
                    <span>匯入既有筆記、開啟本機資料位置，或建立 Markdown 備份。</span>
                  </div>
                </div>
                <section className="settings-data-section" aria-labelledby="data-import-heading">
                  <div className="settings-section-heading">
                    <div>
                      <strong id="data-import-heading">匯入筆記</strong>
                      <span>來源資料不會被修改。</span>
                    </div>
                  </div>
                  <div className="settings-grid">
                    <button onClick={() => void importProfile()}>
                      <strong>從 Joplin profile 匯入</strong>
                      <span>安全複製既有筆記、標籤與附件，不修改來源。</span>
                    </button>
                    <button onClick={() => void importFile()}>
                      <strong>匯入 JEX / ENEX / Markdown</strong>
                      <span>從封存檔或單一 Markdown 檔案加入筆記。</span>
                    </button>
                  </div>
                </section>
                <section className="settings-data-section" aria-labelledby="data-storage-heading">
                  <div className="settings-section-heading">
                    <div>
                      <strong id="data-storage-heading">儲存與匯出</strong>
                      <span>管理本機資料位置與目前筆記本的備份。</span>
                    </div>
                  </div>
                  <div className="settings-grid">
                    <button onClick={() => void api.openDataFolder()}>
                      <strong>開啟資料資料夾</strong>
                      <span>{bootstrap.dataDir}</span>
                    </button>
                    <button onClick={() => void exportNotebook('md')}>
                      <strong>匯出目前筆記本為 Markdown</strong>
                      <span>保留純文字格式，便於備份或移轉。</span>
                    </button>
                  </div>
                </section>
                <section
                  className="settings-data-section settings-managed-exclusions"
                  aria-labelledby="data-managed-exclusions-heading"
                >
                  <div className="settings-section-heading">
                    <div>
                      <strong id="data-managed-exclusions-heading">直接管理筆記本排除</strong>
                      <span>依完整名稱隱藏所有直接管理筆記本內的資料夾或 Markdown 檔案。</span>
                    </div>
                  </div>
                  <p className="managed-exclusions-note">
                    名稱比對區分大小寫；資料夾會排除所有同名的非根目錄子樹。例如
                    <code>archive</code> 不會排除 <code>Archive</code>，
                    <code>draft.md</code> 也不會排除 <code>Draft.md</code>。
                    此功能套用到全部管理根目錄，不會修改或刪除磁碟檔案。
                  </p>
                  {managedExclusionsLoading ? (
                    <p className="managed-exclusions-loading" role="status">正在讀取排除設定…</p>
                  ) : (
                    <>
                      <div className="managed-exclusion-groups">
                        <div className="managed-exclusion-group">
                          <label htmlFor="managed-folder-exclusion-input">
                            <strong>資料夾名稱</strong>
                            <span>只輸入名稱，例如 <code>archive</code></span>
                          </label>
                          <div className="managed-exclusion-input-row">
                            <input
                              id="managed-folder-exclusion-input"
                              type="text"
                              value={folderExclusionInput}
                              spellCheck={false}
                              placeholder="例如：archive"
                              disabled={managedExclusionsApplying}
                              onChange={(event) => {
                                setFolderExclusionInput(event.target.value);
                                setManagedExclusionsError('');
                              }}
                              onKeyDown={(event) => {
                                if (event.key !== 'Enter') return;
                                event.preventDefault();
                                addManagedExclusion('folder');
                              }}
                            />
                            <button
                              type="button"
                              disabled={!folderExclusionInput.trim() || managedExclusionsApplying}
                              onClick={() => addManagedExclusion('folder')}
                            >
                              加入
                            </button>
                          </div>
                          <div className="managed-exclusion-list" aria-label="已排除的資料夾名稱">
                            {managedExclusions.folderNames.length === 0 ? (
                              <span className="managed-exclusion-empty">尚未排除資料夾</span>
                            ) : managedExclusions.folderNames.map((name) => (
                              <div className="managed-exclusion-item" key={name}>
                                <span>{name}</span>
                                <button
                                  type="button"
                                  aria-label={`移除資料夾排除 ${name}`}
                                  title="移除排除"
                                  disabled={managedExclusionsApplying}
                                  onClick={() => removeManagedExclusion('folder', name)}
                                >
                                  ×
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="managed-exclusion-group">
                          <label htmlFor="managed-markdown-exclusion-input">
                            <strong>Markdown 檔名</strong>
                            <span>必須包含 <code>.md</code>，例如 <code>draft.md</code></span>
                          </label>
                          <div className="managed-exclusion-input-row">
                            <input
                              id="managed-markdown-exclusion-input"
                              type="text"
                              value={markdownExclusionInput}
                              spellCheck={false}
                              placeholder="例如：draft.md"
                              disabled={managedExclusionsApplying}
                              onChange={(event) => {
                                setMarkdownExclusionInput(event.target.value);
                                setManagedExclusionsError('');
                              }}
                              onKeyDown={(event) => {
                                if (event.key !== 'Enter') return;
                                event.preventDefault();
                                addManagedExclusion('markdown');
                              }}
                            />
                            <button
                              type="button"
                              disabled={!markdownExclusionInput.trim() || managedExclusionsApplying}
                              onClick={() => addManagedExclusion('markdown')}
                            >
                              加入
                            </button>
                          </div>
                          <div className="managed-exclusion-list" aria-label="已排除的 Markdown 檔名">
                            {managedExclusions.markdownFileNames.length === 0 ? (
                              <span className="managed-exclusion-empty">尚未排除 Markdown 檔案</span>
                            ) : managedExclusions.markdownFileNames.map((name) => (
                              <div className="managed-exclusion-item" key={name}>
                                <span>{name}</span>
                                <button
                                  type="button"
                                  aria-label={`移除 Markdown 排除 ${name}`}
                                  title="移除排除"
                                  disabled={managedExclusionsApplying}
                                  onClick={() => removeManagedExclusion('markdown', name)}
                                >
                                  ×
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="managed-exclusions-actions">
                        <span>
                          {managedDirectoryExclusionsEqual(managedExclusions, savedManagedExclusions)
                            ? '目前沒有尚未套用的變更。'
                            : '清單已變更，套用後才會重新整理索引。'}
                        </span>
                        <button
                          className="primary"
                          type="button"
                          disabled={
                            managedExclusionsApplying ||
                            managedDirectoryExclusionsEqual(managedExclusions, savedManagedExclusions)
                          }
                          onClick={() => void applyManagedDirectoryExclusions()}
                        >
                          {managedExclusionsApplying ? '套用中…' : '套用變更'}
                        </button>
                      </div>
                    </>
                  )}
                  {managedExclusionsError && (
                    <p className="managed-exclusions-error" role="alert">
                      {managedExclusionsError}
                    </p>
                  )}
                  <p
                    className="managed-exclusions-result"
                    role="status"
                    aria-live="polite"
                  >
                    {managedExclusionsResult}
                  </p>
                </section>
                <section
                  className="settings-data-section settings-resource-cleanup"
                  aria-labelledby="data-resource-cleanup-heading"
                >
                  <div className="settings-section-heading">
                    <div>
                      <strong id="data-resource-cleanup-heading">資源清理</strong>
                      <span>清理一般筆記不再引用的附件，以及沒有索引的孤兒檔。</span>
                    </div>
                  </div>
                  <div className="settings-grid">
                    <button
                      className="resource-cleanup-button"
                      type="button"
                      disabled={resourceCleanupRunning || importProgress !== null}
                      onClick={() => void cleanupUnusedResources()}
                    >
                      <strong>{resourceCleanupRunning ? '清理中…' : '資源檔清理'}</strong>
                      <span>垃圾桶中的引用會保留；直接管理筆記本的外部檔案不會處理。</span>
                    </button>
                  </div>
                  <p
                    className="resource-cleanup-result"
                    role="status"
                    aria-live="polite"
                  >
                    {resourceCleanupResult}
                  </p>
                </section>
              </section>
            </div>
            <footer>
              <span>PuffJoplin v{bootstrap.appVersion} · 離線單機版 · 不使用同步、帳號或雲端服務</span>
              <button onClick={() => setModal(null)}>完成</button>
            </footer>
          </div>
        </div>
      )}

      {modal?.kind === 'import-report' && (
        <div className="modal-backdrop" onMouseDown={() => setModal(null)}>
          <div className="modal-card import-report" onMouseDown={(event) => event.stopPropagation()}>
            <header>
              <div><span className="eyebrow">匯入結果</span><h2>資料已處理</h2></div>
              <button
                className="icon-button"
                type="button"
                aria-label="關閉匯入結果"
                onClick={() => setModal(null)}
              >
                <UiIcon name="close" />
              </button>
            </header>
            <div className="report-stats">
              <div><strong>{modal.report.notes}</strong><span>筆記</span></div>
              <div><strong>{modal.report.notebooks}</strong><span>筆記本</span></div>
              <div><strong>{modal.report.tags}</strong><span>標籤</span></div>
              <div><strong>{modal.report.resources}</strong><span>附件</span></div>
              <div><strong>{modal.report.skipped}</strong><span>略過</span></div>
            </div>
            {(modal.report.encryptedSkipped.length > 0 || modal.report.warnings.length > 0) && (
              <div className="report-warnings">
                <h3>需要注意</h3>
                {modal.report.encryptedSkipped.map((title) => (
                  <p key={`encrypted-${title}`}><strong>{title}</strong>：加密筆記未匯入，請先在 Joplin 解密。</p>
                ))}
                {modal.report.warnings.slice(0, 30).map((warning, index) => (
                  <p key={`${warning.item}-${index}`}><strong>{warning.item}</strong>：{warning.message}</p>
                ))}
              </div>
            )}
            <footer>
              <span>來源：{modal.report.source}</span>
              <button className="primary" onClick={() => setModal(null)}>開始使用</button>
            </footer>
          </div>
        </div>
      )}
    </main>
  );
}
