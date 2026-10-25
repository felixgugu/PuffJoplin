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
      kind: 'image';
      lineNumber: number;
      src: string;
      alt: string;
    }
  | {
      kind: 'mermaid';
      lineNumber: number;
      code: string;
    };

const inlineImagePattern =
  /(?<!\\)!\[([^\]]*)\]\(\s*(?:<([^>\n]+)>|([^\s)]+))(?:\s+(?:"[^"]*"|'[^']*'))?\s*\)/g;
const openingFencePattern = /^ {0,3}(`{3,}|~{3,})(.*)$/;
const closingFencePattern = /^ {0,3}(`{3,}|~{3,})\s*$/;

function insideFence(lines: readonly string[], lineIndex: number): boolean {
  let fence: { character: string; length: number } | null = null;
  for (let index = 0; index <= lineIndex; index += 1) {
    const line = lines[index] ?? '';
    if (fence) {
      const closing = closingFencePattern.exec(line);
      const closes = Boolean(
        closing &&
        closing[1][0] === fence.character &&
        closing[1].length >= fence.length,
      );
      if (index === lineIndex) return true;
      if (closes) fence = null;
      continue;
    }
    const opening = openingFencePattern.exec(line);
    if (!opening) continue;
    if (index === lineIndex) return true;
    fence = {
      character: opening[1][0],
      length: opening[1].length,
    };
  }
  return false;
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
  const lines = markdown.split(/\r?\n/);
  const lineIndex = lineNumber - 1;
  if (lineIndex < 0 || lineIndex >= lines.length) return null;

  const mermaid = extractMermaidBlocks(markdown)
    .find((block) => block.startLine === lineIndex);
  if (mermaid) {
    return {
      kind: 'mermaid',
      lineNumber,
      code: mermaid.code,
    };
  }
  if (insideFence(lines, lineIndex)) return null;

  const text = lines[lineIndex];
  inlineImagePattern.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = inlineImagePattern.exec(text)) !== null) {
    const src = supportedImageSource(match[2] || match[3] || '');
    if (!src) continue;
    return {
      kind: 'image',
      lineNumber,
      src,
      alt: match[1].trim() || '圖片預覽',
    };
  }
  return null;
}
