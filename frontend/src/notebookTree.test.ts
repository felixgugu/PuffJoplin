import { describe, expect, it } from 'vitest';
import { buildNotebookRows, parseCollapsedNotebookIds } from './notebookTree';
import type { Notebook } from './types';

const notebook = (id: string, parentId = ''): Notebook => ({
  id,
  parentId,
  title: id,
  icon: '',
  sortOrder: 0,
  storageKind: 'database',
  storageRoot: '',
  storagePath: '',
  createdAt: 0,
  updatedAt: 0,
});

describe('notebook tree collapse', () => {
  const notebooks = [
    notebook('work'),
    notebook('client', 'work'),
    notebook('details', 'client'),
    notebook('personal'),
  ];

  it('hides descendants when a parent is collapsed', () => {
    const rows = buildNotebookRows(notebooks, new Set(['work']));
    expect(rows.map((row) => row.notebook.id)).toEqual(['work', 'personal']);
    expect(rows[0].hasChildren).toBe(true);
  });

  it('shows nested descendants when expanded', () => {
    const rows = buildNotebookRows(notebooks, new Set());
    expect(rows.map((row) => `${row.depth}:${row.notebook.id}`)).toEqual([
      '0:work',
      '1:client',
      '2:details',
      '0:personal',
    ]);
  });

  it('ignores malformed persisted state', () => {
    expect([...parseCollapsedNotebookIds('{bad')]).toEqual([]);
    expect([...parseCollapsedNotebookIds('["work",3,null,"client"]')]).toEqual(['work', 'client']);
  });
});
