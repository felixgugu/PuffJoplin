import { extractMermaidBlocks } from './mermaidBlocks';

export interface SourcePreviewLine {
  lineNumber: number;
  text: string;
  anchor: {
    left: number;
    right: number;
    top: number;
    bottom: number;
  };
}

export type SourcePreviewTarget =
  | {
      id: string;
      kind: 'image';
      lineNumber: number;
      endLine: number;
      from: number;
      to: number;
      src: string;
      alt: string;
    }
  | {
      id: string;
      kind: 'mermaid';
      lineNumber: number;
      endLine: number;
      from: number;
      to: number;
      code: string;
    };

const inlineImagePattern =
  /(?<!\\)!\[([^\]]*)\]\(\s*(?:<([^>\n]+)>|([^\s)]+))(?:\s+(?:"[^"]*"|'[^']*'))?\s*\)/g;
const openingFencePattern = /^ {0,3}(`{3,}|~{3,})(.*)$/;
const closingFencePattern = /^ {0,3}(`{3,}|~{3,})\s*$/;

function fencedLines(lines: readonly string[]): boolean[] {
  const fenced = Array.from({ length: lines.length }, () => false);
  let fence: { character: string; length: number } | null = null;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (fence) {
      fenced[index] = true;
      const closing = closingFencePattern.exec(line);
      const closes = Boolean(
        closing &&
        closing[1][0] === fence.character &&
        closing[1].length >= fence.length,
      );
      if (closes) fence = null;
      continue;
    }
    const opening = openingFencePattern.exec(line);
    if (!opening) continue;
    fenced[index] = true;
    fence = {
      character: opening[1][0],
      length: opening[1].length,
    };
  }
  return fenced;
}

function supportedImageSource(destination: string): string | null {
  const source = destination.trim();
  const stored = /^:\/([A-Za-z0-9]{32})(?:[?#].*)?$/.exec(source);
  if (stored) return `/resources/${stored[1]}`;
  if (/^\/resources\/[A-Za-z0-9]{32}(?:[?#].*)?$/.test(source)) return source;
  if (/^data:image\//i.test(source)) return source;
  return null;
}

export function findSourceLinePreview(
  markdown: string,
  lineNumber: number,
): SourcePreviewTarget | null {
  return findSourcePreviewItems(markdown)
    .find((item) => item.lineNumber === lineNumber) ?? null;
}

interface OffsetLine {
  start: number;
  end: number;
}

function offsetLines(markdown: string): OffsetLine[] {
  const lines: OffsetLine[] = [];
  let start = 0;
  while (start <= markdown.length) {
    const newline = markdown.indexOf('\n', start);
    const rawEnd = newline === -1 ? markdown.length : newline;
    const end = rawEnd > start && markdown[rawEnd - 1] === '\r'
      ? rawEnd - 1
      : rawEnd;
    lines.push({ start, end });
    if (newline === -1) break;
    start = newline + 1;
  }
  return lines;
}

export function findSourcePreviewItems(markdown: string): SourcePreviewTarget[] {
  const lines = markdown.split(/\r?\n/);
  const offsets = offsetLines(markdown);
  const fences = fencedLines(lines);
  const items: SourcePreviewTarget[] = [];

  for (const block of extractMermaidBlocks(markdown)) {
    const start = offsets[block.startLine];
    const end = offsets[block.endLine];
    if (!start || !end) continue;
    items.push({
      id: `mermaid:${start.start}:${end.end}`,
      kind: 'mermaid',
      lineNumber: block.startLine + 1,
      endLine: block.endLine + 1,
      from: start.start,
      to: end.end,
      code: block.code,
    });
  }

  for (let index = 0; index < lines.length; index += 1) {
    if (fences[index]) continue;
    const text = lines[index];
    const lineOffset = offsets[index];
    if (!lineOffset) continue;
    inlineImagePattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = inlineImagePattern.exec(text)) !== null) {
      const src = supportedImageSource(match[2] || match[3] || '');
      if (!src) continue;
      const from = lineOffset.start + match.index;
      const to = from + match[0].length;
      items.push({
        id: `image:${from}:${to}`,
        kind: 'image',
        lineNumber: index + 1,
        endLine: index + 1,
        from,
        to,
        src,
        alt: match[1].trim() || '圖片預覽',
      });
    }
  }

  return items.sort((left, right) => left.from - right.from);
}

export interface SourcePreviewDeletion {
  from: number;
  to: number;
  markdown: string;
}

export function sourcePreviewDeletion(
  markdown: string,
  target: SourcePreviewTarget,
): SourcePreviewDeletion {
  let from = target.from;
  let to = target.to;
  if (target.kind === 'mermaid') {
    if (markdown.startsWith('\r\n', to)) to += 2;
    else if (markdown[to] === '\n') to += 1;
  } else {
    const lineStart = markdown.lastIndexOf('\n', Math.max(0, from - 1)) + 1;
    const lineEnd = markdown.indexOf('\n', to);
    const contentEnd = lineEnd === -1 ? markdown.length : lineEnd;
    const before = markdown.slice(lineStart, from);
    const after = markdown.slice(to, contentEnd).replace(/\r$/, '');
    if (before.trim() === '' && after.trim() === '') {
      from = lineStart;
      to = lineEnd === -1 ? markdown.length : lineEnd + 1;
    }
  }
  return {
    from,
    to,
    markdown: markdown.slice(0, from) + markdown.slice(to),
  };
}
