import type { Notebook } from './types';

export function notebookPath(notebooks: Notebook[], notebookID: string): string {
  if (!notebookID) return '';
  const byID = new Map(notebooks.map((notebook) => [notebook.id, notebook]));
  const titles: string[] = [];
  const visited = new Set<string>();
  let cursor = notebookID;
  while (cursor && !visited.has(cursor)) {
    visited.add(cursor);
    const notebook = byID.get(cursor);
    if (!notebook) break;
    titles.push(notebook.title);
    cursor = notebook.parentId;
  }
  return titles.reverse().join(' / ');
}

export function notebookAncestorIDs(notebooks: Notebook[], notebookID: string): string[] {
  const byID = new Map(notebooks.map((notebook) => [notebook.id, notebook]));
  const result: string[] = [];
  const visited = new Set<string>();
  let cursor = notebookID;
  while (cursor && !visited.has(cursor)) {
    visited.add(cursor);
    result.push(cursor);
    cursor = byID.get(cursor)?.parentId || '';
  }
  return result;
}
