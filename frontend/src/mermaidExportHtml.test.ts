// @vitest-environment happy-dom

import { describe, expect, it, vi } from 'vitest';
import { replaceMermaidCodeBlocksWithImages } from './mermaidExport';

describe('Mermaid HTML export', () => {
  it('replaces Mermaid fences with embedded PNG images', async () => {
    const renderer = vi.fn(async () => ({
      data: new Uint8Array([137, 80, 78, 71]),
      contentType: 'image/png' as const,
      width: 1,
      height: 1,
    }));
    const html = [
      '<p>Before</p>',
      '<pre><code class="language-mermaid">graph TD;',
      'A; B;</code></pre>',
      '<p>After</p>',
    ].join('');
    const exported = await replaceMermaidCodeBlocksWithImages(
      html,
      ['graph TD;A; B;'],
      undefined,
      renderer,
    );
    expect(renderer).toHaveBeenCalledOnce();
    expect(renderer).toHaveBeenCalledWith('graph TD;A; B;', 'png', undefined);
    expect(exported).not.toContain('language-mermaid');
    expect(exported).toContain('class="mermaid-export-image"');
    expect(exported).toContain('src="data:image/png;base64,iVBORw=="');
  });

  it('uses Markdown source when Vditor already rendered the Mermaid container', async () => {
    const renderer = vi.fn(async () => ({
      data: new Uint8Array([137, 80, 78, 71]),
      contentType: 'image/png' as const,
      width: 1,
      height: 1,
    }));
    const html = '<div class="language-mermaid"><svg><text>Rendered label</text></svg></div>';
    const exported = await replaceMermaidCodeBlocksWithImages(
      html,
      ['flowchart LR;A; B;'],
      undefined,
      renderer,
    );
    expect(renderer).toHaveBeenCalledWith('flowchart LR;A; B;', 'png', undefined);
    expect(exported).toContain('class="mermaid-export-image"');
    expect(exported).not.toContain('Rendered label');
  });

  it('appends the rendered diagram when the HTML has no Mermaid marker', async () => {
    const renderer = vi.fn(async () => ({
      data: new Uint8Array([137, 80, 78, 71]),
      contentType: 'image/png' as const,
      width: 1,
      height: 1,
    }));
    const exported = await replaceMermaidCodeBlocksWithImages(
      '<p>Only text</p>',
      ['sequenceDiagram;A->>B: Hello'],
      undefined,
      renderer,
    );
    expect(renderer).toHaveBeenCalledWith('sequenceDiagram;A->>B: Hello', 'png', undefined);
    expect(exported).toContain('class="mermaid-export-image"');
  });
});
