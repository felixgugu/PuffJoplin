export interface EditorSearchOptions {
  matchCase: boolean;
  wholeWord: boolean;
}

export interface EditorTextMatch {
  start: number;
  end: number;
}

interface TextCharacter {
  node: Text;
  offset: number;
}

export interface EditorTextBlock {
  start: number;
  end: number;
  lineNumber: number;
}

export interface SearchableTextMap {
  text: string;
  characters: Array<TextCharacter | null>;
  blocks: EditorTextBlock[];
}

export interface EditorSearchResult {
  index: number;
  lineNumber: number;
  prefix: string;
  match: string;
  suffix: string;
  hasLeadingGap: boolean;
  hasTrailingGap: boolean;
}

export interface EditorMatchLines {
  ranges: Range[];
  matchLineIndexes: number[];
}

const matchHighlightName = 'puffjoplin-find-match';
const activeHighlightName = 'puffjoplin-find-active';
const lineHighlightName = 'puffjoplin-find-line';
const activeLineHighlightName = 'puffjoplin-find-line-active';
const excludedTextSelector = [
  'script',
  'style',
  'svg',
  'textarea',
  '.vditor-toolbar',
  '.vditor-panel',
  '.vditor-tip',
  '.vditor-ir__preview',
  '.vditor-wysiwyg__preview',
  '[data-render]',
  '[aria-hidden="true"]',
].join(',');
const textBlockSelector = 'p,li,h1,h2,h3,h4,h5,h6,td,th,pre,blockquote,[data-block]';

const snippetWindow = 160;
const snippetLead = 60;

type HighlightRegistry = {
  set(name: string, highlight: unknown): void;
  delete(name: string): boolean;
};

type HighlightConstructor = new (...ranges: AbstractRange[]) => unknown;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isWordCharacter(value: string | undefined): boolean {
  return value !== undefined && /[\p{L}\p{N}_]/u.test(value);
}

export function findTextMatches(
  text: string,
  query: string,
  options: EditorSearchOptions,
): EditorTextMatch[] {
  if (!text || !query) return [];
  const expression = new RegExp(
    escapeRegExp(query),
    options.matchCase ? 'g' : 'gi',
  );
  const matches: EditorTextMatch[] = [];
  for (const match of text.matchAll(expression)) {
    const start = match.index;
    const end = start + match[0].length;
    if (options.wholeWord) {
      const startsWithWord = isWordCharacter(query[0]);
      const endsWithWord = isWordCharacter(query[query.length - 1]);
      if (startsWithWord && isWordCharacter(text[start - 1])) continue;
      if (endsWithWord && isWordCharacter(text[end])) continue;
    }
    matches.push({ start, end });
  }
  return matches;
}

export function buildSearchResults(
  text: string,
  matches: readonly EditorTextMatch[],
  limit = 200,
): EditorSearchResult[] {
  const results: EditorSearchResult[] = [];
  let lineNumber = 1;
  let countedLineStart = 0;
  for (let index = 0; index < matches.length && results.length < limit; index += 1) {
    const match = matches[index];
    const start = Math.max(0, Math.min(match.start, text.length));
    const end = Math.max(start, Math.min(match.end, text.length));
    const lineStart = text.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
    if (lineStart > countedLineStart) {
      let next = text.indexOf('\n', countedLineStart);
      while (next !== -1 && next < lineStart) {
        lineNumber += 1;
        countedLineStart = next + 1;
        next = text.indexOf('\n', countedLineStart);
      }
    }
    let lineEnd = text.indexOf('\n', end);
    if (lineEnd === -1) lineEnd = text.length;
    const line = text.slice(lineStart, lineEnd);
    const localMatchStart = start - lineStart;
    const localMatchEnd = end - lineStart;
    let windowStart = 0;
    let windowEnd = line.length;
    if (line.length > snippetWindow) {
      windowStart = Math.max(0, localMatchStart - snippetLead);
      windowEnd = Math.min(line.length, windowStart + snippetWindow);
      if (windowEnd - windowStart < snippetWindow) {
        windowStart = Math.max(0, windowEnd - snippetWindow);
      }
      windowEnd = Math.max(windowEnd, Math.min(line.length, localMatchEnd));
      windowStart = Math.min(windowStart, localMatchStart);
    }
    results.push({
      index,
      lineNumber,
      prefix: line.slice(windowStart, localMatchStart),
      match: line.slice(localMatchStart, localMatchEnd),
      suffix: line.slice(localMatchEnd, windowEnd),
      hasLeadingGap: windowStart > 0,
      hasTrailingGap: windowEnd < line.length,
    });
  }
  return results;
}

function textNodeIsSearchable(node: Text, root: HTMLElement): boolean {
  const parent = node.parentElement;
  if (!parent || !root.contains(parent) || !node.data) return false;
  if (parent.closest(excludedTextSelector)) return false;
  const marker = parent.closest('.vditor-ir__marker');
  if (marker && !marker.classList.contains('vditor-ir__marker--pre')) return false;
  const style = window.getComputedStyle(parent);
  return style.display !== 'none' && style.visibility !== 'hidden';
}

