interface MermaidApi {
  initialize(config: Record<string, unknown>): void;
  render(id: string, code: string): Promise<{ svg: string }>;
}

export type MermaidImageFormat = 'svg' | 'png';

export interface RenderedMermaidImage {
  data: Uint8Array;
  contentType: 'image/svg+xml' | 'image/png';
  width: number;
  height: number;
}

const mermaidScriptSelector = 'script[data-puffjoplin-mermaid]';
const mermaidMaximumWidth = 1600;
const mermaidMaximumHeight = 4000;
const svgNamespace = 'http://www.w3.org/2000/svg';
let mermaidLoading: Promise<MermaidApi> | null = null;
let mermaidInitialized = false;
let mermaidRenderSequence = 0;

function getMermaid(): MermaidApi | null {
  const value = (window as unknown as { mermaid?: MermaidApi }).mermaid;
  return value && typeof value.render === 'function' ? value : null;
}

function loadMermaid(): Promise<MermaidApi> {
  const loaded = getMermaid();
  if (loaded) return Promise.resolve(loaded);
  if (mermaidLoading) return mermaidLoading;
  mermaidLoading = new Promise<MermaidApi>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(mermaidScriptSelector);
    const script = existing ?? document.createElement('script');
    let settled = false;
    const settle = (error?: Error) => {
      if (settled) return;
      settled = true;
      const mermaid = getMermaid();
      if (error) {
        reject(error);
      } else if (mermaid) {
        resolve(mermaid);
      } else {
        reject(new Error('Mermaid 載入後沒有提供繪圖 API'));
      }
    };
    script.addEventListener('load', () => settle(), { once: true });
    script.addEventListener('error', () => settle(new Error('無法載入 Mermaid')), { once: true });
    if (!existing) {
      script.dataset.puffjoplinMermaid = 'true';
      script.src = '/vditor/dist/js/mermaid/mermaid.min.js';
      document.head.appendChild(script);
    } else if (getMermaid()) {
      settle();
    }
  }).catch((error) => {
    mermaidLoading = null;
    throw error;
  });
  return mermaidLoading;
}

function initializeMermaid(mermaid: MermaidApi) {
  if (mermaidInitialized) return;
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    theme: 'default',
    fontFamily: '"Microsoft JhengHei UI", "Segoe UI", sans-serif',
    flowchart: {
      // foreignObject labels taint the canvas in WebView2, so keep labels as SVG text.
      htmlLabels: false,
      curve: 'basis',
    },
    class: {
      htmlLabels: false,
    },
    maxTextSize: 100_000,
    maxEdges: 1000,
  });
  mermaidInitialized = true;
}

function svgDimensions(svg: SVGSVGElement): { width: number; height: number } {
  const viewBox = (svg.getAttribute('viewBox') || '')
    .trim()
    .split(/[\s,]+/)
    .map(Number);
  if (viewBox.length === 4 && viewBox.every(Number.isFinite) && viewBox[2] > 0 && viewBox[3] > 0) {
    return { width: viewBox[2], height: viewBox[3] };
  }
  const width = Number.parseFloat(svg.getAttribute('width') || '');
  const height = Number.parseFloat(svg.getAttribute('height') || '');
  if (Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0) {
    return { width, height };
  }
  throw new Error('Mermaid 圖表沒有有效的尺寸');
}

function replaceForeignObjectLabels(svg: SVGSVGElement) {
  for (const foreignObject of Array.from(svg.querySelectorAll('foreignObject'))) {
    const label = (foreignObject.textContent || '').replace(/\s+/g, ' ').trim();
    if (!label) {
      foreignObject.remove();
      continue;
    }
    const x = Number.parseFloat(foreignObject.getAttribute('x') || '0');
    const y = Number.parseFloat(foreignObject.getAttribute('y') || '0');
    const width = Number.parseFloat(foreignObject.getAttribute('width') || '0');
    const height = Number.parseFloat(foreignObject.getAttribute('height') || '0');
    const text = svg.ownerDocument.createElementNS(svgNamespace, 'text');
    text.setAttribute('x', String((Number.isFinite(x) ? x : 0) + (Number.isFinite(width) ? width : 0) / 2));
    text.setAttribute('y', String((Number.isFinite(y) ? y : 0) + (Number.isFinite(height) ? height : 0) / 2));
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('dominant-baseline', 'middle');
    text.setAttribute('font-family', '"Microsoft JhengHei UI", "Segoe UI", sans-serif');
    text.setAttribute('font-size', '14px');
    text.setAttribute('fill', '#333333');
    text.textContent = label;
    foreignObject.replaceWith(text);
  }
}

