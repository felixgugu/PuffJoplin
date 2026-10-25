import { describe, expect, it } from 'vitest';
import { markdown } from '@codemirror/lang-markdown';
import { foldable } from '@codemirror/language';
import { EditorState } from '@codemirror/state';
import { markdownHeadingText } from './codeMirrorSource';

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
});
