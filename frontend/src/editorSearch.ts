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

export interface SearchableTextMap {
  text: string;
  characters: Array<TextCharacter | null>;
}

const matchHighlightName = 'puffjoplin-find-match';
const activeHighlightName = 'puffjoplin-find-active';
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
  let text = '';
  let previousBlock: Element | null = null;
  let node = walker.nextNode();
  while (node) {
    const textNode = node as Text;
    if (textNodeIsSearchable(textNode, root)) {
      const block = textNode.parentElement?.closest(textBlockSelector) || root;
      if (text && block !== previousBlock) {
        text += '\n';
        characters.push(null);
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
  return { text, characters };
}

export function rangesForTextMatches(
  textMap: SearchableTextMap,
  matches: EditorTextMatch[],
): Range[] {
  const ranges: Range[] = [];
  for (const match of matches) {
    let first: TextCharacter | null = null;
    for (let index = match.start; index < match.end; index += 1) {
      if (textMap.characters[index]) {
        first = textMap.characters[index];
        break;
      }
    }
    let last: TextCharacter | null = null;
    for (let index = match.end - 1; index >= match.start; index -= 1) {
      if (textMap.characters[index]) {
        last = textMap.characters[index];
        break;
      }
    }
    if (!first || !last) continue;
    const range = document.createRange();
    range.setStart(first.node, first.offset);
    range.setEnd(last.node, last.offset + 1);
    ranges.push(range);
  }
  return ranges;
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

export function applySearchHighlights(ranges: Range[], activeIndex: number): boolean {
  const runtime = highlightRuntime();
  if (!runtime) return false;
  const { Highlight, registry } = runtime;
  registry.set(matchHighlightName, new Highlight(...ranges));
  const activeRange = ranges[activeIndex];
  if (activeRange) {
    registry.set(activeHighlightName, new Highlight(activeRange));
  } else {
    registry.delete(activeHighlightName);
  }
  return true;
}

export function clearSearchHighlights() {
  const runtime = highlightRuntime();
  if (!runtime) return;
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
