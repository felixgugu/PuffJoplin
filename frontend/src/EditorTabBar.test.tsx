// @vitest-environment happy-dom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import EditorTabBar from './EditorTabBar';
import type { EditorTabsState } from './editorTabs';

const tabs: EditorTabsState = {
  pinned: [
    { id: 'first', title: '第一篇' },
    { id: 'second', title: '第二篇' },
  ],
  preview: null,
  activeID: 'first',
};

const directories = { first: '工作', second: '專案' };

let root: Root | null = null;
let container: HTMLDivElement | null = null;

function renderTabs(
  onIntent: (id: string) => void,
  onActivate: (id: string) => void = () => undefined,
) {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  act(() => {
    root?.render(
      <EditorTabBar
        tabs={tabs}
        directories={directories}
        onActivate={onActivate}
        onTogglePin={() => undefined}
        onIntent={onIntent}
      />,
    );
  });
}

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  container?.remove();
  container = null;
});

describe('EditorTabBar', () => {
  it('warms up a tab as soon as the pointer or focus reaches it', () => {
    const onIntent = vi.fn();
    renderTabs(onIntent);
    const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
    expect(buttons).toHaveLength(2);

    act(() => {
      buttons[1]?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    });
    expect(onIntent).toHaveBeenLastCalledWith('second');
    expect(onIntent).toHaveBeenCalledTimes(1);

    act(() => {
      buttons[1]?.focus();
    });
    expect(onIntent).toHaveBeenCalledTimes(2);
    expect(onIntent).toHaveBeenLastCalledWith('second');
  });

  it('lists open notes with their last directory for quick switching', () => {
    const onActivate = vi.fn();
    renderTabs(vi.fn(), onActivate);

    const trigger = document.querySelector<HTMLButtonElement>('.editor-tabs-menu');
    expect(trigger).not.toBeNull();
    expect(trigger?.getAttribute('aria-expanded')).toBe('false');

    act(() => {
      trigger?.click();
    });
    expect(trigger?.getAttribute('aria-expanded')).toBe('true');

    const menuItems = Array.from(
      document.querySelectorAll<HTMLButtonElement>(
        '[role="menu"][aria-label="切換已開啟的筆記"] [role="menuitem"]',
      ),
    );
    expect(menuItems.map((item) => item.textContent)).toEqual([
      '工作 / 第一篇',
      '專案 / 第二篇',
    ]);
    expect(menuItems[0]?.getAttribute('aria-current')).toBe('true');

    act(() => {
      menuItems[1]?.click();
    });
    expect(onActivate).toHaveBeenCalledWith('second');
    expect(document.querySelector('[role="menu"][aria-label="切換已開啟的筆記"]')).toBeNull();
  });
});
