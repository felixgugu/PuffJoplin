// @vitest-environment happy-dom

import { describe, expect, it } from 'vitest';
import type Vditor from 'vditor';
import { syncEditorModeButtons } from './VditorEditor';

function toolbarEditor(mode: 'sv' | 'ir' | 'wysiwyg') {
  const foldButton = document.createElement('button');
  const unfoldButton = document.createElement('button');
  const formatTableButton = document.createElement('button');
  const galleryButton = document.createElement('button');
  const editor = {
    getCurrentMode: () => mode,
    vditor: {
      toolbar: {
        elements: {
          'fold-all': foldButton,
          'unfold-all': unfoldButton,
          'format-table': formatTableButton,
          gallery: galleryButton,
        },
      },
    },
  } as unknown as Vditor;
  return { editor, foldButton, formatTableButton, galleryButton, unfoldButton };
}

describe('source-only toolbar controls', () => {
  it('enables fold controls in source mode', () => {
    const {
      editor,
      foldButton,
      formatTableButton,
      galleryButton,
      unfoldButton,
    } = toolbarEditor('sv');
    syncEditorModeButtons(editor);

    expect(foldButton.disabled).toBe(false);
    expect(unfoldButton.disabled).toBe(false);
    expect(foldButton.getAttribute('aria-disabled')).toBe('false');
    expect(unfoldButton.getAttribute('aria-disabled')).toBe('false');
    expect(formatTableButton.disabled).toBe(false);
    expect(formatTableButton.getAttribute('aria-disabled')).toBe('false');
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
    } = toolbarEditor(mode);
    syncEditorModeButtons(editor);

    expect(foldButton.disabled).toBe(true);
    expect(unfoldButton.disabled).toBe(true);
    expect(foldButton.getAttribute('aria-disabled')).toBe('true');
    expect(unfoldButton.getAttribute('aria-disabled')).toBe('true');
    expect(formatTableButton.disabled).toBe(true);
    expect(formatTableButton.getAttribute('aria-disabled')).toBe('true');
    expect(galleryButton.disabled).toBe(false);
    expect(galleryButton.getAttribute('aria-disabled')).toBeNull();
  });
});
