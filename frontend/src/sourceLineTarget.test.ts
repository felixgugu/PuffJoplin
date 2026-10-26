import { describe, expect, it } from 'vitest';
import {
  findSourceLinePreview,
  findSourcePreviewItems,
  sourcePreviewDeletion,
} from './sourceLineTarget';

const resourceID = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

describe('source line preview detection', () => {
  it('finds the first supported local image on a line', () => {
    const markdown = [
      '# Note',
      `![](https://example.com/remote.png) ![Local](/resources/${resourceID})`,
    ].join('\n');
    expect(findSourceLinePreview(markdown, 2)).toMatchObject({
      kind: 'image',
      lineNumber: 2,
      src: `/resources/${resourceID}`,
      alt: 'Local',
    });
  });

  it('converts stored resource IDs and accepts image data URLs', () => {
    expect(findSourceLinePreview(`![Stored](:/${resourceID})`, 1)).toMatchObject({
      kind: 'image',
      lineNumber: 1,
      src: `/resources/${resourceID}`,
      alt: 'Stored',
    });
    expect(findSourceLinePreview('![Data](data:image/png;base64,AAAA)', 1)).toMatchObject({
      kind: 'image',
      lineNumber: 1,
      src: 'data:image/png;base64,AAAA',
      alt: 'Data',
    });
  });

  it('does not preview remote-only images or images inside fenced code', () => {
    expect(findSourceLinePreview('![Remote](https://example.com/a.png)', 1)).toBeNull();
    const markdown = [
      '```text',
      `![Code](/resources/${resourceID})`,
      '```',
    ].join('\n');
    expect(findSourceLinePreview(markdown, 2)).toBeNull();
  });

  it('previews Mermaid only on the opening fence line', () => {
    const markdown = [
      '# Diagram',
      '```mermaid',
      'flowchart TD',
      '  A --> B',
      '```',
    ].join('\n');
    expect(findSourceLinePreview(markdown, 2)).toMatchObject({
      kind: 'mermaid',
      lineNumber: 2,
      code: 'flowchart TD\n  A --> B',
    });
    expect(findSourceLinePreview(markdown, 3)).toBeNull();
    expect(findSourceLinePreview(markdown, 5)).toBeNull();
  });

  it('collects images and Mermaid in document order', () => {
    const markdown = [
      `![First](/resources/${resourceID})`,
      '',
      '```mermaid',
      'flowchart LR',
      '  A --> B',
      '```',
      '',
      `Text ![Second](:/${resourceID})`,
    ].join('\n');
    const items = findSourcePreviewItems(markdown);

    expect(items.map((item) => [item.kind, item.lineNumber, item.endLine])).toEqual([
      ['image', 1, 1],
      ['mermaid', 3, 6],
      ['image', 8, 8],
    ]);
    expect(items.map((item) => markdown.slice(item.from, item.to))).toEqual([
      `![First](/resources/${resourceID})`,
      '```mermaid\nflowchart LR\n  A --> B\n```',
      `![Second](:/${resourceID})`,
    ]);
  });

  it('removes an inline image without touching surrounding text', () => {
    const markdown = `before ![photo](:/${resourceID}) after`;
    const target = findSourcePreviewItems(markdown)[0];
    expect(target).toBeDefined();

    expect(sourcePreviewDeletion(markdown, target!).markdown).toBe('before  after');
  });

  it('removes an image-only line and its newline', () => {
    const markdown = [
      'before',
      `![photo](:/${resourceID})`,
      'after',
    ].join('\n');
    const target = findSourcePreviewItems(markdown)[0];

    expect(sourcePreviewDeletion(markdown, target!).markdown).toBe('before\nafter');
  });

  it('removes a complete Mermaid fence including its trailing newline', () => {
    const markdown = [
      'before',
      '```mermaid',
      'flowchart LR',
      '  A --> B',
      '```',
      'after',
    ].join('\n');
    const target = findSourcePreviewItems(markdown)[0];

    expect(sourcePreviewDeletion(markdown, target!).markdown).toBe('before\nafter');
  });
});
