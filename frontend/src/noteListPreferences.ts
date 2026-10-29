import type {
  NoteSortBy,
  NoteSortDirection,
  SearchField,
  SearchScope,
  TodoStatus,
} from './types';

export const NOTE_LIST_COLLAPSED_KEY = 'puffjoplin.noteList.collapsed';
export const NOTE_LIST_SUMMARY_KEY = 'puffjoplin.noteList.showSummary';
export const NOTE_LIST_INCLUDE_SUBNOTEBOOKS_KEY = 'puffjoplin.noteList.includeSubnotebooks';
export const NOTE_LIST_OPENED_FILTER_KEY = 'puffjoplin.noteList.openedFilter';
export const NOTE_TAG_PANEL_OPEN_KEY = 'puffjoplin.noteList.tagPanelOpen';
export const NOTE_TAG_PANEL_RATIO_KEY = 'puffjoplin.noteList.tagPanelRatio';
export const NOTE_SORT_BY_KEY = 'puffjoplin.noteList.sortBy';
export const NOTE_SORT_DIRECTION_KEY = 'puffjoplin.noteList.sortDirection';
export const SEARCH_SCOPE_KEY = 'puffjoplin.search.scope';
export const SEARCH_FIELD_KEY = 'puffjoplin.search.field';
export const SEARCH_CASE_SENSITIVE_KEY = 'puffjoplin.search.caseSensitive';
export const SEARCH_WHOLE_WORD_KEY = 'puffjoplin.search.wholeWord';
export const TODO_SORT_BY_KEY = 'puffjoplin.todo.sortBy';
export const TODO_SORT_DIRECTION_KEY = 'puffjoplin.todo.sortDirection';
export const TODO_STATUS_KEY = 'puffjoplin.todo.status';

export const DEFAULT_NOTE_SORT_BY: NoteSortBy = 'updated';
export const DEFAULT_NOTE_SORT_DIRECTION: NoteSortDirection = 'desc';
export const DEFAULT_TODO_SORT_BY: NoteSortBy = 'due';
export const DEFAULT_TODO_SORT_DIRECTION: NoteSortDirection = 'asc';
export const DEFAULT_TODO_STATUS: TodoStatus = 'open';
export const DEFAULT_SEARCH_FIELD: SearchField = 'all';
export const DEFAULT_NOTE_TAG_PANEL_RATIO = 1 / 3;
export const MIN_NOTE_TAG_PANEL_RATIO = 0.2;
export const MAX_NOTE_TAG_PANEL_RATIO = 0.7;

export function parseNoteSortBy(value: string | null): NoteSortBy {
  return value === 'title' || value === 'created' || value === 'updated' || value === 'due'
    ? value
    : DEFAULT_NOTE_SORT_BY;
}

export function parseTodoStatus(value: string | null): TodoStatus {
  return value === 'completed' || value === 'all' ? value : DEFAULT_TODO_STATUS;
}

export function parseTodoSortBy(value: string | null): NoteSortBy {
  return value === 'title' || value === 'created' || value === 'updated' || value === 'due'
    ? value
    : DEFAULT_TODO_SORT_BY;
}

export function parseNoteSortDirection(value: string | null): NoteSortDirection {
  return value === 'asc' || value === 'desc'
    ? value
    : DEFAULT_NOTE_SORT_DIRECTION;
}

export function shouldExpandNoteList(collapsed: boolean, hasCurrentNote: boolean): boolean {
  return collapsed && !hasCurrentNote;
}

export function parseShowNoteSummary(value: string | null): boolean {
  return value !== 'false';
}

export function parseIncludeSubnotebooks(value: string | null): boolean {
  return value !== 'false';
}

export function parseNoteTagPanelOpen(value: string | null): boolean {
  return value === 'true';
}

export function normalizeNoteTagPanelRatio(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_NOTE_TAG_PANEL_RATIO;
  return Math.max(
    MIN_NOTE_TAG_PANEL_RATIO,
    Math.min(MAX_NOTE_TAG_PANEL_RATIO, value),
  );
}

export function parseNoteTagPanelRatio(value: string | null): number {
  if (value === null || value.trim() === '') return DEFAULT_NOTE_TAG_PANEL_RATIO;
  return normalizeNoteTagPanelRatio(Number(value));
}

export function parseSearchScope(value: string | null): SearchScope {
  return value === 'current' ? 'current' : 'all';
}

export function parseSearchField(value: string | null): SearchField {
  return value === 'title' ? 'title' : DEFAULT_SEARCH_FIELD;
}

export function parseSearchToggle(value: string | null): boolean {
  return value === 'true';
}
