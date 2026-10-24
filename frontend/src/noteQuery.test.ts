import { describe, expect, it } from 'vitest';
import { buildNoteListQuery } from './noteQuery';

describe('note list queries', () => {
  it('keeps the normal view when search is empty', () => {
    expect(buildNoteListQuery({
      view: { kind: 'tag', id: 'tag-1' },
      search: '  ',
      searchScope: 'all',
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
      searchNotebookID: 'notebook-1',
      sortBy: 'title',
      sortDirection: 'asc',
    })).toMatchObject({ view: 'all', tagId: '', notebookId: '', search: 'query' });
  });

  it('searches the current notebook subtree', () => {
    expect(buildNoteListQuery({
      view: { kind: 'all' },
      search: 'query',
      searchScope: 'current',
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
      searchNotebookID: 'notebook-2',
      sortBy: 'updated',
      sortDirection: 'desc',
    })).toMatchObject({ view: 'trash', notebookId: 'notebook-2' });
  });

  it('falls back to all notebooks when no current directory exists', () => {
    expect(buildNoteListQuery({
      view: { kind: 'all' },
      search: 'query',
      searchScope: 'current',
      searchNotebookID: '',
      sortBy: 'updated',
      sortDirection: 'desc',
    })).toMatchObject({ view: 'all', notebookId: '' });
  });
});
