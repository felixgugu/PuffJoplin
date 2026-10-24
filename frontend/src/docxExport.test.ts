import { describe, expect, it } from 'vitest';
import { convertNotebookMarkdownToDocx } from './docxExport';

const onePixelPng =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lK3Q6wAAAABJRU5ErkJggg==';

describe('DOCX notebook export', () => {
  it('creates a Word document from notebook Markdown and embedded images', async () => {
    const base64 = await convertNotebookMarkdownToDocx(
      `# Notebook

## Note

Text with **bold** and a [link](https://example.com).

- first
- second

| A | B |
|---|---|
| 1 | 2 |

![cover](${onePixelPng})

[attachment](data:text/plain;base64,YXR0YWNobWVudA==)
`,
      'Notebook',
    );
    const binary = atob(base64);
    expect(binary.length).toBeGreaterThan(1000);
    expect([...binary.slice(0, 4)].map((value) => value.charCodeAt(0))).toEqual([
      0x50, 0x4b, 0x03, 0x04,
    ]);
    expect(binary).toContain('word/document.xml');
    expect(binary).toContain('word/media/');
  }, 30_000);
});
