import { describe, expect, it } from 'vitest';
import { toEditorMarkdown, toStoredMarkdown } from './resourceUrls';

const id = '0123456789abcdef0123456789abcdef';

describe('resource URL conversion', () => {
  it('converts Joplin resource links in both directions', () => {
    const stored = `![photo](:/${id}) and [file](:/${id})`;
    const editor = `![photo](/resources/${id}) and [file](/resources/${id})`;

    expect(toEditorMarkdown(stored)).toBe(editor);
    expect(toStoredMarkdown(editor)).toBe(stored);
  });

  it('does not rewrite remote URLs that happen to contain /resources/', () => {
    const markdown = `![remote](https://example.com/resources/${id})`;

    expect(toEditorMarkdown(markdown)).toBe(markdown);
    expect(toStoredMarkdown(markdown)).toBe(markdown);
  });

  it('only converts complete 32-character resource IDs', () => {
    const markdown = `[short](/resources/abc) [long](:/${id}ff)`;

    expect(toEditorMarkdown(markdown)).toBe(markdown);
    expect(toStoredMarkdown(markdown)).toBe(markdown);
  });
});
