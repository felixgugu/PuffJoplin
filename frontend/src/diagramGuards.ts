export type FlowchartDrawing = {
  drawSVG: (element: HTMLElement) => void;
};

export type FlowchartLibrary = {
  parse: (text: string) => FlowchartDrawing;
  __puffJoplinGuarded?: boolean;
};

export type MermaidLibrary = {
  render: (id: string, text: string) => Promise<{ svg: string }> | { svg: string };
  __puffJoplinGuarded?: boolean;
};

type DiagramWindow = Window & {
  flowchart?: FlowchartLibrary;
  mermaid?: MermaidLibrary;
};

const diagramRenderingClass = 'puff-diagram-rendering';
let diagramRenderDepth = 0;

/**
 * Diagram libraries build a temporary DOM subtree to measure their own labels.
 * App-wide transitions (for example the reduced-motion rule) make the browser
 * report those labels in the middle of a transition, which turns into wildly
 * oversized layouts, so every render runs with transitions and animations off.
 */
function enterDiagramRender(): (() => void) | null {
  const root = typeof document === 'undefined' ? undefined : document.documentElement;
  if (!root) return null;
  diagramRenderDepth += 1;
  root.classList.add(diagramRenderingClass);
  return () => {
    diagramRenderDepth = Math.max(0, diagramRenderDepth - 1);
    if (diagramRenderDepth === 0) root.classList.remove(diagramRenderingClass);
  };
}

async function withoutDiagramTransitions<T>(run: () => Promise<T>): Promise<T> {
  const release = enterDiagramRender();
  try {
    return await run();
  } finally {
    release?.();
  }
}

function withoutDiagramTransitionsSync<T>(run: () => T): T {
  const release = enterDiagramRender();
  try {
    return run();
  } finally {
    release?.();
  }
}

function escapeHTML(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function fallbackHTML(language: string, code: string): string {
  return `<div class="puff-diagram-error"><strong>${language} 語法尚未完成或無法解析</strong>` +
    `<pre>${escapeHTML(code.trim())}</pre></div>`;
}

export function renderFlowchartFallback(element: HTMLElement, code: string) {
  const container = document.createElement('div');
  container.className = 'puff-diagram-error';
  const title = document.createElement('strong');
  title.textContent = 'Flowchart 語法尚未完成或無法解析';
  const source = document.createElement('pre');
  source.textContent = code.trim();
  container.append(title, source);
  element.replaceChildren(container);
  element.setAttribute('data-puffjoplin-diagram-error', 'true');
}

export function guardFlowchartLibrary(library: FlowchartLibrary | undefined): boolean {
  if (!library || library.__puffJoplinGuarded) return false;
  const originalParse = library.parse;
  library.parse = (code: string) => {
    let drawing: FlowchartDrawing | undefined;
    try {
      drawing = originalParse.call(library, code);
    } catch {
      // Use the fallback drawing below.
    }
    const originalDraw = drawing?.drawSVG;
    if (!drawing || typeof originalDraw !== 'function') {
      return { drawSVG: (element) => renderFlowchartFallback(element, code) };
    }
    drawing.drawSVG = (element: HTMLElement) => withoutDiagramTransitionsSync(() => {
      try {
        originalDraw.call(drawing, element);
      } catch {
        renderFlowchartFallback(element, code);
      }
    });
    return drawing;
  };
  library.__puffJoplinGuarded = true;
  return true;
}

export function guardMermaidLibrary(library: MermaidLibrary | undefined): boolean {
  if (!library || library.__puffJoplinGuarded) return false;
  const originalRender = library.render;
  library.render = (id: string, code: string) => withoutDiagramTransitions(async () => {
    try {
      return await originalRender.call(library, id, code);
    } catch {
      return { svg: fallbackHTML('Mermaid', code) };
    }
  });
  library.__puffJoplinGuarded = true;
  return true;
}

export function installDiagramGuards() {
  const diagramWindow = window as DiagramWindow;
  guardFlowchartLibrary(diagramWindow.flowchart);
  guardMermaidLibrary(diagramWindow.mermaid);
}
