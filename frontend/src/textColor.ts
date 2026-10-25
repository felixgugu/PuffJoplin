export interface TextColorOption {
  name: string;
  value: string;
}

export const TEXT_COLOR_PLACEHOLDER = '\u200B';

export const TEXT_COLORS: TextColorOption[] = [
  { name: '黑色', value: '#000000' },
  { name: '深灰', value: '#434343' },
  { name: '灰色', value: '#666666' },
  { name: '淺灰', value: '#999999' },
  { name: '白色', value: '#FFFFFF' },
  { name: '紅色', value: '#E53935' },
  { name: '橙色', value: '#FB8C00' },
  { name: '黃色', value: '#FDD835' },
  { name: '綠色', value: '#43A047' },
  { name: '青色', value: '#00ACC1' },
  { name: '藍色', value: '#1E88E5' },
  { name: '靛色', value: '#3949AB' },
  { name: '紫色', value: '#8E24AA' },
  { name: '粉紅', value: '#D81B60' },
  { name: '棕色', value: '#6D4C41' },
  { name: '天藍', value: '#039BE5' },
];

export type TextColorSelection =
  | { mode: 'dom'; range: Range }
  | { mode: 'source'; start: number; end: number };

export interface SourceColorResult {
  value: string;
  selectionStart: number;
  selectionEnd: number;
}

const excludedColorTextSelector = [
  'script',
  'style',
  'svg',
  '.vditor-toolbar',
  '.vditor-ir__preview',
  '.vditor-wysiwyg__preview',
].join(',');
const textColorMarkerSelector = '[data-type="html-inline"]';
const textBlockSelector = 'p,li,h1,h2,h3,h4,h5,h6,td,th,blockquote,[data-block]';

interface ColorMarkerPair {
  color: string;
  open: HTMLElement;
  close: HTMLElement;
  range: Range;
}

type HighlightRegistry = {
  set(name: string, highlight: unknown): void;
  delete(name: string): boolean;
};

type HighlightConstructor = new (...ranges: AbstractRange[]) => unknown;

function escapeHTML(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

export function colorSpan(value: string, color: string): HTMLSpanElement {
  const span = document.createElement('span');
  span.setAttribute('style', `color: ${color}`);
  span.textContent = value;
  return span;
}

function selectedTextTargets(root: HTMLElement, range: Range) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const targets: Array<{ node: Text; start: number; end: number }> = [];
  let current = walker.nextNode();
  while (current) {
    const node = current as Text;
    const parent = node.parentElement;
    if (parent && !parent.closest(excludedColorTextSelector) && range.intersectsNode(node)) {
      const start = node === range.startContainer ? range.startOffset : 0;
      const end = node === range.endContainer ? range.endOffset : node.data.length;
      if (start < end) targets.push({ node, start, end });
    }
    current = walker.nextNode();
  }
  return targets;
}

export function applyDomTextColor(
  root: HTMLElement,
  range: Range,
  color: string,
): boolean {
  if (range.collapsed) {
    const span = colorSpan(TEXT_COLOR_PLACEHOLDER, color);
    range.insertNode(span);
    const text = span.firstChild;
    if (text instanceof Text) {
      const caret = document.createRange();
      caret.setStart(text, Math.floor(TEXT_COLOR_PLACEHOLDER.length / 2));
      caret.collapse(true);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(caret);
    }
    return true;
  }

  const targets = selectedTextTargets(root, range);
  if (targets.length === 0) return false;
  const spans: HTMLSpanElement[] = [];
  for (let index = targets.length - 1; index >= 0; index -= 1) {
    const { node, start, end } = targets[index];
    if (end < node.data.length) node.splitText(end);
    const selected = start > 0 ? node.splitText(start) : node;
    const span = colorSpan('', color);
    selected.parentNode?.insertBefore(span, selected);
    span.appendChild(selected);
    spans.unshift(span);
  }
  const selection = window.getSelection();
  if (selection && spans.length > 0) {
    const caret = document.createRange();
    caret.setStartAfter(spans[spans.length - 1]);
    caret.collapse(true);
    selection.removeAllRanges();
    selection.addRange(caret);
  }
  return true;
}

