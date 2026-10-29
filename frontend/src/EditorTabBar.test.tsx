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

let root: Root | null = null;
let container: HTMLDivElement | null = null;

function renderTabs(onIntent: (id: string) => void) {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  act(() => {
    root?.render(
      <EditorTabBar
        tabs={tabs}
        onActivate={() => undefined}
        onTogglePin={() => undefined}
        onClose={() => undefined}
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
});
