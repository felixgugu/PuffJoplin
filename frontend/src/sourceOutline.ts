import { markdownLanguage } from '@codemirror/lang-markdown';
import type { EditorState } from '@codemirror/state';

export const sourceOutlineMinimumEditorWidth = 760;

export function sourceOutlineHasRoom(width: number): boolean {
  return width >= sourceOutlineMinimumEditorWidth;
}

export interface SourceHeading {
  id: string;
  level: number;
  from: number;
  to: number;
  lineNumber: number;
  label: string;
  children: SourceHeading[];
}

interface SourceRange {
  from: number;
  to: number;
}

const headingLevelByName = new Map<string, number>([
  ['ATXHeading1', 1],
  ['ATXHeading2', 2],
  ['ATXHeading3', 3],
  ['ATXHeading4', 4],
  ['ATXHeading5', 5],
  ['ATXHeading6', 6],
  ['SetextHeading1', 1],
  ['SetextHeading2', 2],
]);

const ignoredInlineNodeNames = new Set([
  'CodeMark',
  'EmphasisMark',
  'HTMLTag',
  'HeaderMark',
  'LinkMark',
  'StrikethroughMark',
]);

function isUrlHiddenByLink(node: {
  name: string;
  node: { parent: { name: string } | null };
}): boolean {
  if (node.name !== 'URL') return false;
  const parentName = node.node.parent?.name;
  return parentName === 'Link' || parentName === 'Image';
}

function textWithoutRanges(
  state: EditorState,
  from: number,
  to: number,
  ranges: SourceRange[],
): string {
  let text = '';
  let position = from;
  for (const range of ranges) {
    if (range.to <= from || range.from >= to) continue;
    const rangeFrom = Math.max(from, range.from);
    const rangeTo = Math.min(to, range.to);
    if (rangeFrom > position) text += state.doc.sliceString(position, rangeFrom);
    position = Math.max(position, rangeTo);
  }
  if (position < to) text += state.doc.sliceString(position, to);
  return text
    .replace(/~~/g, '')
    .replace(/\s+/g, ' ')
    .trim() || '空白標題';
}

export function markdownSourceHeadings(state: EditorState): SourceHeading[] {
  const records: Array<Omit<SourceHeading, 'children'>> = [];
  const hiddenRanges: SourceRange[] = [];
  const tree = markdownLanguage.parser.parse(state.doc.toString());

  tree.iterate({
    enter: (node) => {
      const level = headingLevelByName.get(node.name);
      if (level) {
        records.push({
          id: `source-heading-${node.from}`,
          level,
          from: node.from,
          to: node.to,
          lineNumber: state.doc.lineAt(node.from).number,
          label: '',
        });
        return;
      }
      if (ignoredInlineNodeNames.has(node.name) || isUrlHiddenByLink(node)) {
        hiddenRanges.push({ from: node.from, to: node.to });
      } else if (node.name === 'Escape') {
        hiddenRanges.push({ from: node.from, to: Math.min(node.from + 1, node.to) });
      }
    },
  });

  hiddenRanges.sort((left, right) => left.from - right.from || left.to - right.to);
  const roots: SourceHeading[] = [];
  const stack: SourceHeading[] = [];

  for (const record of records) {
    const heading: SourceHeading = {
      ...record,
      label: textWithoutRanges(state, record.from, record.to, hiddenRanges),
      children: [],
    };
    while (stack.length > 0 && stack[stack.length - 1].level >= heading.level) {
      stack.pop();
    }
    if (stack.length > 0) stack[stack.length - 1].children.push(heading);
    else roots.push(heading);
    stack.push(heading);
  }

  return roots;
}

export function flattenSourceHeadings(
  headings: readonly SourceHeading[],
): SourceHeading[] {
  const flattened: SourceHeading[] = [];
  const visit = (items: readonly SourceHeading[]) => {
    for (const heading of items) {
      flattened.push(heading);
      visit(heading.children);
    }
  };
  visit(headings);
  return flattened;
}

export function activeSourceHeading(
  headings: readonly SourceHeading[],
  position: number,
): SourceHeading | null {
  let active: SourceHeading | null = null;
  for (const heading of flattenSourceHeadings(headings)) {
    if (heading.from > position) break;
    active = heading;
  }
  return active;
}

interface SourceOutlineOptions {
  parent: HTMLElement;
  onJump: (heading: SourceHeading) => void;
  onRequestClose: () => void;
}

export class SourceOutline {
  readonly element: HTMLElement;

  private readonly content: HTMLElement;
  private readonly collapsed = new Set<string>();
  private readonly headingItems = new Map<string, HTMLButtonElement>();
  private readonly onJump: (heading: SourceHeading) => void;
  private headings: readonly SourceHeading[] = [];
  private activeID: string | null = null;
  private available = false;
  private open = false;