export function removeDomTextColor(root: HTMLElement, range: Range): boolean {
  const colored = [
    ...Array.from(root.querySelectorAll<HTMLElement>('span[style*="color"]')),
    ...Array.from(root.querySelectorAll<HTMLElement>('font[color]')),
  ].filter((element) => {
    try {
      return range.intersectsNode(element);
    } catch {
      return false;
    }
  });
  for (const element of colored) {
    if (element.tagName.toLowerCase() === 'font') {
      element.replaceWith(...Array.from(element.childNodes));
      continue;
    }
    element.style.removeProperty('color');
    if (!element.style.cssText.trim()) element.removeAttribute('style');
    if (element.attributes.length === 0) {
      element.replaceWith(...Array.from(element.childNodes));
    }
  }
  return colored.length > 0;
}

export function extractColorMarkerTemplates(markup: string): {
  open: HTMLElement;
  close: HTMLElement;
} | null {
  const template = document.createElement('template');
  template.innerHTML = markup;
  const markers = Array.from(
    template.content.querySelectorAll<HTMLElement>(textColorMarkerSelector),
  );
  if (markers.length < 2) return null;
  return {
    open: markers[0].cloneNode(true) as HTMLElement,
    close: markers[markers.length - 1].cloneNode(true) as HTMLElement,
  };
}

function markerToken(element: HTMLElement): string {
  return (element.textContent || '').replaceAll('\u200B', '').trim();
}

