export interface BootstrapState {
  status: string;
  appVersion: string;
  dataDir: string;
  uploadToken: string;
  noteCount: number;
  notebookCount: number;
  joplinProfile: string;
  canImportJoplin: boolean;
  onboardingStatus: string;
  onboardingRequired: boolean;
  message: string;
}

export interface JoplinProfilePreview {
  available: boolean;
  profilePath: string;
  displayName: string;
  notes: number;
  notebooks: number;
  resources: number;
  encryptedNotes: number;
  error: string;
}

export interface Notebook {
  id: string;
  parentId: string;
  title: string;
  icon: string;
  sortOrder: number;
  storageKind: 'database' | 'directory';
  storageRoot: string;
  storagePath: string;
  createdAt: number;
  updatedAt: number;
}

export interface Tag {
  id: string;
  title: string;
  count: number;
}

export interface NoteSummary {
  id: string;
  notebookId: string;
  notebookTitle: string;
  title: string;
  snippet: string;
  isTodo: boolean;
  todoDue: number;
  todoCompleted: number;
  isConflict: boolean;
  isPinned: boolean;
  createdAt: number;
  updatedAt: number;
  deletedAt: number;
  tags: string[];
  attachmentCount: number;
  storageKind: 'database' | 'directory';
}

export interface Resource {
  id: string;
  noteId: string;
  title: string;
  mime: string;
  filename: string;
  fileSize: number;
  url: string;
  storageKind: 'database' | 'directory';
  externalPath: string;
  storagePath: string;
  createdAt: number;
  updatedAt: number;
}

export interface ResourceCleanupReport {
  removedCount: number;
  removedIndexed: number;
  removedOrphans: number;
  freedBytes: number;
  failedCount: number;
  skippedRecent: number;
}

export interface Note {
  id: string;
  notebookId: string;
  storageKind: 'database' | 'directory';
  externalPath: string;
  externalMTime: number;
  externalSize: number;
  title: string;
  body: string;
  isTodo: boolean;
  todoDue: number;
  todoCompleted: number;
  sourceUrl: string;
  author: string;
  isConflict: boolean;
  isPinned: boolean;
  createdAt: number;
  updatedAt: number;
  deletedAt: number;
  tags: string[];
  resources: Resource[];
  additionalInfo: NoteInfoField[];
}

export interface NoteInfoField {
  key: string;
  label: string;
  value: string;
}

export interface NoteInput {
  id: string;
  notebookId: string;
  title: string;
  body: string;
  isTodo: boolean;
  todoDue: number;
  todoCompleted: number;
  sourceUrl: string;
  author: string;
}

export type NoteExportFormat = 'pdf' | 'html' | 'markdown' | 'docx';

export interface NoteExportRequest {
  noteId: string;
  format: NoteExportFormat;
  html?: string;
}

export interface NoteQuery {
  view: 'all' | 'notebook' | 'tag' | 'todo' | 'trash';
  notebookId?: string;
  notebookDirectOnly?: boolean;
  tagId?: string;
  todoStatus?: TodoStatus;
  search?: string;
  searchField?: SearchField;
  searchCaseSensitive?: boolean;
  searchWholeWord?: boolean;
  sortBy?: NoteSortBy;
  sortDirection?: NoteSortDirection;
  openedSince?: number;
  limit?: number;
  offset?: number;
}

export type NoteSortBy = 'title' | 'created' | 'updated' | 'due';
export type NoteSortDirection = 'asc' | 'desc';
export type SearchScope = 'all' | 'current';
export type SearchField = 'all' | 'title';
export type TodoStatus = 'open' | 'completed' | 'all';

export interface NotePage {
  items: NoteSummary[];
  total: number;
}

export interface ImportWarning {
  item: string;
  message: string;
}

export interface ImportReport {
  source: string;
  kind: string;
  notebooks: number;
  notes: number;
  tags: number;
  resources: number;
  skipped: number;
  warnings: ImportWarning[];
  encryptedSkipped: string[];
  destinationFolder: string;
}

export interface ManagedDirectoryReport {
  notebookId: string;
  rootPath: string;
  notebooks: number;
  notes: number;
  resources: number;
  skipped: number;
  warnings: ImportWarning[];
}

export interface ManagedDirectoryExclusions {
  folderNames: string[];
  markdownFileNames: string[];
}

export interface ManagedDirectoryExclusionReport {
  exclusions: ManagedDirectoryExclusions;
  rootCount: number;
  hiddenNotebooks: number;
  hiddenNotes: number;
  restoredNotebooks: number;
  restoredNotes: number;
  hiddenNoteIds: string[];
  warnings: ImportWarning[];
}

export interface NotebookDocxExport {
  path: string;
  defaultFilename: string;
  markdown: string;
}

export interface NoteDocxExport {
  path: string;
  defaultFilename: string;
  markdown: string;
}

export interface DashboardCounts {
  activeNotes: number;
  trashNotes: number;
  notebooks: number;
  tags: number;
  openTodos: number;
  completedTodos: number;
}

export interface DashboardTodo {
  id: string;
  title: string;
  notebookTitle: string;
  todoDue: number;
}

export interface DashboardRecentNote {
  id: string;
  title: string;
  notebookTitle: string;
  updatedAt: number;
}

export interface DashboardActivityDay {
  date: string;
  created: number;
  updated: number;
}

export interface DashboardNotebookStat {
  id: string;
  title: string;
  noteCount: number;
  openTodoCount: number;
  storageKind: 'database' | 'directory';
}

export interface DashboardMedia {
  imageReferences: number;
  mermaidDiagrams: number;
  attachmentCount: number;
  attachmentBytes: number;
  unusedResourceCount: number;
  unusedResourceBytes: number;
  missingResourceCount: number;
}

export interface DashboardManagedRoot {
  notebookId: string;
  title: string;
  path: string;
  available: boolean;
}

export interface DashboardHealth {
  dataDir: string;
  managedRoots: DashboardManagedRoot[];
}

export interface DashboardSnapshot {
  counts: DashboardCounts;
  todos: DashboardTodo[];
  recent: DashboardRecentNote[];
  activity: DashboardActivityDay[];
  notebooks: DashboardNotebookStat[];
  tags: Tag[];
  media: DashboardMedia;
  health: DashboardHealth;
  generatedAt: number;
}

export type View =
  | { kind: 'dashboard' }
  | { kind: 'all' }
  | { kind: 'todo' }
  | { kind: 'trash' }
  | { kind: 'notebook'; id: string }
  | { kind: 'tag'; id: string };