  constructor(options: SourceOutlineOptions) {
    this.onJump = options.onJump;
    this.element = document.createElement('section');
    this.element.className = 'source-outline-panel';
    this.element.id = `source-outline-${Math.random().toString(36).slice(2)}`;
    this.element.setAttribute('aria-label', '原始碼大綱側欄');
    this.element.hidden = true;

    const header = document.createElement('div');
    header.className = 'source-outline-header';
    const title = document.createElement('strong');
    title.className = 'source-outline-title';
    title.textContent = '大綱';
    const close = document.createElement('button');
    close.className = 'source-outline-close';
    close.type = 'button';
    close.textContent = '×';
    close.title = '關閉大綱';
    close.setAttribute('aria-label', '關閉原始碼大綱側欄');
    close.addEventListener('click', () => options.onRequestClose());
    header.append(title, close);

    this.content = document.createElement('nav');
    this.content.className = 'source-outline-content';
    this.content.setAttribute('aria-label', '原始碼大綱');
    this.element.append(header, this.content);
    options.parent.prepend(this.element);
  }

  setAvailable(available: boolean) {
    this.available = available;
    this.syncVisibility();
  }

  setOpen(open: boolean) {
    this.open = open;
    this.syncVisibility();
  }

  setState(
    headings: readonly SourceHeading[],
    activeHeading: SourceHeading | null,
  ) {
    if (this.headings !== headings) {
      this.headings = headings;
      this.render();
    }
    this.activeID = activeHeading?.id ?? null;
    this.syncActiveHeading();
  }

  destroy() {
    this.element.remove();
    this.headingItems.clear();
  }

  private syncVisibility() {
    this.element.hidden = !(this.available && this.open);
    if (!this.element.hidden) this.syncActiveHeading();
  }

  private render() {
    this.content.replaceChildren();
    this.headingItems.clear();
    if (this.headings.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'source-outline-empty';
      empty.textContent = '此筆記沒有標題';
      this.content.append(empty);
      return;
    }
    this.content.append(this.renderLevel(this.headings));
  }

  private renderLevel(headings: readonly SourceHeading[]): HTMLUListElement {
    const list = document.createElement('ul');
    list.className = 'source-outline-list';
    for (const heading of headings) {
      const item = document.createElement('li');
      item.className = 'source-outline-node';
      const row = document.createElement('div');
      row.className = 'source-outline-row';
      row.style.setProperty('--source-outline-level', String(heading.level));

      const hasChildren = heading.children.length > 0;
      const fold = document.createElement('button');
      fold.className = 'source-outline-fold';
      fold.type = 'button';
      fold.textContent = hasChildren ? '▾' : '';
      fold.disabled = !hasChildren;
      fold.setAttribute('aria-hidden', String(!hasChildren));
      if (hasChildren) {
        fold.setAttribute('aria-label', `收合 ${heading.label}`);
        fold.setAttribute('aria-expanded', 'true');
        fold.addEventListener('click', () => {
          const collapsed = !this.collapsed.has(heading.id);
          if (collapsed) this.collapsed.add(heading.id);
          else this.collapsed.delete(heading.id);
          fold.textContent = collapsed ? '›' : '▾';
          fold.setAttribute('aria-expanded', String(!collapsed));
          fold.setAttribute('aria-label', `${collapsed ? '展開' : '收合'} ${heading.label}`);
          childList.hidden = collapsed;
        });
      }

      const button = document.createElement('button');
      button.className = 'source-outline-item';
      button.type = 'button';
      button.textContent = heading.label;
      button.title = heading.label;
      button.dataset.headingId = heading.id;
      button.addEventListener('click', () => this.onJump(heading));

      row.append(fold, button);
      item.append(row);
      this.headingItems.set(heading.id, button);

      let childList: HTMLUListElement;
      if (hasChildren) {
        childList = this.renderLevel(heading.children);
        childList.hidden = this.collapsed.has(heading.id);
        item.append(childList);
      }
      list.append(item);
    }
    return list;
  }

  private syncActiveHeading() {
    for (const [id, item] of this.headingItems) {
      const active = id === this.activeID;
      item.classList.toggle('is-active', active);
      if (active) item.setAttribute('aria-current', 'location');
      else item.removeAttribute('aria-current');
    }
    if (this.element.hidden || !this.activeID) return;
    const active = this.headingItems.get(this.activeID);
    if (!active || active.closest('[hidden]')) return;
    const contentRect = this.content.getBoundingClientRect();
    const activeRect = active.getBoundingClientRect();
    if (activeRect.top < contentRect.top) {
      this.content.scrollTop -= contentRect.top - activeRect.top;
    } else if (activeRect.bottom > contentRect.bottom) {
      this.content.scrollTop += activeRect.bottom - contentRect.bottom;
    }
  }
}
