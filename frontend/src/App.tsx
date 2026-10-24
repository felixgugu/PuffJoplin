import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
} from 'react';
import { api, onEvent } from './api';
import { convertNotebookMarkdownToDocx } from './docxExport';
import EditorTabBar from './EditorTabBar';
import {
  activateEditorTab as activateEditorTabState,
  closeEditorTab,
  EDITOR_TABS_KEY,
  loadEditorTabs,
  normalizeEditorTabs,
  openEditorNote,
  removeNoteFromEditorTabs,
  toggleEditorTabPin,
  updateEditorTabTitle,
  type EditorTab,
  type EditorTabsState,
} from './editorTabs';
import { onboardingDecision } from './onboarding';
import NoteTags from './NoteTags';
import {
  prepareNotebookDialogSubmission,
  type NotebookDialogMode,
} from './notebookDialog';
import UiIcon from './UiIcon';
import VditorEditor, { type VditorEditorHandle } from './VditorEditor';
import {
  NOTE_LIST_COLLAPSED_KEY,
  NOTE_LIST_SUMMARY_KEY,
  NOTE_SORT_BY_KEY,
  NOTE_SORT_DIRECTION_KEY,
  parseNoteSortBy,
  parseNoteSortDirection,
  parseShowNoteSummary,
  parseSearchScope,
  SEARCH_SCOPE_KEY,
  shouldExpandNoteList,
} from './noteListPreferences';
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
import { nextTodoState, todoActionLabel } from './noteTodo';
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
  ImportReport,
  JoplinProfilePreview,
  Note,
  NoteExportFormat,
  NoteInput,
  NoteSummary,
  NoteSortBy,
  NoteSortDirection,
  Notebook,
  Resource,
  SearchScope,
  Tag,
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

type NotebookDialogState = {
  mode: NotebookDialogMode;
  parentId: string;
  notebook: Notebook | null;
  value: string;
  error: string;
  saving: boolean;
};

