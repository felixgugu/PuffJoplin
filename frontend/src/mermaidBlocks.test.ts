import { describe, expect, it } from 'vitest';
import { extractMermaidBlocks } from './mermaidBlocks';

describe('Mermaid block detection', () => {
  it('extracts backtick and tilde Mermaid fences', () => {
    const markdown = [
      '# Diagram',
      '',
      '```mermaid',
      'flowchart TD',
      '  A --> B',
      '```',
      '',
      '~~~mermaid title="second"',
      'sequenceDiagram',
      '  A->>B: Hello',
      '~~~~',
    ].join('\n');

    expect(extractMermaidBlocks(markdown)).toEqual([
      {
        code: 'flowchart TD\n  A --> B',
        startLine: 2,
        endLine: 5,
      },
      {
        code: 'sequenceDiagram\n  A->>B: Hello',
        startLine: 7,
        endLine: 10,
      },
    ]);
  });

  it('ignores code fences for other languages and unclosed Mermaid blocks', () => {
    const markdown = [
      '```ts',
      'const diagram = true;',
      '```',
      '',
      '```text',
      '```mermaid',
      '```',
      '```',
      '',
      '```mermaid',
      'flowchart LR',
    ].join('\n');

    expect(extractMermaidBlocks(markdown)).toEqual([]);
  });

  it('does not close a Mermaid fence with a shorter fence', () => {
    const markdown = [
      '````mermaid',
      'flowchart TD',
      '```',
      '  A --> B',
      '````',
    ].join('\n');

    expect(extractMermaidBlocks(markdown)[0]?.code).toBe('flowchart TD\n```\n  A --> B');
  });
});
