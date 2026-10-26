// @vitest-environment happy-dom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ConfirmDialog from './ConfirmDialog';

let root: Root | null = null;
let container: HTMLDivElement | null = null;

function renderDialog(onConfirm: () => void, onCancel: () => void) {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  act(() => {
    root?.render(
      <ConfirmDialog
        title="永久刪除"
        message="此操作無法復原。"
        confirmLabel="永久刪除"
        tone="danger"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );
  });
  const dialog = document.body.querySelector<HTMLElement>('[role="alertdialog"]');
  if (!dialog) throw new Error('confirm dialog was not rendered');
  return dialog;
}

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  container?.remove();
  container = null;
});

describe('ConfirmDialog', () => {
  it('focuses the safe cancel action and confirms explicitly', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    const dialog = renderDialog(onConfirm, onCancel);

    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(document.activeElement?.textContent).toBe('取消');

    const confirmButton = Array.from(dialog.querySelectorAll('button'))
      .find((button) => button.textContent === '永久刪除');
    expect(confirmButton?.classList.contains('confirm-dialog-danger')).toBe(true);
    expect(confirmButton?.classList.contains('primary')).toBe(true);

    act(() => confirmButton?.click());
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('cancels with Escape without confirming', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    const dialog = renderDialog(onConfirm, onCancel);

    act(() => {
      dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('cancels when the backdrop is pressed', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    const dialog = renderDialog(onConfirm, onCancel);
    const backdrop = dialog.parentElement;

    act(() => {
      backdrop?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    });

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