export default function App() {
  const [bootstrap, setBootstrap] = useState<BootstrapState | null>(null);
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [notes, setNotes] = useState<NoteSummary[]>([]);
  const [current, setCurrent] = useState<Note>(emptyNote);
  const [editorTabs, setEditorTabs] = useState<EditorTabsState>(
    () => loadEditorTabs(localStorage.getItem(EDITOR_TABS_KEY)),
  );
  const [view, setView] = useState<View>({ kind: 'all' });
  const [search, setSearch] = useState('');
  const [saveState, setSaveState] = useState<'saved' | 'dirty' | 'saving' | 'error'>('saved');
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [attachmentMenuOpen, setAttachmentMenuOpen] = useState(false);
  const [exportingFormat, setExportingFormat] = useState<NoteExportFormat | null>(null);
  const [tagSaving, setTagSaving] = useState(false);
  const [toast, setToast] = useState('');
  const [fatalError, setFatalError] = useState('');
  const [joplinPreview, setJoplinPreview] = useState<JoplinProfilePreview | null>(null);
  const [modal, setModal] = useState<
    | { kind: 'import-report'; report: ImportReport }
    | { kind: 'settings' }
    | null
  >(null);
  const [importProgress, setImportProgress] = useState<{ progress: number; message: string } | null>(null);
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
  const [showNoteSummary, setShowNoteSummary] = useState(
    () => parseShowNoteSummary(localStorage.getItem(NOTE_LIST_SUMMARY_KEY)),
  );
  const [searchScope, setSearchScope] = useState<SearchScope>(
    () => parseSearchScope(localStorage.getItem(SEARCH_SCOPE_KEY)),
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
  const [moveNoteDialog, setMoveNoteDialog] = useState<NoteSummary | null>(null);
  const [notebookDialog, setNotebookDialog] = useState<NotebookDialogState | null>(null);
  const [newNotebookMenuOpen, setNewNotebookMenuOpen] = useState(false);
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
  const saveTimer = useRef<number | null>(null);
  const editorRef = useRef<VditorEditorHandle | null>(null);
  const notebookDialogInputRef = useRef<HTMLInputElement | null>(null);
  const newNotebookMenuRef = useRef<HTMLDivElement | null>(null);
  const editorTabsRef = useRef(editorTabs);
  const currentRef = useRef(current);
  const initializedRef = useRef(false);
  const dirtyRef = useRef(false);
  const savingRef = useRef(false);
  const pendingSaveRef = useRef(false);
  const listRequestRef = useRef(0);
  const lastListFilterRef = useRef('');

  currentRef.current = current;
  editorTabsRef.current = editorTabs;

  useEffect(() => {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  useEffect(() => {
    localStorage.setItem(COLLAPSED_NOTEBOOKS_KEY, JSON.stringify([...collapsedNotebookIds]));
  }, [collapsedNotebookIds]);

  useEffect(() => {
    localStorage.setItem(SIDEBAR_TAB_KEY, sidebarTab);
    setNotebookContextMenu(null);
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
    const close = (event: PointerEvent) => {
      if (!newNotebookMenuRef.current?.contains(event.target as Node)) {
        setNewNotebookMenuOpen(false);
      }
    };
    window.addEventListener('pointerdown', close);
    return () => window.removeEventListener('pointerdown', close);
  }, [newNotebookMenuOpen]);

  useEffect(() => {
    if (!noteContextMenu) return;
    const close = () => setNoteContextMenu(null);
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
    localStorage.setItem(NOTE_LIST_SUMMARY_KEY, String(showNoteSummary));
  }, [showNoteSummary]);

  useEffect(() => {
    localStorage.setItem(SEARCH_SCOPE_KEY, searchScope);
  }, [searchScope]);

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

  const refreshTaxonomy = useCallback(async () => {
    const [nextNotebooks, nextTags] = await Promise.all([api.listNotebooks(), api.listTags()]);
    setNotebooks(nextNotebooks);
    setTags(nextTags);
  }, []);

  const searchNotebookID = view.kind === 'notebook' ? view.id : current.notebookId;
  const effectiveSearchScope = searchNotebookID ? searchScope : 'all';
  const searching = search.trim() !== '';

  const listQuery = useCallback(() => {
    return buildNoteListQuery({
      view,
      search,
      searchScope: effectiveSearchScope,
      searchNotebookID,
      sortBy: noteSortBy,
      sortDirection: noteSortDirection,
      limit: 300,
      offset: 0,
    });
  }, [effectiveSearchScope, noteSortBy, noteSortDirection, search, searchNotebookID, view]);

  const listFilterKey = [
    view.kind,
    view.kind === 'notebook' || view.kind === 'tag' ? view.id : '',
    search,
    searching ? effectiveSearchScope : '',
    searching ? searchNotebookID : '',
  ].join(':');

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
  }, [notify, refreshNotes]);

  const scheduleSave = useCallback(() => {
    if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      saveTimer.current = null;
      void saveCurrent();
    }, 650);
  }, [saveCurrent]);

  const selectNote = useCallback(async (id: string, mode: 'open' | 'activate' = 'open') => {
    if (currentRef.current.id && currentRef.current.id !== id && dirtyRef.current) {
      const saved = await saveCurrent();
      if (!saved) return;
    }
    try {
      const note = await api.getNote(id);
      setCurrent(note);
      setEditorTabs((tabs) => mode === 'open'
        ? openEditorNote(tabs, { id: note.id, title: note.title || '未命名筆記' })
        : activateEditorTabState(tabs, note.id));
      setSaveState('saved');
      setExportMenuOpen(false);
      setAttachmentMenuOpen(false);
    } catch (error) {
      setEditorTabs((tabs) => removeNoteFromEditorTabs(tabs, id));
      notify(`無法開啟筆記：${errorMessage(error)}`);
    }
  }, [notify, saveCurrent]);

  const activateEditorTab = useCallback(async (id: string) => {
    if (currentRef.current.id === id) return;
    await selectNote(id, 'activate');
  }, [selectNote]);

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
    if (!wasActive) return;
    if (nextTabs.activeID) await selectNote(nextTabs.activeID, 'activate');
    else setCurrent(emptyNote);
  }, [saveCurrent, selectNote]);

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
    setCurrent(note);
    setEditorTabs((tabs) => openEditorNote(tabs, { id: note.id, title: note.title }));
    await Promise.all([refreshTaxonomy(), refreshNotes()]);
  }, [refreshNotes, refreshTaxonomy]);

  const restoreEditorTabSession = useCallback(async (): Promise<Note | null> => {
    const saved = editorTabsRef.current;
    const notesByID = new Map<string, Note>();
    const pinned: EditorTab[] = [];
    for (const tab of saved.pinned) {
      try {
        const note = await api.getNote(tab.id);
        notesByID.set(note.id, note);
        pinned.push({ id: note.id, title: note.title || '未命名筆記' });
      } catch {
        // Stale tabs are removed below.
      }
    }
    let preview: EditorTab | null = null;
    if (saved.preview) {
      try {
        const note = await api.getNote(saved.preview.id);
        notesByID.set(note.id, note);
        preview = { id: note.id, title: note.title || '未命名筆記' };
      } catch {
        // Stale preview is removed below.
      }
    }
    const tabs = normalizeEditorTabs({ pinned, preview, activeID: saved.activeID });
    setEditorTabs(tabs);
    if (!tabs.activeID) return null;
    if (notesByID.has(tabs.activeID)) return notesByID.get(tabs.activeID) || null;
    try {
      return await api.getNote(tabs.activeID);
    } catch {
      return null;
    }
  }, []);

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
      setAppearanceLoaded(true);
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
    const cleanups = [
      onEvent('notes.changed', () => { void refreshNotes(); }),
      onEvent('notebooks.changed', () => { void refreshTaxonomy(); }),
      onEvent('tags.changed', () => { void refreshTaxonomy(); }),
      onEvent('import.progress', (value) => {
        setImportProgress(value as { progress: number; message: string });
      }),
      onEvent('import.finished', () => setImportProgress(null)),
      onEvent('app.error', (value) => setFatalError(String(value))),
      onEvent('managedDirectory.refreshed', () => {
        const note = currentRef.current;
        if (note.storageKind !== 'directory' || !note.id || dirtyRef.current) return;
        void api.getNote(note.id)
          .then((updated) => {
            if (currentRef.current.id !== updated.id || dirtyRef.current) return;
            setCurrent(updated);
            setEditorTabs((tabs) => updateEditorTabTitle(tabs, updated.id, updated.title));
          })
          .catch(() => undefined);
      }),
    ];
    return () => cleanups.forEach((cleanup) => cleanup());
  }, [refreshNotes, refreshTaxonomy]);

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
      const note = await api.createNote(activeNotebookId);
      setCurrent(note);
      setEditorTabs((tabs) => openEditorNote(tabs, { id: note.id, title: note.title }));
      setView({ kind: 'notebook', id: activeNotebookId });
      await Promise.all([refreshNotes(), refreshTaxonomy()]);
    } catch (error) {
      notify(`無法建立筆記：${errorMessage(error)}`);
    }
  }, [activeNotebookId, notify, refreshNotes, refreshTaxonomy, saveCurrent]);

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
    const confirmed = await api.confirm(
      managed ? '停止管理資料夾' : '刪除筆記本',
      managed
        ? `要停止管理「${notebook.storageRoot}」嗎？磁碟上的 Markdown 與圖片不會被刪除。`
        : `確定要刪除「${notebook.title}」及其中的所有筆記嗎？此操作無法復原。`,
    );
    if (!confirmed) return;
    try {
      await api.deleteNotebook(notebook.id, !managed);
      setView({ kind: 'all' });
      setCurrent(emptyNote);
      await Promise.all([refreshTaxonomy(), refreshNotes()]);
    } catch (error) {
      notify(`${managed ? '停止管理' : '刪除'}失敗：${errorMessage(error)}`);
    }
  }, [notify, refreshNotes, refreshTaxonomy]);

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

  const trashCurrent = useCallback(async () => {
    const note = currentRef.current;
    if (!note.id) return;
    if (savingRef.current) {
      notify('筆記正在儲存，請稍後再移至垃圾桶');
      return;
    }
    const confirmed = await api.confirm('移至垃圾桶', `要將「${note.title || '未命名筆記'}」移至垃圾桶嗎？`);
    if (!confirmed) return;
    try {
      await api.trashNote(note.id);
      if (saveTimer.current !== null) {
        window.clearTimeout(saveTimer.current);
        saveTimer.current = null;
      }
      dirtyRef.current = false;
      pendingSaveRef.current = false;
      setSaveState('saved');
      const nextTabs = removeNoteFromEditorTabs(editorTabsRef.current, note.id);
      setEditorTabs(nextTabs);
      if (nextTabs.activeID) await selectNote(nextTabs.activeID, 'activate');
      else setCurrent(emptyNote);
      await refreshNotes();
      notify('筆記已移至垃圾桶');
    } catch (error) {
      notify(`移至垃圾桶失敗：${errorMessage(error)}`);
    }
  }, [notify, refreshNotes, selectNote]);

  const restoreCurrent = useCallback(async () => {
    if (!current.id) return;
    try {
      await api.restoreNote(current.id);
      setCurrent((value) => ({ ...value, deletedAt: 0 }));
      await refreshNotes();
      notify('筆記已還原');
    } catch (error) {
      notify(errorMessage(error));
    }
  }, [current.id, notify, refreshNotes]);

  const permanentlyDeleteCurrent = useCallback(async () => {
    if (!current.id) return;
    const confirmed = await api.confirm('永久刪除', '永久刪除後無法復原，確定繼續嗎？');
    if (!confirmed) return;
    try {
      await api.deleteNotePermanently(current.id);
      const nextTabs = removeNoteFromEditorTabs(editorTabsRef.current, current.id);
      setEditorTabs(nextTabs);
      if (nextTabs.activeID) await selectNote(nextTabs.activeID, 'activate');
      else setCurrent(emptyNote);
      await refreshNotes();
    } catch (error) {
      notify(errorMessage(error));
    }
  }, [current.id, notify, refreshNotes, selectNote]);

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

  const exportCurrentNote = useCallback(async (format: NoteExportFormat) => {
    setExportMenuOpen(false);
    if (!currentRef.current.id || exportingFormat) return;
    if (dirtyRef.current) {
      const saved = await saveCurrent();
      if (!saved) {
        notify('筆記尚未儲存完成，請稍後再匯出');
        return;
      }
    }
    const html = editorRef.current?.getHTML();
    if (!html) {
      notify('編輯器尚未載入完成，請稍後再試');
      return;
    }
    setExportingFormat(format);
    try {
      const path = await api.exportNote({
        noteId: currentRef.current.id,
        format,
        html,
      });
      if (path) notify(`已匯出至 ${path}`);
    } catch (error) {
      notify(`匯出失敗：${errorMessage(error)}`);
    } finally {
      setExportingFormat(null);
    }
  }, [exportingFormat, notify, saveCurrent]);

  const toggleTodoState = () => {
    updateDraft(nextTodoState(current));
  };

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
    setCurrent((note) => note.id === noteID ? { ...note, tags: nextTags } : note);
    setTagSaving(true);
    try {
      await api.setNoteTags(noteID, nextTags);
      await Promise.all([refreshTaxonomy(), refreshNotes()]);
    } catch (error) {
      setCurrent((note) => note.id === noteID ? { ...note, tags: previousTags } : note);
      notify(`更新標籤失敗：${errorMessage(error)}`);
    } finally {
      setTagSaving(false);
    }
  }, [notify, refreshNotes, refreshTaxonomy, tagSaving]);

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
      if (currentRef.current.id === moved.id) setCurrent(moved);
      setMoveNoteDialog(null);
      setNoteContextMenu(null);
      await refreshNotes();
      notify('筆記已移至新的筆記本');
    } catch (error) {
      notify(`移動失敗：${errorMessage(error)}`);
    }
  }, [notify, refreshNotes, saveCurrent]);

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
  const activeViewTitle = view.kind === 'trash'
    ? '垃圾桶'
    : view.kind === 'tag'
      ? `#${tags.find((tag) => tag.id === view.id)?.title || ''}`
      : view.kind === 'notebook'
        ? activeNotebook?.title || '筆記本'
        : '全部筆記';

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
      className={`app-shell ${sidebarCollapsed ? 'sidebar-collapsed' : ''} ${noteListCollapsed ? 'note-list-collapsed' : ''} ${isWindowMaximized ? 'is-maximized' : ''}`}
      style={{
        '--sidebar-resize-width': `${leftWidth}px`,
        '--list-resize-width': `${listWidth}px`,
      } as CSSProperties}
    >
      <header className="window-titlebar" onDoubleClick={handleTitlebarDoubleClick}>
        <div className="titlebar-context">
          <span className="titlebar-location">{activeViewTitle}</span>
          <span className="titlebar-count">{notes.length} 篇</span>
        </div>
        <div className="titlebar-search window-control">
          <span aria-hidden="true">⌕</span>
          <select
            className="titlebar-search-scope"
            value={effectiveSearchScope}
            aria-label="搜尋範圍"
            title="選擇搜尋範圍"
            onChange={(event) => setSearchScope(parseSearchScope(event.target.value))}
          >
            <option value="all">全部筆記本</option>
            <option value="current" disabled={!searchNotebookID}>目前目錄</option>
          </select>
          <input
            id="search-input"
            value={search}
            aria-label={effectiveSearchScope === 'current' ? '搜尋目前目錄與子目錄' : '搜尋全部筆記本'}
            placeholder={effectiveSearchScope === 'current' ? '搜尋目前目錄…' : '搜尋全部筆記本…'}
            onChange={(event) => setSearch(event.target.value)}
          />
          {search && (
            <button
              className="icon-button search-clear-button"
              type="button"
              aria-label="清除搜尋"
              title="清除搜尋"
              onClick={() => setSearch('')}
            >
              <UiIcon name="close" />
            </button>
          )}
        </div>
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
            onClick={() => setModal({ kind: 'settings' })}
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
                  className={`icon-button nav-item ${view.kind === 'all' ? 'active' : ''}`}
                  type="button"
                  title="全部筆記"
                  aria-label="全部筆記"
                  onClick={() => setView({ kind: 'all' })}
                >
                  <UiIcon name="all-notes" />
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
              className={`icon-button rail-action ${view.kind === 'all' ? 'active' : ''}`}
              title="全部筆記"
              aria-label="全部筆記"
              onClick={() => setView({ kind: 'all' })}
            >
              <UiIcon name="all-notes" />
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
                  <div ref={newNotebookMenuRef} className="new-notebook-picker">
                    <button
                      className={`icon-button sidebar-tab-action ${newNotebookMenuOpen ? 'active' : ''}`}
                      type="button"
                      title="新增或開啟筆記本"
                      aria-label="新增或開啟筆記本"
                      aria-haspopup="menu"
                      aria-expanded={newNotebookMenuOpen}
                      onClick={() => setNewNotebookMenuOpen((value) => !value)}
                    >
                      <UiIcon name="plus" />
                    </button>
                    {newNotebookMenuOpen && (
                      <div className="new-notebook-menu" role="menu" aria-label="新增或開啟筆記本">
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
                      </div>
                    )}
                  </div>
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

      {!sidebarCollapsed && (
        <div className="resizer resizer-left" onPointerDown={(event) => beginResize('left', event)} />
      )}

      {!noteListCollapsed && (
        <section className="note-list-panel">
            <header className="note-list-header">
              <div className="note-list-sort">
                <select
                  className="note-sort-select"
                  value={noteSortBy}
                  aria-label="筆記排序方式"
                  onChange={(event) => setNoteSortBy(parseNoteSortBy(event.target.value))}
                >
                  <option value="title">字母</option>
                  <option value="created">新增日期</option>
                  <option value="updated">修改日期</option>
                </select>
                <button
                  className="note-sort-direction"
                  type="button"
                  aria-label={noteSortDirection === 'asc' ? '目前正序，切換為倒序' : '目前倒序，切換為正序'}
                  onClick={() => setNoteSortDirection((value) => value === 'asc' ? 'desc' : 'asc')}
                >
                  {noteSortDirection === 'asc' ? '正序 ↑' : '倒序 ↓'}
                </button>
              </div>
              <div className="note-list-actions">
                <button
                  className={`icon-button toggle-note-summary-button ${showNoteSummary ? 'active' : ''}`}
                  type="button"
                  aria-label={showNoteSummary ? '隱藏筆記摘要' : '顯示筆記摘要'}
                  aria-pressed={showNoteSummary}
                  title={showNoteSummary ? '隱藏筆記摘要' : '顯示筆記摘要'}
                  onClick={() => setShowNoteSummary((value) => !value)}
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
            <div className={`note-list ${showNoteSummary ? '' : 'is-compact'}`} aria-label="筆記清單">
              {notes.length === 0 && (
                <div className="empty-list">
                  <div>§</div>
                  <p>{search ? '找不到符合的筆記' : '這裡還沒有筆記'}</p>
                  {!search && <button onClick={() => void createNote()}>建立第一篇筆記</button>}
                </div>
              )}
              {notes.map((note) => (
                <div
                  key={note.id}
                  className={`note-card ${current.id === note.id ? 'active' : ''} ${draggingNoteID === note.id ? 'is-dragging' : ''}`}
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
                    setNoteContextMenu({ note, x: event.clientX, y: event.clientY });
                  }}
                >
                  <button
                    className="note-card-main"
                    type="button"
                    onClick={() => void selectNote(note.id)}
                  >
                    <div className="note-card-top">
                      <span className="note-card-title">{note.title || '未命名筆記'}</span>
                      {showNoteSummary && <time>{formatDate(note.updatedAt)}</time>}
                    </div>
                    {showNoteSummary && <p>{note.snippet || '空白筆記'}</p>}
                    {showNoteSummary && (
                      <div className="note-card-meta">
                        <span>{note.notebookTitle}</span>
                        {note.isTodo && <span className="todo-pill">{note.todoCompleted ? '✓ 完成' : '○ 待辦'}</span>}
                        {note.attachmentCount > 0 && <span>⌘ {note.attachmentCount}</span>}
                        {note.tags.slice(0, 2).map((tag) => <span className="mini-tag" key={tag}>#{tag}</span>)}
                      </div>
                    )}
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
                  <span className={`save-state ${saveState}`}>({saveStateLabel[saveState]})</span>
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
                          <small>可選文字與書籤</small>
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => void exportCurrentNote('html')}
                        >
                          <span>HTML</span>
                          <small>單一自包含檔案</small>
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
                  <button
                    className="editor-action-button trash-action-button"
                    type="button"
                    onClick={() => void trashCurrent()}
                    disabled={current.deletedAt > 0}
                  >
                    移至垃圾桶
                  </button>
                </div>
              </div>
            </div>

            <div className="editor-main">
              <VditorEditor
                ref={editorRef}
                key={current.id}
                noteID={current.id}
                value={current.body}
                uploadToken={bootstrap.uploadToken}
                storageKind={current.storageKind}
                resources={current.resources}
                theme={theme}
                onChange={(body) => updateDraft({ body })}
                onBlur={() => void saveCurrent()}
              />
            </div>

            <footer className="editor-footer">
              <NoteTags
                key={current.id}
                tags={current.tags}
                disabled={tagSaving}
                onChange={(nextTags) => void updateTags(nextTags)}
              />
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
              <span className="word-count">
                {current.body.length.toLocaleString('zh-TW')} 字元 · {formatDate(current.updatedAt)}
              </span>
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
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  const notebook = notebookContextMenu.notebook;
                  setNotebookContextMenu(null);
                  void exportNotebook('docx', notebook.id);
                }}
              >
                <UiIcon name="all-notes" /> 匯出 DOCX…
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
                  void exportNotebook('jex', notebook.id);
                }}
              >
                <UiIcon name="panel-close" /> 匯出 JEX…
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
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  const notebook = notebookContextMenu.notebook;
                  setNotebookContextMenu(null);
                  void exportNotebook('docx', notebook.id);
                }}
              >
                <UiIcon name="all-notes" /> 匯出 DOCX…
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
            left: Math.max(8, Math.min(noteContextMenu.x, window.innerWidth - 224)),
            top: Math.max(8, Math.min(noteContextMenu.y, window.innerHeight - 100)),
          }}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <div className="context-menu-title">{noteContextMenu.note.title || '未命名筆記'}</div>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setMoveNoteDialog(noteContextMenu.note);
              setNotebookPickerSearch('');
              setNoteContextMenu(null);
            }}
          >
            <span>↪</span> 移至筆記本…
          </button>
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
          <div className="modal-card" onMouseDown={(event) => event.stopPropagation()}>
            <header>
              <div><span className="eyebrow">PuffJoplin</span><h2>設定與資料</h2></div>
              <button
                className="icon-button"
                type="button"
                aria-label="關閉設定"
                onClick={() => setModal(null)}
              >
                <UiIcon name="close" />
              </button>
            </header>
            <section className="settings-appearance" aria-labelledby="appearance-heading">
              <div className="settings-section-heading">
                <div>
                  <strong id="appearance-heading">字體外觀</strong>
                  <span>調整整體介面與筆記預覽的字級和字型。</span>
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
                    <input
                      type="number"
                      min={12}
                      max={20}
                      step={1}
                      value={baseFontSize}
                      aria-label="主要字體大小（像素）"
                      onChange={(event) => setBaseFontSize(normalizeBaseFontSize(event.target.value))}
                    />
                    <span>px</span>
                  </div>
                </label>
                <label className="appearance-field">
                  <span>字型</span>
                  <select
                    value={customFontSelected ? '__custom' : fontFamily}
                    onChange={(event) => {
                      if (event.target.value === '__custom') {
                        setCustomFontSelected(true);
                        return;
                      }
                      setCustomFontSelected(false);
                      setFontFamily(event.target.value);
                    }}
                  >
                    {FONT_PRESETS.map((preset) => (
                      <option key={preset.value} value={preset.value}>{preset.label}</option>
                    ))}
                    <option value="__custom">自訂字型…</option>
                  </select>
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
            <div className="settings-grid">
              <button onClick={() => void importProfile()}>
                <strong>從 Joplin profile 匯入</strong>
                <span>安全複製既有筆記、標籤與附件，不修改來源。</span>
              </button>
              <button onClick={() => void importFile()}>
                <strong>匯入 JEX / ENEX / Markdown</strong>
                <span>從封存檔或單一 Markdown 檔案加入筆記。</span>
              </button>
              <button onClick={() => void api.openDataFolder()}>
                <strong>開啟資料資料夾</strong>
                <span>{bootstrap.dataDir}</span>
              </button>
              <button onClick={() => void exportNotebook('md')}>
                <strong>匯出目前筆記本為 Markdown</strong>
                <span>保留純文字格式，便於備份或移轉。</span>
              </button>
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
