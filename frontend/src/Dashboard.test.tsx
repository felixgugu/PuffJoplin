// @vitest-environment happy-dom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Dashboard from './Dashboard';
import type { DashboardSnapshot } from './types';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let container: HTMLDivElement | null = null;

function snapshot(): DashboardSnapshot {
  const due = Date.now() + 86_400_000;
  return {
    counts: {
      activeNotes: 5,
      trashNotes: 1,
      notebooks: 2,
      tags: 1,
      openTodos: 1,
      completedTodos: 2,
    },
    todos: [{
      id: 'todo-note',
      title: 'Finish dashboard',
      notebookTitle: 'Project',
      todoDue: due,
    }],
    recent: [{
      id: 'recent-note',
      title: 'Recent note',
      notebookTitle: 'Project',
      updatedAt: Date.now(),
    }],
    activity: Array.from({ length: 28 }, (_, index) => ({
      date: `2026-10-${String(index + 1).padStart(2, '0')}`,
      created: index % 3,
      updated: index % 4,
    })),
    notebooks: [{
      id: 'notebook',
      title: 'Project',
      noteCount: 5,
      openTodoCount: 1,
      storageKind: 'database',
    }],
    tags: [{ id: 'tag', title: 'work', count: 4 }],
    media: {
      imageReferences: 3,
      mermaidDiagrams: 2,
      attachmentCount: 4,
      attachmentBytes: 4096,
      unusedResourceCount: 1,
      unusedResourceBytes: 1024,
      missingResourceCount: 0,
    },
    health: {
      dataDir: 'G:\\PuffJoplin\\data',
      managedRoots: [{
        notebookId: 'managed',
        title: 'Vault',
        path: 'G:\\Vault',
        available: true,
      }],
    },
    generatedAt: Date.now(),
  };
}

function renderDashboard(value = snapshot()) {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  const callbacks = {
    onRefresh: vi.fn(),
    onOpenNote: vi.fn(),
    onOpenView: vi.fn(),
    onCompleteTodo: vi.fn(),
    onCleanupResources: vi.fn(),
    onOpenDataFolder: vi.fn(),
  };
  act(() => {
    root?.render(
      <Dashboard
        snapshot={value}
        loading={false}
        error=""
        cleaningResources={false}
        {...callbacks}
      />,
    );
  });
  return callbacks;
}

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  container?.remove();
  container = null;
});

describe('Dashboard', () => {
  it('summarizes notes, media, tags, and data health', () => {
    renderDashboard();

    expect(document.body.textContent).not.toContain('今天先處理最重要的事');
    const cards = Array.from(document.querySelectorAll('.dashboard-grid > article'));
    expect(cards[0]?.classList.contains('dashboard-recent')).toBe(true);
    expect(cards[1]?.classList.contains('dashboard-focus')).toBe(true);
    expect(cards[2]?.classList.contains('dashboard-activity')).toBe(true);
    expect(document.querySelector('.dashboard-stat-card strong')?.textContent).toBe('5');
    expect(document.body.textContent).toContain('3圖片引用');
    expect(document.body.textContent).toContain('2Mermaid');
    expect(document.body.textContent).toContain('1 KB');
    expect(document.body.textContent).toContain('可存取');
    expect(document.querySelectorAll('.dashboard-activity-column')).toHaveLength(28);
  });

  it('opens recent notes and completes focused todos', () => {
    const value = snapshot();
    const callbacks = renderDashboard(value);
    const recent = Array.from(document.querySelectorAll<HTMLButtonElement>('.dashboard-list button'))
      .find((button) => button.textContent?.includes('Recent note'));
    const complete = document.querySelector<HTMLButtonElement>(
      'button[aria-label="完成 Finish dashboard"]',
    );

    act(() => recent?.click());
    act(() => complete?.click());

    expect(callbacks.onOpenNote).toHaveBeenCalledWith('recent-note');
    expect(callbacks.onCompleteTodo).toHaveBeenCalledWith('todo-note', value.todos[0].todoDue);
  });
});
