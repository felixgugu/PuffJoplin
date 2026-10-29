// @vitest-environment happy-dom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import MermaidConfigDialog from './MermaidConfigDialog';
import { defaultMermaidConfigDraft } from './mermaidConfig';

let root: Root | null = null;
let container: HTMLDivElement | null = null;

function renderDialog(
  onCopy: ReturnType<typeof vi.fn<(text: string) => Promise<void>>> = vi.fn(async () => undefined),
  onClose = vi.fn(),
) {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  act(() => {
    root?.render(
      <MermaidConfigDialog
        initial={{ draft: defaultMermaidConfigDraft(), format: 'directive' }}
        onCopy={onCopy}
        onClose={onClose}
      />,
    );
  });
  const dialog = document.body.querySelector<HTMLElement>('.mermaid-config-dialog');
  if (!dialog) throw new Error('mermaid config dialog was not rendered');
  return { dialog, onCopy, onClose };
}

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  container?.remove();
  container = null;
  window.localStorage.clear();
});

describe('MermaidConfigDialog', () => {
  it('copies the generated directive and closes', async () => {
    const { dialog, onCopy, onClose } = renderDialog();
    const copyButton = Array.from(dialog.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('複製'));
    expect(copyButton).toBeTruthy();

    await act(async () => {
      copyButton?.click();
    });

    expect(onCopy).toHaveBeenCalledTimes(1);
    const text = onCopy.mock.calls[0][0];
    expect(text.startsWith('%%{init: {')).toBe(true);
    expect(text.endsWith('}}%%\n')).toBe(true);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('switches the preview between directive, frontmatter, and JSON', () => {
    const { dialog } = renderDialog();
    const output = () => dialog.querySelector('.mermaid-config-output')?.textContent ?? '';

    expect(output().startsWith('%%{init: {')).toBe(true);

    const frontmatter = Array.from(dialog.querySelectorAll('button'))
      .find((button) => button.textContent === 'Frontmatter');
    act(() => frontmatter?.click());
    expect(output().startsWith('---\nconfig:')).toBe(true);

    const json = Array.from(dialog.querySelectorAll('button'))
      .find((button) => button.textContent === 'JSON');
    act(() => json?.click());
    expect(() => JSON.parse(output())).not.toThrow();
  });

  it('closes with Escape and keeps an error when copying fails', async () => {
    const failing = vi.fn<(text: string) => Promise<void>>(async () => {
      throw new Error('剪貼簿不可用');
    });
    const { dialog, onClose } = renderDialog(failing);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(onClose).toHaveBeenCalledTimes(1);

    const copyButton = Array.from(dialog.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('複製'));
    await act(async () => {
      copyButton?.click();
    });
    expect(dialog.textContent).toContain('剪貼簿不可用');
    expect(dialog.querySelector('[role="alert"]')).toBeTruthy();
  });
});