function removeUnsafeSvgContent(svg: SVGSVGElement) {
  for (const script of Array.from(svg.querySelectorAll('script'))) {
    script.remove();
  }
  for (const element of Array.from(svg.querySelectorAll('*'))) {
    for (const attribute of Array.from(element.attributes)) {
      const name = attribute.name.toLowerCase();
      const value = attribute.value.trim().toLowerCase();
      if (name.startsWith('on') || (name.endsWith('href') && value.startsWith('javascript:'))) {
        element.removeAttribute(attribute.name);
      }
    }
  }
}

function canvasToPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Mermaid 圖片編碼失敗'));
    }, 'image/png');
  });
}

async function renderSvg(code: string, signal?: AbortSignal) {
  signal?.throwIfAborted();
  const mermaid = await loadMermaid();
  initializeMermaid(mermaid);
  signal?.throwIfAborted();
  const id = `puffjoplin-mermaid-${Date.now()}-${mermaidRenderSequence++}`;
  const rendered = await mermaid.render(id, code);
  signal?.throwIfAborted();
  // Mermaid emits SVG containing HTML void elements such as <br>. Strict XML
  // parsing rejects those, so parse as HTML and then serialize the SVG node.
  const parsed = new DOMParser().parseFromString(rendered.svg, 'text/html');
  const svg = parsed.querySelector('svg');
  if (!(svg instanceof SVGSVGElement)) {
    throw new Error('Mermaid 回傳了無效的 SVG');
  }
  replaceForeignObjectLabels(svg);
  removeUnsafeSvgContent(svg);
  svg.setAttribute('xmlns', svgNamespace);
  return { svg, dimensions: svgDimensions(svg) };
}

export async function renderMermaidImage(
  code: string,
  format: MermaidImageFormat,
  signal?: AbortSignal,
): Promise<RenderedMermaidImage> {
  const { svg, dimensions } = await renderSvg(code, signal);
  if (format === 'svg') {
    const width = Math.max(1, Math.round(dimensions.width));
    const height = Math.max(1, Math.round(dimensions.height));
    svg.setAttribute('width', String(width));
    svg.setAttribute('height', String(height));
    const serialized = new XMLSerializer().serializeToString(svg);
    return {
      data: new TextEncoder().encode(serialized),
      contentType: 'image/svg+xml',
      width,
      height,
    };
  }

  const rasterScale = Math.min(
    2,
    mermaidMaximumWidth / dimensions.width,
    mermaidMaximumHeight / dimensions.height,
  );
  const outputWidth = Math.max(1, Math.round(dimensions.width * rasterScale));
  const outputHeight = Math.max(1, Math.round(dimensions.height * rasterScale));
  svg.setAttribute('width', String(outputWidth));
  svg.setAttribute('height', String(outputHeight));
  const serialized = new XMLSerializer().serializeToString(svg);
  const { Canvg } = await import('canvg');
  const canvas = document.createElement('canvas');
  canvas.width = outputWidth;
  canvas.height = outputHeight;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('無法建立 Mermaid 圖片畫布');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, outputWidth, outputHeight);
  const renderer = Canvg.fromString(context, serialized, {
    ignoreAnimation: true,
    ignoreMouse: true,
    ignoreDimensions: true,
    fetch: () => Promise.reject(new Error('Mermaid 圖表不允許載入外部資源')),
  });
  await renderer.render();
  signal?.throwIfAborted();
  const blob = await canvasToPng(canvas);
  return {
    data: new Uint8Array(await blob.arrayBuffer()),
    contentType: 'image/png',
    width: outputWidth,
    height: outputHeight,
  };
}

export function bytesToBase64(data: Uint8Array): string {
  const chunkSize = 0x8000;
  let binary = '';
  for (let offset = 0; offset < data.length; offset += chunkSize) {
    binary += String.fromCharCode(...data.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}
