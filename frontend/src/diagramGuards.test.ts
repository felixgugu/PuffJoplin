import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  guardFlowchartLibrary,
  guardMermaidLibrary,
  type FlowchartDrawing,
  type FlowchartLibrary,
  type MermaidLibrary,
} from './diagramGuards';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('diagram error guards', () => {
  it('turns flowchart draw failures into a safe fallback', () => {
    vi.stubGlobal('document', {
      createElement: vi.fn(() => ({
        className: '',
        textContent: '',
        append: vi.fn(),
      })),
    });
    const parse = vi.fn((_code: string): FlowchartDrawing => ({
      drawSVG: () => {
        throw new Error('incomplete flowchart');
      },
    }));
    const library: FlowchartLibrary = { parse };
    const element = {
      replaceChildren: vi.fn(),
      setAttribute: vi.fn(),
    };

    expect(guardFlowchartLibrary(library)).toBe(true);
    const drawing = library.parse('A -->');
    expect(() => drawing.drawSVG(element as unknown as HTMLElement)).not.toThrow();
    expect(element.replaceChildren).toHaveBeenCalledOnce();
    expect(guardFlowchartLibrary(library)).toBe(false);
  });

  it('handles flowchart parse failures', () => {
    vi.stubGlobal('document', {
      createElement: vi.fn(() => ({
        className: '',
        textContent: '',
        append: vi.fn(),
      })),
    });
    const library: FlowchartLibrary = {
      parse: (_code: string): FlowchartDrawing => {
        throw new Error('empty diagram');
      },
    };
    const element = {
      replaceChildren: vi.fn(),
      setAttribute: vi.fn(),
    };
    guardFlowchartLibrary(library);

    const drawing = library.parse('');
    drawing.drawSVG(element as unknown as HTMLElement);

    expect(element.replaceChildren).toHaveBeenCalledOnce();
  });

  it('turns rejected Mermaid renders into a safe SVG payload', async () => {
    const library: MermaidLibrary = {
      render: vi.fn(() => Promise.reject(new Error('incomplete mermaid'))),
    };
    guardMermaidLibrary(library);

    const result = await library.render('diagram', 'flowchart TD');

    expect(result.svg).toContain('Mermaid 語法尚未完成或無法解析');
    expect(result.svg).toContain('flowchart TD');
    expect(guardMermaidLibrary(library)).toBe(false);
  });

  it('disables app-wide transitions while Mermaid renders and restores them after', async () => {
    const classList = { add: vi.fn(), remove: vi.fn() };
    vi.stubGlobal('document', { documentElement: { classList } });
    const library: MermaidLibrary = {
      render: vi.fn(() => new Promise<{ svg: string }>((resolve) => {
        setTimeout(() => resolve({ svg: '<svg></svg>' }), 0);
      })),
    };
    guardMermaidLibrary(library);

    const pending = library.render('diagram', 'flowchart TD');
    expect(classList.add).toHaveBeenCalledWith('puff-diagram-rendering');
    expect(classList.remove).not.toHaveBeenCalled();

    await expect(pending).resolves.toEqual({ svg: '<svg></svg>' });
    expect(classList.remove).toHaveBeenCalledWith('puff-diagram-rendering');
  });

  it('restores transitions when Mermaid rendering fails', async () => {
    const classList = { add: vi.fn(), remove: vi.fn() };
    vi.stubGlobal('document', { documentElement: { classList } });
    const library: MermaidLibrary = {
      render: vi.fn(() => Promise.reject(new Error('incomplete mermaid'))),
    };
    guardMermaidLibrary(library);

    const result = await library.render('diagram', 'flowchart TD');

    expect(result.svg).toContain('Mermaid 語法尚未完成或無法解析');
    expect(classList.remove).toHaveBeenCalledWith('puff-diagram-rendering');
  });
});
