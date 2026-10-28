// @vitest-environment happy-dom

import { markdown } from '@codemirror/lang-markdown';
import { EditorState } from '@codemirror/state';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  SourceOutline,
  activeSourceHeading,
  flattenSourceHeadings,
  markdownSourceHeadings,
  sourceOutlineHasRoom,
  type SourceHeading,
} from './sourceOutline';

let outline: SourceOutline | null = null;

afterEach(() => {
  outline?.destroy();
  outline = null;
  document.body.replaceChildren();
});

describe('source Markdown headings', () => {
  it('only allows the outline when the editor has enough width', () => {
    expect(sourceOutlineHasRoom(759)).toBe(false);
    expect(sourceOutlineHasRoom(760)).toBe(true);
  });

  it('includes headings beyond the initial viewport parse of a long note', () => {
    const lines: string[] = [];
    for (let index = 0; index < 100; index++) {
      lines.push(`## Heading ${index}`, '', 'Paragraph '.repeat(40), '');
    }
    const state = EditorState.create({
      doc: lines.join('\n'),
      extensions: [markdown()],
    });
    const headings = markdownSourceHeadings(state);

    expect(headings).toHaveLength(100);
    expect(headings.at(-1)?.label).toBe('Heading 99');
  });

  it('builds a heading tree across ATX, Setext, blockquotes, and inline markup', () => {
    const doc = [
      '# Root',
      '',
      '## Child **bold** [link](https://example.com) and \\*literal\\*',
      '',
      '> ### Quoted',
      '',
      'Setext',
      '---',
      '',
      '```md',
      '# Not a heading',
      '```',
      '',
      '    # Indented code',
      '',
      '####### Not a heading',
    ].join('\n');
    const state = EditorState.create({ doc, extensions: [markdown()] });
    const roots = markdownSourceHeadings(state);

    expect(roots).toHaveLength(1);
    expect(roots[0]).toMatchObject({ level: 1, label: 'Root' });
    expect(roots[0].children).toHaveLength(2);
    expect(roots[0].children[0]).toMatchObject({
      level: 2,
      label: 'Child bold link and *literal*',
    });
    expect(roots[0].children[0].children[0]).toMatchObject({
      level: 3,
      label: 'Quoted',
    });
    expect(roots[0].children[1]).toMatchObject({
      level: 2,
      label: 'Setext',
    });
  });

  it('attaches skipped levels to the nearest shallower heading', () => {
    const state = EditorState.create({
      doc: '# A\n\n### C\n\n##### E\n\n## B',
      extensions: [markdown()],
    });
    const roots = markdownSourceHeadings(state);

    expect(roots.map((heading) => heading.label)).toEqual(['A']);
    expect(roots[0].children.map((heading) => heading.label)).toEqual(['C', 'B']);
    expect(roots[0].children[0].children.map((heading) => heading.label)).toEqual(['E']);
  });

  it('finds the active heading from the current source position', () => {
    const state = EditorState.create({
      doc: '# Root\n\nText\n\n## Child\n\nText',
      extensions: [markdown()],
    });
    const headings = markdownSourceHeadings(state);
    const child = flattenSourceHeadings(headings)[1];

    expect(activeSourceHeading(headings, 2)?.label).toBe('Root');
    expect(activeSourceHeading(headings, child.from + 2)?.label).toBe('Child');
  });
});

describe('source outline panel', () => {
  it('renders hierarchy, collapses children, tracks the active heading, and jumps', () => {
    const parent = document.createElement('div');
    document.body.append(parent);
    const child: SourceHeading = {
      id: 'child',
      level: 2,
      from: 20,
      to: 28,
      lineNumber: 3,
      label: 'Child',
      children: [],
    };
    const root: SourceHeading = {
      id: 'root',
      level: 1,
      from: 0,
      to: 7,
      lineNumber: 1,
      label: 'Root',
      children: [child],
    };
    const onJump = vi.fn();
    const onRequestClose = vi.fn();
    outline = new SourceOutline({ parent, onJump, onRequestClose });
    outline.setState([root], child);
    outline.setAvailable(true);
    outline.setOpen(true);

    const panel = parent.querySelector<HTMLElement>('.source-outline-panel');
    const items = parent.querySelectorAll<HTMLButtonElement>('.source-outline-item');
    const childList = parent.querySelector<HTMLUListElement>(
      '.source-outline-list .source-outline-list',
    );
    expect(panel?.hidden).toBe(false);
    expect(items).toHaveLength(2);
    expect(items[1].getAttribute('aria-current')).toBe('location');

    items[1].click();
    expect(onJump).toHaveBeenCalledWith(child);

    parent.querySelector<HTMLButtonElement>('.source-outline-fold')?.click();
    expect(childList?.hidden).toBe(true);

    parent.querySelector<HTMLButtonElement>('.source-outline-close')?.click();
    expect(onRequestClose).toHaveBeenCalledOnce();
  });

  it('shows an empty state when the note has no headings', () => {
    const parent = document.createElement('div');
    document.body.append(parent);
    outline = new SourceOutline({
      parent,
      onJump: vi.fn(),
      onRequestClose: vi.fn(),
    });
    outline.setState([], null);
    outline.setAvailable(true);
    outline.setOpen(true);

    expect(parent.querySelector('.source-outline-empty')?.textContent)
      .toBe('此筆記沒有標題');
  });
});
