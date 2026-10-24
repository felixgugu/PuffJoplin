import type { Notebook } from './types';

export const COLLAPSED_NOTEBOOKS_KEY = 'puffjoplin.collapsedNotebooks';
export const SIDEBAR_COLLAPSED_KEY = 'puffjoplin.sidebarCollapsed';
export const SIDEBAR_WIDTH_KEY = 'puffjoplin.sidebarWidth';
export const NOTE_LIST_WIDTH_KEY = 'puffjoplin.noteListWidth';
export const SIDEBAR_TAB_KEY = 'puffjoplin.sidebarTab';

export interface NotebookRow {
  notebook: Notebook;
  depth: number;
  hasChildren: boolean;
}

export function parseCollapsedNotebookIds(value: string | null): Set<string> {
  if (!value) return new Set();
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((item): item is string => typeof item === 'string'));
  } catch {
    return new Set();
  }
}

export function buildNotebookRows(
  notebooks: Notebook[],
  collapsedNotebookIds: ReadonlySet<string>,
): NotebookRow[] {
  const children = new Map<string, Notebook[]>();
  for (const notebook of notebooks) {
    const list = children.get(notebook.parentId) || [];
    list.push(notebook);
    children.set(notebook.parentId, list);
  }

  const rows: NotebookRow[] = [];
  const visit = (parentId: string, depth: number) => {
    for (const notebook of children.get(parentId) || []) {
      const notebookChildren = children.get(notebook.id) || [];
      const hasChildren = notebookChildren.length > 0;
      rows.push({ notebook, depth, hasChildren });
      if (!collapsedNotebookIds.has(notebook.id)) {
        visit(notebook.id, depth + 1);
      }
    }
  };
  visit('', 0);
  return rows;
}
