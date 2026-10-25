import type {
  BootstrapState,
  ImportReport,
  JoplinProfilePreview,
  ManagedDirectoryReport,
  NoteDocxExport,
  NotebookDocxExport,
  Note,
  NoteExportRequest,
  NoteInput,
  NotePage,
  NoteQuery,
  NoteSummary,
  Notebook,
  Resource,
  Tag,
} from './types';

type Backend = Record<string, (...args: unknown[]) => Promise<unknown>>;
type WailsWindowRuntime = {
  WindowMinimise: () => void;
  WindowToggleMaximise: () => void;
  WindowIsMaximised: () => Promise<boolean>;
  Quit: () => void;
};

function backend(): Backend {
  const value = (window as unknown as {
    go?: { main?: { App?: Backend } };
  }).go?.main?.App;
  if (!value) {
    throw new Error('Wails Go backend 尚未載入，請使用 wails dev 啟動。');
  }
  return value;
}

function windowRuntime(): WailsWindowRuntime | undefined {
  return (window as unknown as { runtime?: WailsWindowRuntime }).runtime;
}

async function invoke<T>(method: string, ...args: unknown[]): Promise<T> {
  const fn = backend()[method];
  if (typeof fn !== 'function') {
    throw new Error(`Go API 不存在：${method}`);
  }
  try {
    return await fn(...args) as T;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`${method}: ${message}`, { cause: error });
  }
}

export const api = {
  bootstrap: () => invoke<BootstrapState>('Bootstrap'),
  inspectJoplinProfile: () => invoke<JoplinProfilePreview>('InspectJoplinProfile'),
  dismissJoplinImportPrompt: () => invoke<void>('DismissJoplinImportPrompt'),
  setWindowTheme: (theme: 'light' | 'dark') => invoke<void>('SetWindowTheme', theme),
  reportFrontendError: (message: string, stack = '', source = 'frontend') =>
    invoke<void>('ReportFrontendError', message, stack, source),
  minimizeWindow: () => windowRuntime()?.WindowMinimise(),
  toggleMaximizeWindow: async () => {
    const runtime = windowRuntime();
    if (!runtime) return false;
    runtime.WindowToggleMaximise();
    await new Promise((resolve) => window.setTimeout(resolve, 80));
    return await runtime.WindowIsMaximised();
  },
  isWindowMaximized: async () => {
    const runtime = windowRuntime();
    if (!runtime) return false;
    return await runtime.WindowIsMaximised();
  },
  closeWindow: () => windowRuntime()?.Quit(),
  listNotebooks: () => invoke<Notebook[]>('ListNotebooks'),
  openManagedMarkdownNotebook: () => invoke<ManagedDirectoryReport>('OpenManagedMarkdownNotebook'),
  refreshManagedNotebook: (notebookId: string) =>
    invoke<ManagedDirectoryReport>('RefreshManagedNotebook', notebookId),
  revealNotebook: (notebookId: string) => invoke<void>('RevealNotebook', notebookId),
  createNotebook: (title: string, parentId = '') => invoke<Notebook>('CreateNotebook', title, parentId),
  renameNotebook: (id: string, title: string) => invoke<Notebook>('RenameNotebook', id, title),
  deleteNotebook: (id: string, deleteChildren: boolean) => invoke<void>('DeleteNotebook', id, deleteChildren),
  listNotes: (query: NoteQuery) => invoke<NotePage>('ListNotes', query),
  searchNotes: (search: string, limit = 100) => invoke<NoteSummary[]>('SearchNotes', search, limit),
  getNote: (id: string) => invoke<Note>('GetNote', id),
  createNote: (notebookId: string, title = '', body = '') => invoke<Note>('CreateNote', notebookId, title, body),
  updateNote: (input: NoteInput) => invoke<Note>('UpdateNote', input),
  moveNote: (id: string, notebookId: string) => invoke<Note>('MoveNote', id, notebookId),
  setNotePinned: (id: string, pinned: boolean) => invoke<void>('SetNotePinned', id, pinned),
  trashNote: (id: string) => invoke<void>('TrashNote', id),
  restoreNote: (id: string) => invoke<void>('RestoreNote', id),
  deleteNotePermanently: (id: string) => invoke<void>('DeleteNotePermanently', id),
  listTags: () => invoke<Tag[]>('ListTags'),
  setNoteTags: (noteId: string, tags: string[]) => invoke<void>('SetNoteTags', noteId, tags),
  settings: () => invoke<Record<string, string>>('Settings'),
  setSetting: (key: string, value: string) => invoke<void>('SetSetting', key, value),
  selectJoplinProfile: () => invoke<string>('SelectJoplinProfile'),
  importJoplinProfile: (sourcePath = '') => invoke<ImportReport>('ImportJoplinProfile', sourcePath),
  importArchive: (sourcePath = '') => invoke<ImportReport>('ImportArchive', sourcePath),
  importArchiveToNotebook: (notebookID: string, sourcePath = '') =>
    invoke<ImportReport>('ImportArchiveToNotebook', notebookID, sourcePath),
  exportNotebook: (notebookId: string, format: 'jex' | 'md') => invoke<string>('ExportNotebook', notebookId, format),
  prepareNotebookDocx: (notebookId: string) =>
    invoke<NotebookDocxExport>('PrepareNotebookDocxExport', notebookId),
  prepareNoteDocx: (noteId: string) =>
    invoke<NoteDocxExport>('PrepareNoteDocxExport', noteId),
  saveDocxExport: (path: string, dataBase64: string) =>
    invoke<void>('SaveDocxExport', path, dataBase64),
  exportNote: (request: NoteExportRequest) => invoke<string>('ExportNote', request),
  exportMermaidImages: (noteId: string, format: 'svg' | 'png', images: string[]) =>
    invoke<string>('ExportMermaidImages', noteId, format, images),
  attachResource: (noteId: string) => invoke<Note>('AttachResource', noteId),
  pasteClipboardImage: (noteId: string) => invoke<Resource>('PasteClipboardImage', noteId),
  copyClipboardImage: (filename: string, dataBase64: string) =>
    invoke<void>('CopyClipboardImage', filename, dataBase64),
  copyClipboardFile: (filename: string, dataBase64: string) =>
    invoke<void>('CopyClipboardFile', filename, dataBase64),
  copyResourceFileToClipboard: (resourceId: string) =>
    invoke<void>('CopyResourceFileToClipboard', resourceId),
  copyNoteFilePath: (noteId: string) => invoke<void>('CopyNoteFilePath', noteId),
  revealNoteFile: (noteId: string) => invoke<void>('RevealNoteFile', noteId),
  openResource: (id: string) => invoke<void>('OpenResource', id),
  revealResource: (id: string) => invoke<void>('RevealResource', id),
  saveResourceAs: (id: string) => invoke<string>('SaveResourceAs', id),
  openExternal: (url: string) => invoke<void>('OpenExternal', url),
  openDataFolder: () => invoke<void>('OpenDataFolder'),
  confirm: (title: string, message: string) => invoke<boolean>('Confirm', title, message),
};

type EventCallback = (data: unknown) => void;

export function onEvent(name: string, callback: EventCallback): () => void {
  const runtime = (window as unknown as {
    runtime?: {
      EventsOn: (eventName: string, callback: EventCallback) => void;
      EventsOff: (eventName: string) => void;
    };
  }).runtime;
  if (!runtime) return () => undefined;
  runtime.EventsOn(name, callback);
  return () => runtime.EventsOff(name);
}
