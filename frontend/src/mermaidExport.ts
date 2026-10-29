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

type MermaidImageRenderer = (
  code: string,
  format: MermaidImageFormat,
  signal?: AbortSignal,
) => Promise<RenderedMermaidImage>;

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

const labelFontFamily = '"Segoe UI Variable Text", "Segoe UI", "Microsoft JhengHei UI", sans-serif';
let measureCanvas: HTMLCanvasElement | null | undefined;

function measureTextWidth(text: string, font: string): number {
  if (measureCanvas === undefined) {
    measureCanvas = typeof document === 'undefined' ? null : document.createElement('canvas');
  }
  const context = measureCanvas?.getContext?.('2d') ?? null;
  if (!context) return 0;
  context.font = font;
  return context.measureText(text).width;
}

/**
 * ForeignObject labels carry their line breaks as <br> elements and their
 * styling as inline CSS. Converting them to SVG text has to keep those breaks,
 * otherwise multi-line labels collapse into one long line.
 */
export function splitMermaidLabelLines(element: Element): string[] {
  const lines: string[] = [];
  let current = '';
  const flush = () => {
    const line = current.replace(/\s+/g, ' ').trim();
    if (line) lines.push(line);
    current = '';
  };
  const walk = (node: Node) => {
    if (node.nodeType === 3) {
      current += node.nodeValue ?? '';
      return;
    }
    if (node.nodeType !== 1) return;
    const tag = (node as Element).tagName.toLowerCase();
    if (tag === 'br') {
      flush();
      return;
    }
    const block = tag === 'p' || tag === 'div';
    if (block) flush();
    for (const child of Array.from(node.childNodes)) walk(child);
    if (block) flush();
  };
  for (const child of Array.from(element.childNodes)) walk(child);
  flush();
  return lines;
}

/**
 * ForeignObject labels are laid out by the browser: explicit <br> elements
 * become line breaks and long lines wrap at the label width. Exporting to SVG
 * text has to reproduce both, otherwise labels overflow their nodes.
 */
export function wrapMermaidLabelLine(
  line: string,
  maxWidth: number,
  measure: (text: string) => number,
): string[] {
  if (!line || maxWidth <= 0 || measure(line) <= maxWidth) return [line];
  const words = line.split(/(\s+)/).filter((word) => word.length > 0);
  const lines: string[] = [];
  let current = '';
  const flush = () => {
    const value = current.trim();
    if (value) lines.push(value);
    current = '';
  };
  for (const word of words) {
    if (!current && !word.trim()) continue;
    if (current && measure(current + word) > maxWidth) flush();
    if (measure(word) > maxWidth) {
      for (const char of Array.from(word)) {
        if (current && measure(current + char) > maxWidth) flush();
        if (!current && !char.trim()) continue;
        current += char;
      }
    } else {
      current += word;
    }
  }
  flush();
  return lines.length > 0 ? lines : [line];
}

