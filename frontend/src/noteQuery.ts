import type {
  NoteQuery,
  NoteSortBy,
  NoteSortDirection,
  SearchField,
  SearchScope,
  View,
} from './types';

interface NoteQueryOptions {
  view: View;
  search: string;
  searchScope: SearchScope;
  searchField: SearchField;
  searchCaseSensitive: boolean;
  searchWholeWord: boolean;
  searchNotebookID: string;
  sortBy: NoteSortBy;
  sortDirection: NoteSortDirection;
  todoStatus?: 'open' | 'completed' | 'all';
  limit?: number;
  offset?: number;
}

export function buildNoteListQuery(options: NoteQueryOptions): NoteQuery {
  const searching = options.search.trim() !== '';
  let queryView: NoteQuery['view'] = options.view.kind === 'dashboard'
    ? 'all'
    : options.view.kind;
  let notebookId = options.view.kind === 'notebook' ? options.view.id : '';
  let tagId = options.view.kind === 'tag' ? options.view.id : '';

  if (searching) {
    if (options.view.kind === 'todo') {
      queryView = 'todo';
      notebookId = options.searchScope === 'current' ? options.searchNotebookID : '';
      tagId = '';
    } else
    if (options.searchScope === 'current' && options.searchNotebookID) {
      queryView = options.view.kind === 'trash' ? 'trash' : 'notebook';
      notebookId = options.searchNotebookID;
      tagId = '';
    } else {
      queryView = options.view.kind === 'trash' ? 'trash' : 'all';
      notebookId = '';
      tagId = '';
    }
  }

  return {
    view: queryView,
    notebookId,
    tagId,
    todoStatus: options.view.kind === 'todo' ? options.todoStatus || 'open' : undefined,
    search: options.search,
    searchField: options.searchField,
    searchCaseSensitive: options.searchCaseSensitive,
    searchWholeWord: options.searchWholeWord,
    sortBy: options.sortBy,
    sortDirection: options.sortDirection,
    limit: options.limit ?? 300,
    offset: options.offset ?? 0,
  };
}