function markerColor(token: string): string {
  const match = token.match(
    /^<span\b[^>]*\bstyle\s*=\s*(["'])[^"']*\bcolor\s*:\s*(#[0-9a-f]{6})\s*;?[^"']*\1[^>]*>$/i,
  );
  return match?.[2]?.toUpperCase() || '';
}

function colorMarkerPairs(root: HTMLElement): ColorMarkerPair[] {
  const stack: Array<{ element: HTMLElement; color: string } | null> = [];
  const pairs: ColorMarkerPair[] = [];
  root.querySelectorAll<HTMLElement>(textColorMarkerSelector).forEach((element) => {
    const token = markerToken(element);
    if (/^<\/span>$/i.test(token)) {
      const opening = stack.pop();
      if (!opening) return;
      const range = document.createRange();
      range.setStartAfter(opening.element);
      range.setEndBefore(element);
      if (opening.color) {
        pairs.push({ color: opening.color, open: opening.element, close: element, range });
      }
      return;
    }
    if (/^<span\b/i.test(token)) {
      stack.push({ element, color: markerColor(token) });
    }
  });
  return pairs;
}

function colorHighlightName(color: string): string {
  return `puffjoplin-text-${color.replace(/[^0-9a-f]/gi, '').toLowerCase()}`;
}

export function clearTextColorHighlights() {
  const registry = (window as unknown as { CSS?: { highlights?: HighlightRegistry } })
    .CSS?.highlights;
  if (!registry) return;
  for (const option of TEXT_COLORS) {
    registry.delete(colorHighlightName(option.value));
  }
}

export function decorateTextColorMarkers(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>('[data-puffjoplin-color-marker="true"]')
    .forEach((element) => element.removeAttribute('data-puffjoplin-color-marker'));
  clearTextColorHighlights();
  const runtime = window as unknown as {
    Highlight?: HighlightConstructor;
    CSS?: { highlights?: HighlightRegistry };
  };
  const Highlight = runtime.Highlight;
  const registry = runtime.CSS?.highlights;
  if (!Highlight || !registry) return;
  const grouped = new Map<string, Range[]>();
  for (const pair of colorMarkerPairs(root)) {
    const known = TEXT_COLORS.some((option) => option.value === pair.color);
    if (!known) continue;
    pair.open.setAttribute('data-puffjoplin-color-marker', 'true');
    pair.close.setAttribute('data-puffjoplin-color-marker', 'true');
    const ranges = grouped.get(pair.color) || [];
    ranges.push(pair.range);
    grouped.set(pair.color, ranges);
  }
  for (const [color, ranges] of grouped) {
    registry.set(colorHighlightName(color), new Highlight(...ranges));
  }
}

export function removeDomTextColorMarkers(root: HTMLElement, range: Range): boolean {
  const selectedNodes = selectedTextTargets(root, range).map((target) => target.node);
  if (range.collapsed && range.startContainer instanceof Text) {
    selectedNodes.push(range.startContainer);
  }
  const pairs = colorMarkerPairs(root).filter((pair) => {
    try {
      return range.intersectsNode(pair.open) || range.intersectsNode(pair.close) ||
        selectedNodes.some((node) => pair.range.intersectsNode(node));
    } catch {
      return false;
    }
  });
  for (const pair of pairs) {
    pair.open.remove();
    pair.close.remove();
  }
  return pairs.length > 0;
}

export function insertColorMarkers(
  root: HTMLElement,
  range: Range,
  templates: { open: HTMLElement; close: HTMLElement },
): boolean {
  if (range.collapsed) {
    const fragment = document.createDocumentFragment();
    const text = document.createTextNode(TEXT_COLOR_PLACEHOLDER);
    fragment.append(templates.open, text, templates.close);
    range.insertNode(fragment);
    const caret = document.createRange();
    caret.setStart(text, 0);
    caret.collapse(true);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(caret);
    return true;
  }

  const grouped = new Map<Element, Array<{ node: Text; start: number; end: number }>>();
  for (const target of selectedTextTargets(root, range)) {
    const block = target.node.parentElement?.closest(textBlockSelector) || root;
    const targets = grouped.get(block) || [];
    targets.push(target);
    grouped.set(block, targets);
  }
  if (grouped.size === 0) return false;
  for (const targets of Array.from(grouped.values()).reverse()) {
    const first = targets[0];
    const last = targets[targets.length - 1];
    const blockRange = document.createRange();
    blockRange.setStart(first.node, first.start);
    blockRange.setEnd(last.node, last.end);
    const closeRange = blockRange.cloneRange();
    closeRange.collapse(false);
    closeRange.insertNode(templates.close.cloneNode(true));
    const openRange = blockRange.cloneRange();
    openRange.collapse(true);
    openRange.insertNode(templates.open.cloneNode(true));
  }
  return true;
}

export function applySourceTextColor(
  value: string,
  start: number,
  end: number,
  color: string,
): SourceColorResult {
  const safeStart = Math.max(0, Math.min(start, value.length));
  const safeEnd = Math.max(safeStart, Math.min(end, value.length));
  const selected = value.slice(safeStart, safeEnd) || TEXT_COLOR_PLACEHOLDER;
  const opening = `<span style="color: ${color}">`;
  const replacement = `${opening}${escapeHTML(selected)}</span>`;
  const caret = safeStart + opening.length +
    (safeStart === safeEnd ? Math.floor(TEXT_COLOR_PLACEHOLDER.length / 2) : selected.length);
  return {
    value: value.slice(0, safeStart) + replacement + value.slice(safeEnd),
    selectionStart: caret,
    selectionEnd: caret,
  };
}

function stripColorFromSpan(attributes: string, content: string): string {
  const styleMatch = attributes.match(/\bstyle\s*=\s*(["'])(.*?)\1/i);
  if (!styleMatch) return `<span${attributes}>${content}</span>`;
  const remaining = styleMatch[2]
    .split(';')
    .map((item) => item.trim())
    .filter((item) => item && !/^color\s*:/i.test(item))
    .join('; ');
  const remainingAttributes = attributes.replace(styleMatch[0], '').trim();
  if (!remaining && !remainingAttributes) return content;
  const styleAttribute = remaining ? ` style="${remaining}"` : '';
  return `<span${remainingAttributes ? ` ${remainingAttributes}` : ''}${styleAttribute}>${content}</span>`;
}

export function removeSourceTextColor(
  value: string,
  start: number,
  end: number,
): SourceColorResult {
  const safeStart = Math.max(0, Math.min(start, value.length));
  const safeEnd = Math.max(safeStart, Math.min(end, value.length));
  let selected = value.slice(safeStart, safeEnd);
  selected = selected
    .replace(
      /<span\b([^>]*)>([\s\S]*?)<\/span>/gi,
      (_match, attributes: string, content: string) =>
        stripColorFromSpan(attributes, content),
    )
    .replace(/<font\b[^>]*\bcolor\s*=\s*(["']).*?\1[^>]*>([\s\S]*?)<\/font>/gi, '$2');
  const caret = safeStart + selected.length;
  return {
    value: value.slice(0, safeStart) + selected + value.slice(safeEnd),
    selectionStart: caret,
    selectionEnd: caret,
  };
}
