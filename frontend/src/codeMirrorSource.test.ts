// @vitest-environment happy-dom

import { markdown } from '@codemirror/lang-markdown';
import { foldable, foldedRanges, unfoldEffect } from '@codemirror/language';
import { EditorState } from '@codemirror/state';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CodeMirrorSource,
  markdownCodeBlockLineStarts,
  markdownHeadingText,
  markdownInlineCodeRanges,
} from './codeMirrorSource';

let source: CodeMirrorSource | null = null;

function createSource(markdown: string, onChange = vi.fn()) {
  const parent = document.createElement('div');
  document.body.append(parent);
  const textarea = document.createElement('textarea');
  parent.append(textarea);
  source = new CodeMirrorSource({
    parent,
    textarea,
    value: markdown,
    showLineNumbers: true,
    onChange,
    onBlur: vi.fn(),
    onScroll: vi.fn(),
  });
  return source;
}

afterEach(() => {
  source?.destroy();
  source = null;
  document.body.replaceChildren();
});

describe('CodeMirror Markdown commands', () => {
  it('turns the selected lines into H1 without duplicating existing heading marks', () => {
    expect(markdownHeadingText('Title\n## Section', 1)).toBe('# Title\n# Section');
  });

  it('supports heading levels within the Markdown range', () => {
    expect(markdownHeadingText('Title', 6)).toBe('###### Title');
    expect(markdownHeadingText('Title', 0)).toBe('# Title');
    expect(markdownHeadingText('Title', 9)).toBe('###### Title');
  });

  it('exposes folding ranges for supported Markdown structures', () => {
    const samples = [
      { name: 'heading section', doc: '# Section\ntext\n\n## Child\ntext' },
      { name: 'list', doc: '- one\n  continued\n- two' },
      { name: 'blockquote', doc: '> quoted\n> more' },
      { name: 'fenced code', doc: '```js\nconst value = 1;\n```' },
      { name: 'table', doc: '| A | B |\n| - | - |\n| 1 | 2 |' },
    ];

    for (const sample of samples) {
      const state = EditorState.create({
        doc: sample.doc,
        extensions: [markdown()],
      });
      const firstLine = state.doc.line(1);
      const range = foldable(state, firstLine.from, firstLine.to);

      expect(range, sample.name).not.toBeNull();
      expect(range?.to, sample.name).toBeGreaterThan(firstLine.to);
    }
  });

  it('finds every line belonging to fenced and indented code blocks', () => {
    const doc = [
      'Paragraph',
      '',
      '```ts',
      'const answer = 42;',
      '```',
      '',
      '    indented code',
    ].join('\n');
    const state = EditorState.create({ doc, extensions: [markdown()] });
    const lineNumbers = markdownCodeBlockLineStarts(state)
      .map((position) => state.doc.lineAt(position).number);

    expect(lineNumbers).toEqual([3, 4, 5, 7]);
  });

  it('finds inline code ranges without including fenced code', () => {
    const doc = [
      'Text with `inline` and ``two `ticks` ``.',
      '',
      '```ts',
      'const fenced = true;',
      '```',
    ].join('\n');
    const state = EditorState.create({ doc, extensions: [markdown()] });
    const values = markdownInlineCodeRanges(state)
      .map((range) => doc.slice(range.from, range.to));

    expect(values).toEqual(['`inline`', '``two `ticks` ``']);
  });
});

describe('CodeMirror source folding', () => {
  it('folds and unfolds the whole document without changing markdown', () => {
    const markdown = [
      '# First',
      '',
      'Intro',
      '',
      '## Details',
      '',
      '- one',
      '- two',
      '',
      '```ts',
      'const answer = 42;',
      '```',
      '',
    ].join('\n');
    const onChange = vi.fn();
    const editor = createSource(markdown, onChange);
    const firstLine = editor.view.state.doc.line(1);
    const childHeadingLine = editor.view.state.doc.line(5);
    const topLevelRange = foldable(editor.view.state, firstLine.from, firstLine.to);
    const childRange = foldable(
      editor.view.state,
      childHeadingLine.from,
      childHeadingLine.to,
    );
    expect(topLevelRange).not.toBeNull();
    expect(childRange).not.toBeNull();

    expect(editor.foldAll()).toBe(true);
    expect(foldedRanges(editor.view.state).size).toBeGreaterThanOrEqual(3);
    const folded: Array<{ from: number; to: number }> = [];
    foldedRanges(editor.view.state).between(
      0,
      editor.view.state.doc.length,
      (from, to) => {
        folded.push({ from, to });
      },
    );
    expect(folded).toEqual(expect.arrayContaining([topLevelRange, childRange]));
    expect(editor.getValue()).toBe(markdown);
    expect(onChange).not.toHaveBeenCalled();

    editor.view.dispatch({ effects: unfoldEffect.of(topLevelRange!) });
    expect(foldedRanges(editor.view.state).size).toBeGreaterThan(0);
    const remaining: Array<{ from: number; to: number }> = [];
    foldedRanges(editor.view.state).between(
      0,
      editor.view.state.doc.length,
      (from, to) => {
        remaining.push({ from, to });
      },
    );
    expect(remaining).not.toContainEqual(topLevelRange);
    expect(remaining).toContainEqual(childRange);

    expect(editor.unfoldAll()).toBe(true);
    expect(foldedRanges(editor.view.state).size).toBe(0);
    expect(editor.getValue()).toBe(markdown);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('returns false when there is nothing to fold or unfold', () => {
    const editor = createSource('');

    expect(editor.foldAll()).toBe(false);
    expect(editor.unfoldAll()).toBe(false);
  });
});

describe('CodeMirror table formatting', () => {
  it('formats the table containing the cursor', () => {
    const table = [
      '| Name | Qty |',
      '|:--- | ---:|',
      '| Apple | 10 |',
      '| 中文 | 2 |',
    ].join('\n');
    const editor = createSource(table);
    const cursor = editor.getValue().indexOf('Apple') + 2;
    editor.view.dispatch({ selection: { anchor: cursor } });

    expect(editor.formatTable()).toBe(true);
    expect(editor.getValue()).toBe([
      '| Name  |  Qty |',
      '| :---- | ---: |',
      '| Apple |   10 |',
      '| 中文  |    2 |',
    ].join('\n'));
  });

  it('returns false when the cursor is not in a table', () => {
    const editor = createSource('# Heading\n\nParagraph');

    expect(editor.formatTable()).toBe(false);
    expect(editor.getValue()).toBe('# Heading\n\nParagraph');
  });

  it('treats an already formatted table as a successful match', () => {
    const table = [
      '| Name  |  Qty |',
      '| :---- | ---: |',
      '| Apple |   10 |',
    ].join('\n');
    const editor = createSource(table);
    editor.view.dispatch({ selection: { anchor: editor.getValue().indexOf('Apple') } });

    expect(editor.formatTable()).toBe(true);
    expect(editor.getValue()).toBe(table);
  });
});

describe('CodeMirror range updates', () => {
  it('can update Markdown without stealing focus from another mode', () => {
    const editor = createSource('Before');
    const outsideButton = document.createElement('button');
    document.body.append(outsideButton);
    outsideButton.focus();

    editor.replaceRange(0, 6, 'After', false);

    expect(editor.getValue()).toBe('After');
    expect(document.activeElement).toBe(outsideButton);
  });
});
