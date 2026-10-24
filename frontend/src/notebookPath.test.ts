import { describe, expect, it } from 'vitest';
import { notebookAncestorIDs, notebookPath } from './notebookPath';
import type { Notebook } from './types';

const notebook = (id: string, parentId: string, title: string): Notebook => ({
  id,
  parentId,
  title,
  icon: '',
  sortOrder: 0,
  createdAt: 0,
  updatedAt: 0,
});

describe('notebook paths', () => {
  const notebooks = [
    notebook('root', '', 'Root'),
    notebook('child', 'root', 'Child'),
    notebook('grandchild', 'child', 'Grandchild'),
  ];

  it('builds the complete parent path', () => {
    expect(notebookPath(notebooks, 'grandchild')).toBe('Root / Child / Grandchild');
    expect(notebookAncestorIDs(notebooks, 'grandchild')).toEqual(['grandchild', 'child', 'root']);
  });

  it('handles missing and cyclic notebook data', () => {
    expect(notebookPath(notebooks, 'missing')).toBe('');
    expect(notebookPath([
      notebook('a', 'b', 'A'),
      notebook('b', 'a', 'B'),
    ], 'a')).toBe('B / A');
  });
});