function svgLabelMetrics(svg: SVGSVGElement): { fontSize: number; fill: string } {
  const style = svg.querySelector('style')?.textContent || '';
  const fontSize = Number.parseFloat(style.match(/font-size:\s*([\d.]+)px/)?.[1] || '');
  const fill = style.match(/fill:\s*(#[0-9a-fA-F]{3,8}|rgba?\([^)]*\))/)?.[1] || '#333333';
  return {
    fontSize: Number.isFinite(fontSize) && fontSize > 0 ? fontSize : 14,
    fill,
  };
}

function replaceForeignObjectLabels(svg: SVGSVGElement) {
  const { fontSize, fill } = svgLabelMetrics(svg);
  const lineHeight = Math.round(fontSize * 1.4);
  const font = `${fontSize}px ${labelFontFamily}`;
  const measure = (text: string) => measureTextWidth(text, font);
  for (const foreignObject of Array.from(svg.querySelectorAll('foreignObject'))) {
    const sourceLines = splitMermaidLabelLines(foreignObject);
    if (sourceLines.length === 0) {
      foreignObject.remove();
      continue;
    }
    const x = Number.parseFloat(foreignObject.getAttribute('x') || '0');
    const y = Number.parseFloat(foreignObject.getAttribute('y') || '0');
    const width = Number.parseFloat(foreignObject.getAttribute('width') || '0');
    const height = Number.parseFloat(foreignObject.getAttribute('height') || '0');
    const maxWidth = Number.isFinite(width) && width > 0 ? width + 8 : 0;
    const lines = sourceLines.flatMap((line) => wrapMermaidLabelLine(line, maxWidth, measure));
    const centerX = (Number.isFinite(x) ? x : 0) + (Number.isFinite(width) ? width : 0) / 2;
    const centerY = (Number.isFinite(y) ? y : 0) + (Number.isFinite(height) ? height : 0) / 2;
    const firstLineY = centerY - ((lines.length - 1) * lineHeight) / 2;
    for (const [index, line] of lines.entries()) {
      const text = svg.ownerDocument.createElementNS(svgNamespace, 'text');
      text.setAttribute('x', String(centerX));
      text.setAttribute('y', String(firstLineY + index * lineHeight));
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('dominant-baseline', 'middle');
      text.setAttribute('font-family', labelFontFamily);
      text.setAttribute('font-size', `${fontSize}px`);
      text.setAttribute('font-weight', '400');
      // Mermaid's classDef rules put an !important stroke on the label group,
      // which would outline the converted text in the node accent colour.
      text.setAttribute('style', `fill: ${fill}; font-weight: 400; stroke: none;`);
      text.setAttribute('fill', fill);
      text.textContent = line;
      foreignObject.parentNode?.insertBefore(text, foreignObject);
    }
    foreignObject.remove();
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
    // Canvas rasterizers (canvg) cannot parse !important inside style
    // attributes and silently drop the whole declaration, which turns node
    // fills into the inherited text colour. The flag carries no meaning in a
    // standalone SVG file, so drop it.
    const style = element.getAttribute('style');
    if (style?.includes('!important')) {
      element.setAttribute('style', style.replace(/\s*!\s*important\s*/gi, ' ').trim());
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

export async function replaceMermaidCodeBlocksWithImages(
  html: string,
  sourceCodes: readonly string[] = [],
  signal?: AbortSignal,
  renderer: MermaidImageRenderer = renderMermaidImage,
): Promise<string> {
  const document = new DOMParser().parseFromString(html, 'text/html');
  const usedBlocks = new Set<Element>();
  const candidates = Array.from(document.querySelectorAll<HTMLElement>(
    '.language-mermaid, pre > code.language-mermaid',
  ));
  const normalizeCode = (value: string) => value.replace(/\s+/g, ' ').trim();
  const source = sourceCodes
    .map((code) => code.trim())
    .filter(Boolean);
  const blocks = source.length > 0
    ? source.map((code) => {
        const candidate = candidates.find((element) => {
          const block = element.closest('pre') ?? element;
          return !usedBlocks.has(block);
        });
        if (candidate) {
          const block = candidate.closest('pre') ?? candidate;
          usedBlocks.add(block);
          return { block, code };
        }
        const matchedPre = Array.from(document.querySelectorAll('pre')).find((pre) => {
          if (usedBlocks.has(pre)) return false;
          return normalizeCode(pre.textContent || '').includes(normalizeCode(code));
        });
        if (matchedPre) usedBlocks.add(matchedPre);
        return { block: matchedPre ?? null, code };
      })
    : candidates.map((element) => {
        const block = element.closest('pre') ?? element;
        const codeElement = block.querySelector('code');
        return {
          block,
          code: block.getAttribute('data-code') || codeElement?.textContent || block.textContent || '',
        };
      });
  let index = 0;
  for (const { block, code: rawCode } of blocks) {
    signal?.throwIfAborted();
    const code = rawCode.trim();
    if (!code) continue;
    const image = await renderer(code, 'png', signal);
    const wrapper = document.createElement('div');
    wrapper.className = 'mermaid-export-image';
    const element = document.createElement('img');
    element.src = 'data:image/png;base64,' + bytesToBase64(image.data);
    element.alt = `Mermaid 圖表 ${++index}`;
    wrapper.appendChild(element);
    if (block) block.replaceWith(wrapper);
    else document.body.appendChild(wrapper);
  }
  return document.body.innerHTML;
}

export function bytesToBase64(data: Uint8Array): string {
  const chunkSize = 0x8000;
  let binary = '';
  for (let offset = 0; offset < data.length; offset += chunkSize) {
    binary += String.fromCharCode(...data.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}
