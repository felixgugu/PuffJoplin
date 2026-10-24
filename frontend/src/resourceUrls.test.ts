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

  it('maps managed directory images to resource URLs without changing disk paths', () => {
    const resources = [{
      id,
      storageKind: 'directory' as const,
      storagePath: 'images/photo 1.png',
    }];
    const stored = `![photo](images/photo 1.png) ![encoded](images/photo%201.png) ![relative](./images/photo%201.png)`;
    const editor = `![photo](/resources/${id}) ![encoded](/resources/${id}) ![relative](/resources/${id})`;

    expect(toEditorMarkdown(stored, resources)).toBe(editor);
    expect(toStoredMarkdown(editor, resources, 'directory')).toBe(
      `![photo](images/photo%201.png) ![encoded](images/photo%201.png) ![relative](images/photo%201.png)`,
    );
  });

  it('keeps newly uploaded managed resource URLs until the backend persists them', () => {
    const markdown = `![pasted](/resources/${id})`;
    expect(toStoredMarkdown(markdown, [], 'directory')).toBe(markdown);
  });
});
