// @vitest-environment happy-dom

import { describe, expect, it } from 'vitest';
import type Vditor from 'vditor';
import { syncEditorModeButtons, syncSourceWordWrapButton } from './VditorEditor';

function toolbarEditor(mode: 'sv' | 'ir' | 'wysiwyg') {
  const foldButton = document.createElement('button');
  const unfoldButton = document.createElement('button');
  const formatTableButton = document.createElement('button');
  const galleryButton = document.createElement('button');
  const wrapButton = document.createElement('button');
  const editor = {
    getCurrentMode: () => mode,
    vditor: {
      toolbar: {
        elements: {
          'fold-all': foldButton,
          'unfold-all': unfoldButton,
          'format-table': formatTableButton,
          gallery: galleryButton,
          'source-word-wrap': wrapButton,
        },
      },
    },
  } as unknown as Vditor;
  return { editor, foldButton, formatTableButton, galleryButton, unfoldButton, wrapButton };
}

describe('source-only toolbar controls', () => {
  it('enables fold controls in source mode', () => {
    const {
      editor,
      foldButton,
      formatTableButton,
      galleryButton,
      unfoldButton,
      wrapButton,
    } = toolbarEditor('sv');
    syncEditorModeButtons(editor);

    expect(foldButton.disabled).toBe(false);
    expect(unfoldButton.disabled).toBe(false);
    expect(foldButton.getAttribute('aria-disabled')).toBe('false');
    expect(unfoldButton.getAttribute('aria-disabled')).toBe('false');
    expect(formatTableButton.disabled).toBe(false);
    expect(formatTableButton.getAttribute('aria-disabled')).toBe('false');
    expect(wrapButton.disabled).toBe(false);
    expect(wrapButton.getAttribute('aria-disabled')).toBe('false');
    expect(galleryButton.disabled).toBe(false);
    expect(galleryButton.getAttribute('aria-disabled')).toBeNull();
  });

  it.each(['ir', 'wysiwyg'] as const)('disables fold controls in %s mode', (mode) => {
    const {
      editor,
      foldButton,
      formatTableButton,
      galleryButton,
      unfoldButton,
      wrapButton,
    } = toolbarEditor(mode);
    syncEditorModeButtons(editor);

    expect(foldButton.disabled).toBe(true);
    expect(unfoldButton.disabled).toBe(true);
    expect(foldButton.getAttribute('aria-disabled')).toBe('true');
    expect(unfoldButton.getAttribute('aria-disabled')).toBe('true');
    expect(formatTableButton.disabled).toBe(true);
    expect(formatTableButton.getAttribute('aria-disabled')).toBe('true');
    expect(wrapButton.disabled).toBe(true);
    expect(wrapButton.getAttribute('aria-disabled')).toBe('true');
    expect(galleryButton.disabled).toBe(false);
    expect(galleryButton.getAttribute('aria-disabled')).toBeNull();
  });

  it('reflects the word wrap preference on the toolbar button', () => {
    const { editor, wrapButton } = toolbarEditor('sv');

    syncSourceWordWrapButton(editor, true);
    expect(wrapButton.getAttribute('aria-pressed')).toBe('true');
    expect(wrapButton.classList.contains('vditor-menu--current')).toBe(true);

    syncSourceWordWrapButton(editor, false);
    expect(wrapButton.getAttribute('aria-pressed')).toBe('false');
    expect(wrapButton.classList.contains('vditor-menu--current')).toBe(false);
  });
});
