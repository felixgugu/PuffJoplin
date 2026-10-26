// @vitest-environment happy-dom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import SourceLinePreview from './SourceLinePreview';
import type { SourcePreviewTarget } from './sourceLineTarget';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let container: HTMLDivElement | null = null;

const imageSource = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lK3Q6wAAAABJRU5ErkJggg==';

function imageItem(id: string, lineNumber: number): SourcePreviewTarget {
  return {
    id,
    kind: 'image',
    lineNumber,
    endLine: lineNumber,
    from: lineNumber * 10,
    to: lineNumber * 10 + 8,
    src: imageSource,
    alt: `Image ${lineNumber}`,
  };
}

function renderPreview(
  target: SourcePreviewTarget,
  items: SourcePreviewTarget[],
) {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  const onSelect = vi.fn();
  const onLocate = vi.fn();
  const onDeleteRequest = vi.fn().mockResolvedValue(true);
  act(() => {
    root?.render(
      <SourceLinePreview
        target={target}
        items={items}
        anchor={{ left: 40, right: 90, top: 60, bottom: 82 }}
        onSelect={onSelect}
        onClose={vi.fn()}
        onLocate={onLocate}
        onDeleteRequest={onDeleteRequest}
      />,
    );
  });
  return { onDeleteRequest, onLocate, onSelect };
}

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  container?.remove();
  container = null;
});

describe('SourceLinePreview gallery', () => {
  it('renders resize handles, thumbnails, and navigation', () => {
    const items = [imageItem('one', 1), imageItem('two', 4)];
    const { onSelect } = renderPreview(items[0], items);

    expect(document.querySelectorAll('.source-line-preview-resize')).toHaveLength(8);
    expect(document.querySelectorAll('.source-line-preview-thumbnail')).toHaveLength(2);
    const next = document.querySelector<HTMLButtonElement>('button[aria-label="下一張"]');
    act(() => next?.click());
    expect(onSelect).toHaveBeenCalledWith(items[1]);
  });

  it('wires locate and confirmed deletion actions', async () => {
    const items = [imageItem('one', 1), imageItem('two', 4)];
    const { onDeleteRequest, onLocate } = renderPreview(items[0], items);
    const locate = document.querySelector<HTMLButtonElement>('button[aria-label="定位到內文"]');
    const remove = document.querySelector<HTMLButtonElement>('button[aria-label="從內文刪除"]');

    act(() => locate?.click());
    expect(onLocate).toHaveBeenCalledWith(items[0]);

    await act(async () => {
      remove?.click();
      await Promise.resolve();
    });
    expect(onDeleteRequest).toHaveBeenCalledWith(items[0]);
  });
});
