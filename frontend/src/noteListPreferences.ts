import type { NoteSortBy, NoteSortDirection, SearchScope } from './types';

export const NOTE_LIST_COLLAPSED_KEY = 'puffjoplin.noteList.collapsed';
export const NOTE_LIST_SUMMARY_KEY = 'puffjoplin.noteList.showSummary';
export const NOTE_SORT_BY_KEY = 'puffjoplin.noteList.sortBy';
export const NOTE_SORT_DIRECTION_KEY = 'puffjoplin.noteList.sortDirection';
export const SEARCH_SCOPE_KEY = 'puffjoplin.search.scope';

export const DEFAULT_NOTE_SORT_BY: NoteSortBy = 'updated';
export const DEFAULT_NOTE_SORT_DIRECTION: NoteSortDirection = 'desc';

export function parseNoteSortBy(value: string | null): NoteSortBy {
  return value === 'title' || value === 'created' || value === 'updated'
    ? value
    : DEFAULT_NOTE_SORT_BY;
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

export function parseSearchScope(value: string | null): SearchScope {
  return value === 'current' ? 'current' : 'all';
}
