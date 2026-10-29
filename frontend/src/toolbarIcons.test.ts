import { describe, expect, it } from 'vitest';
import {
  TOOLBAR_ICON_FILE_BY_NAME,
  toolbarIcon,
  type ToolbarIconName,
} from './toolbarIcons';

const expectedToolbarNames = [
  'emoji',
  'headings',
  'bold',
  'italic',
  'strike',
  'text-color',
  'link',
  'list',
  'ordered-list',
  'check',
  'outdent',
  'indent',
  'quote',
  'line',
  'code',
  'inline-code',
  'insert-before',
  'insert-after',
  'upload',
  'table',
  'format-table',
  'gallery',
  'mermaid-config',
  'source-word-wrap',
  'undo',
  'redo',
  'page-prev',
  'page-next',
  'find-replace',
  'fold-all',
  'unfold-all',
  'wysiwyg-mode',
  'ir-mode',
  'source-mode',
  'both',
  'preview',
  'outline',
  'fullscreen',
];

describe('toolbar icon registry', () => {
  it('maps every visible toolbar action to a Font Awesome SVG', () => {
    expect(Object.keys(TOOLBAR_ICON_FILE_BY_NAME)).toEqual(expectedToolbarNames);
    expect(Object.keys(TOOLBAR_ICON_FILE_BY_NAME)).not.toContain('edit-mode');
    expect(new Set(Object.values(TOOLBAR_ICON_FILE_BY_NAME)).size).toBe(38);

    for (const name of expectedToolbarNames as ToolbarIconName[]) {
      const svg = toolbarIcon(name);
      expect(svg, name).toContain('puff-toolbar-svg');
      expect(svg, name).toContain('aria-hidden="true"');
      expect(svg, name).toContain('currentColor');
    }
  });
});