export function createSearchableTextMap(root: HTMLElement): SearchableTextMap {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const characters: Array<TextCharacter | null> = [];
  const blocks: EditorTextBlock[] = [];
  let text = '';
  let previousBlock: Element | null = null;
  let blockStart: number | null = null;
  let node = walker.nextNode();
  while (node) {
    const textNode = node as Text;
    if (textNodeIsSearchable(textNode, root)) {
      const block = textNode.parentElement?.closest(textBlockSelector) || root;
      if (text && block !== previousBlock) {
        if (blockStart !== null) {
          blocks.push({ start: blockStart, end: text.length, lineNumber: blocks.length + 1 });
        }
        text += '\n';
        characters.push(null);
        blockStart = text.length;
      } else if (blockStart === null) {
        blockStart = text.length;
      }
      previousBlock = block;
      for (let offset = 0; offset < textNode.data.length; offset += 1) {
        const character = textNode.data[offset];
        if (character === '\u200b' || character === '\ufeff') continue;
        text += character;
        characters.push({ node: textNode, offset });
      }
    }
    node = walker.nextNode();
  }
  if (blockStart !== null) {
    blocks.push({ start: blockStart, end: text.length, lineNumber: blocks.length + 1 });
  }
  return { text, characters, blocks };
}

function rangeForTextSpan(
  textMap: SearchableTextMap,
  start: number,
  end: number,
): Range | null {
  let first: TextCharacter | null = null;
  for (let index = start; index < end; index += 1) {
    if (textMap.characters[index]) {
      first = textMap.characters[index];
      break;
    }
  }
  let last: TextCharacter | null = null;
  for (let index = end - 1; index >= start; index -= 1) {
    if (textMap.characters[index]) {
      last = textMap.characters[index];
      break;
    }
  }
  if (!first || !last) return null;
  const range = document.createRange();
  range.setStart(first.node, first.offset);
  range.setEnd(last.node, last.offset + 1);
  return range;
}

export function rangesForTextMatches(
  textMap: SearchableTextMap,
  matches: readonly EditorTextMatch[],
): Range[] {
  const ranges: Range[] = [];
  for (const match of matches) {
    const range = rangeForTextSpan(textMap, match.start, match.end);
    if (range) ranges.push(range);
  }
  return ranges;
}

export function rangesForMatchLines(
  textMap: SearchableTextMap,
  matches: readonly EditorTextMatch[],
): EditorMatchLines {
  const ranges: Range[] = [];
  const matchLineIndexes: number[] = [];
  const blockRangeIndexes = new Map<number, number>();
  let blockCursor = 0;
  for (const match of matches) {
    while (
      blockCursor < textMap.blocks.length &&
      match.start >= textMap.blocks[blockCursor].end
    ) {
      blockCursor += 1;
    }
    const block = textMap.blocks[blockCursor];
    if (!block || match.start < block.start || match.start >= block.end) {
      matchLineIndexes.push(-1);
      continue;
    }
    let rangeIndex = blockRangeIndexes.get(blockCursor);
    if (rangeIndex === undefined) {
      const range = rangeForTextSpan(textMap, block.start, block.end);
      if (!range) {
        matchLineIndexes.push(-1);
        continue;
      }
      rangeIndex = ranges.length;
      ranges.push(range);
      blockRangeIndexes.set(blockCursor, rangeIndex);
    }
    matchLineIndexes.push(rangeIndex);
  }
  return { ranges, matchLineIndexes };
}

function highlightRuntime(): {
  Highlight: HighlightConstructor;
  registry: HighlightRegistry;
} | null {
  const highlight = (window as unknown as { Highlight?: HighlightConstructor }).Highlight;
  const registry = (window as unknown as { CSS?: { highlights?: HighlightRegistry } })
    .CSS?.highlights;
  return highlight && registry ? { Highlight: highlight, registry } : null;
}

export function applySearchHighlights(
  ranges: Range[],
  activeIndex: number,
  lineRanges: Range[] = [],
  activeLineIndex = -1,
): boolean {
  const runtime = highlightRuntime();
  if (!runtime) return false;
  const { Highlight, registry } = runtime;
  registry.delete(lineHighlightName);
  registry.delete(activeLineHighlightName);
  registry.delete(matchHighlightName);
  registry.delete(activeHighlightName);
  if (lineRanges.length > 0) {
    registry.set(lineHighlightName, new Highlight(...lineRanges));
  }
  const activeLine = lineRanges[activeLineIndex];
  if (activeLine) {
    registry.set(activeLineHighlightName, new Highlight(activeLine));
  }
  if (ranges.length > 0) {
    registry.set(matchHighlightName, new Highlight(...ranges));
  }
  const activeRange = ranges[activeIndex];
  if (activeRange) {
    registry.set(activeHighlightName, new Highlight(activeRange));
  }
  return true;
}

export function clearSearchHighlights() {
  const runtime = highlightRuntime();
  if (!runtime) return;
  runtime.registry.delete(lineHighlightName);
  runtime.registry.delete(activeLineHighlightName);
  runtime.registry.delete(matchHighlightName);
  runtime.registry.delete(activeHighlightName);
}

export function scrollRangeIntoView(range: Range | undefined) {
  if (!range) return;
  const container = range.startContainer;
  const element = container instanceof Element ? container : container.parentElement;
  element?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}

export function replaceRangesWithText(ranges: Range[], replacement: string) {
  for (let index = ranges.length - 1; index >= 0; index -= 1) {
    const range = ranges[index];
    range.deleteContents();
    if (replacement) range.insertNode(document.createTextNode(replacement));
  }
}
