import { describe, expect, it } from 'vitest';
import { findSourceLinePreview } from './sourceLineTarget';

const resourceID = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

describe('source line preview detection', () => {
  it('finds the first supported local image on a line', () => {
    const markdown = [
      '# Note',
      `![](https://example.com/remote.png) ![Local](/resources/${resourceID})`,
    ].join('\n');
    expect(findSourceLinePreview(markdown, 2)).toEqual({
      kind: 'image',
      lineNumber: 2,
      src: `/resources/${resourceID}`,
      alt: 'Local',
    });
  });

  it('converts stored resource IDs and accepts image data URLs', () => {
    expect(findSourceLinePreview(`![Stored](:/${resourceID})`, 1)).toEqual({
      kind: 'image',
      lineNumber: 1,
      src: `/resources/${resourceID}`,
      alt: 'Stored',
    });
    expect(findSourceLinePreview('![Data](data:image/png;base64,AAAA)', 1)).toEqual({
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
    expect(findSourceLinePreview(markdown, 2)).toEqual({
      kind: 'mermaid',
      lineNumber: 2,
      code: 'flowchart TD\n  A --> B',
    });
    expect(findSourceLinePreview(markdown, 3)).toBeNull();
    expect(findSourceLinePreview(markdown, 5)).toBeNull();
  });
});
