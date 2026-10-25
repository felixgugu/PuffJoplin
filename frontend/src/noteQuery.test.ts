import { describe, expect, it } from 'vitest';
import { buildNoteListQuery } from './noteQuery';

describe('note list queries', () => {
  it('keeps the normal view when search is empty', () => {
    expect(buildNoteListQuery({
      view: { kind: 'tag', id: 'tag-1' },
      search: '  ',
      searchScope: 'all',
      searchField: 'all',
      searchCaseSensitive: false,
      searchWholeWord: false,
      searchNotebookID: 'notebook-1',
      sortBy: 'updated',
      sortDirection: 'desc',
    })).toMatchObject({ view: 'tag', tagId: 'tag-1', notebookId: '' });
  });

  it('searches all active notebooks regardless of the selected view', () => {
    expect(buildNoteListQuery({
      view: { kind: 'tag', id: 'tag-1' },
      search: 'query',
      searchScope: 'all',
      searchField: 'title',
      searchCaseSensitive: true,
      searchWholeWord: true,
      searchNotebookID: 'notebook-1',
      sortBy: 'title',
      sortDirection: 'asc',
    })).toMatchObject({
      view: 'all',
      tagId: '',
      notebookId: '',
      search: 'query',
      searchField: 'title',
      searchCaseSensitive: true,
      searchWholeWord: true,
    });
  });

  it('searches the current notebook subtree', () => {
    expect(buildNoteListQuery({
      view: { kind: 'all' },
      search: 'query',
      searchScope: 'current',
      searchField: 'all',
      searchCaseSensitive: false,
      searchWholeWord: false,
      searchNotebookID: 'notebook-2',
      sortBy: 'created',
      sortDirection: 'desc',
    })).toMatchObject({ view: 'notebook', notebookId: 'notebook-2' });
  });

  it('keeps trash mode while searching', () => {
    expect(buildNoteListQuery({
      view: { kind: 'trash' },
      search: 'query',
      searchScope: 'current',
      searchField: 'all',
      searchCaseSensitive: false,
      searchWholeWord: false,
      searchNotebookID: 'notebook-2',
      sortBy: 'updated',
      sortDirection: 'desc',
    })).toMatchObject({ view: 'trash', notebookId: 'notebook-2' });
  });

  it('keeps todo filtering and todo status while searching', () => {
    expect(buildNoteListQuery({
      view: { kind: 'todo' },
      todoStatus: 'completed',
      search: 'query',
      searchScope: 'current',
      searchField: 'all',
      searchCaseSensitive: false,
      searchWholeWord: false,
      searchNotebookID: 'notebook-2',
      sortBy: 'due',
      sortDirection: 'asc',
    })).toMatchObject({
      view: 'todo',
      todoStatus: 'completed',
      notebookId: 'notebook-2',
      sortBy: 'due',
    });
  });

  it('falls back to all notebooks when no current directory exists', () => {
    expect(buildNoteListQuery({
      view: { kind: 'all' },
      search: 'query',
      searchScope: 'current',
      searchField: 'all',
      searchCaseSensitive: false,
      searchWholeWord: false,
      searchNotebookID: '',
      sortBy: 'updated',
      sortDirection: 'desc',
    })).toMatchObject({ view: 'all', notebookId: '' });
  });
});
