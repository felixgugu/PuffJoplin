// @vitest-environment happy-dom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import NoteTags, { type TagNotesResult } from './NoteTags';
import type { NoteSummary } from './types';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let container: HTMLDivElement | null = null;

const TAGS = ['工作', '旅遊'];

const note = (id: string, title: string): NoteSummary => ({
  id,
  notebookId: 'notebook-1',
  notebookTitle: '專案筆記',
  title,
  snippet: '',
  isTodo: false,
  todoDue: 0,
  todoCompleted: 0,
  isConflict: false,
  isPinned: false,
  createdAt: 0,
  updatedAt: 0,
  deletedAt: 0,
  tags: ['工作'],
  attachmentCount: 0,
  storageKind: 'database',
});

const NOTES: TagNotesResult = {
  items: [note('note-1', '第一篇筆記'), note('note-2', '第二篇筆記')],
  total: 2,
};

interface HarnessProps {
  onChange: (tags: string[]) => void;
  onLoadTagNotes: (tag: string) => Promise<TagNotesResult>;
  onOpenNote: (noteId: string) => void;
}

function Harness({ onChange, onLoadTagNotes, onOpenNote }: HarnessProps) {
  return (
    <NoteTags
      tags={TAGS}
      onChange={onChange}
      onLoadTagNotes={onLoadTagNotes}
      onOpenNote={onOpenNote}
    />
  );
}

function renderTags() {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  const onChange = vi.fn();
  const onLoadTagNotes = vi.fn(async () => NOTES);
  const onOpenNote = vi.fn();
  act(() => {
    root?.render(
      <Harness
        onChange={onChange}
        onLoadTagNotes={onLoadTagNotes}
        onOpenNote={onOpenNote}
      />,
    );
  });
  return { onChange, onLoadTagNotes, onOpenNote };
}

function capsule(label: string): HTMLButtonElement {
  const match = Array.from(
    container?.querySelectorAll<HTMLButtonElement>('button.tag-capsule') ?? [],
  ).find((element) => element.textContent === label);
  if (!match) throw new Error(`missing capsule ${label}`);
  return match;
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
  });
}

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  container?.remove();
  container = null;
});

describe('NoteTags', () => {
  it('does not make the whole tag row clickable', () => {
    renderTags();
    const bar = container?.querySelector('.tag-capsule-bar');
    expect(bar?.tagName).toBe('DIV');
    expect(container?.querySelectorAll('button.tag-capsule').length).toBe(2);
  });

  it('opens the selected tag and lists its notes', async () => {
    const { onLoadTagNotes } = renderTags();
    act(() => capsule('#工作').click());
    expect(container?.querySelector('.tag-editor-popover')).not.toBeNull();
    expect(onLoadTagNotes).toHaveBeenCalledWith('工作');
    expect(container?.querySelector('.tag-editor-item.is-selected')?.textContent).toContain('#工作');

    await flush();
    expect(container?.textContent).toContain('第一篇筆記');
    expect(container?.querySelectorAll('.tag-editor-note').length).toBe(2);
  });

  it('opens a note from the tag note list', async () => {
    const { onOpenNote } = renderTags();
    act(() => capsule('#工作').click());
    await flush();
    const noteButton = container?.querySelector<HTMLButtonElement>('.tag-editor-note');
    act(() => noteButton?.click());
    expect(onOpenNote).toHaveBeenCalledWith('note-1');
    expect(container?.querySelector('.tag-editor-popover')).toBeNull();
  });

  it('keeps focus in the input after adding a tag', () => {
    const { onChange } = renderTags();
    act(() => capsule('#工作').click());
    const input = container?.querySelector<HTMLInputElement>('.tag-editor-new input');
    if (!input) throw new Error('missing tag input');
    act(() => input.focus());

    const valueSetter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value',
    )?.set;
    act(() => {
      valueSetter?.call(input, '新標籤');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    act(() => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });

    const nextTags = onChange.mock.calls[0]?.[0] as string[] | undefined;
    expect(nextTags).toContain('新標籤');
    expect(nextTags?.length).toBe(3);
    expect(document.activeElement).toBe(input);
  });

  it('removes a tag without selecting it', async () => {
    const { onChange, onLoadTagNotes } = renderTags();
    act(() => capsule('#工作').click());
    await flush();
    onLoadTagNotes.mockClear();
    const removeButtons = container?.querySelectorAll<HTMLButtonElement>('.tag-editor-remove');
    act(() => removeButtons?.[1]?.click());
    expect(onChange).toHaveBeenCalledWith(['工作']);
    expect(onLoadTagNotes).not.toHaveBeenCalled();
  });
});
