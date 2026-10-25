import { describe, expect, it } from 'vitest';
import { highlightMarkdownSource } from './sourceHighlight';

describe('source Markdown highlighting', () => {
  it('returns empty markup for an empty source', () => {
    expect(highlightMarkdownSource('')).toBe('');
  });

  it('highlights Markdown structure and links', () => {
    const result = highlightMarkdownSource([
      '# Heading',
      '',
      '- item',
      '',
      '**strong** and [link](https://example.com)',
    ].join('\n'));

    expect(result).toContain('hljs-section');
    expect(result).toContain('hljs-bullet');
    expect(result).toContain('hljs-strong');
    expect(result).toContain('hljs-link');
  });

  it('marks fenced code without interpreting unsafe HTML', () => {
    const result = highlightMarkdownSource([
      '```html',
      '<script>alert("x")</script>',
      '```',
    ].join('\n'));

    expect(result).toContain('hljs-code');
    expect(result).not.toContain('<script>');
    expect(result).toContain('&lt;script&gt;');
  });
});
