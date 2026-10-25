import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
  redo,
  undo,
} from '@codemirror/commands';
import { markdown } from '@codemirror/lang-markdown';
import {
  bracketMatching,
  foldGutter,
  foldKeymap,
  HighlightStyle,
  indentOnInput,
  syntaxHighlighting,
} from '@codemirror/language';
import { Compartment, EditorState } from '@codemirror/state';
import {
  drawSelection,
  dropCursor,
  EditorView,
  highlightSpecialChars,
  keymap,
  lineNumbers,
  placeholder,
  rectangularSelection,
} from '@codemirror/view';
import { tags } from '@lezer/highlight';

function foldMarkerDOM(open: boolean): HTMLElement {
  const marker = document.createElement('span');
  marker.className = `puff-fold-marker ${open ? 'is-open' : 'is-closed'}`;
  marker.textContent = open ? '▾' : '›';
  marker.title = open ? '收合' : '展開';
  marker.setAttribute('aria-label', marker.title);
  return marker;
}

const markdownHighlightStyle = HighlightStyle.define([
  { tag: tags.heading, color: 'var(--source-heading)', fontWeight: '650' },
  { tag: tags.strong, color: 'var(--source-strong)', fontWeight: '700' },
  { tag: tags.emphasis, color: 'var(--source-emphasis)', fontStyle: 'italic' },
  { tag: tags.link, color: 'var(--source-link)' },
  { tag: tags.url, color: 'var(--source-link)' },
  { tag: tags.monospace, color: 'var(--source-code)' },
  { tag: tags.quote, color: 'var(--source-quote)', fontStyle: 'italic' },
  { tag: tags.meta, color: 'var(--source-meta)' },
  { tag: tags.processingInstruction, color: 'var(--source-meta)' },
  { tag: tags.contentSeparator, color: 'var(--source-meta)', fontWeight: '700' },
  { tag: tags.list, color: 'var(--accent)', fontWeight: '600' },
  { tag: tags.labelName, color: 'var(--source-string)' },
  { tag: tags.string, color: 'var(--source-string)' },
]);

const editorTheme = EditorView.theme({
  '&': {
    height: '100%',
    backgroundColor: 'transparent',
    color: 'var(--text)',
  },
  '&.cm-focused': {
    outline: 'none',
  },
  '.cm-scroller': {
    overflow: 'auto',
    fontFamily: 'var(--font-family-code)',
    fontSize: '1rem',
    lineHeight: '1.75',
  },
  '.cm-content': {
    minHeight: '100%',
    padding: '24px var(--editor-inline-padding) 90px',
    caretColor: 'var(--text)',
  },
  '.cm-line': {
    padding: '0',
  },
  '.cm-gutters': {
    border: 'none',
    backgroundColor: 'transparent',
    color: 'var(--faint)',
    userSelect: 'none',
  },
  '.cm-lineNumbers .cm-gutterElement': {
    minWidth: '2.6em',
    padding: '0 10px 0 12px',
    textAlign: 'right',
  },
  '.cm-foldGutter .cm-gutterElement': {
    minWidth: '18px',
    padding: '0 2px',
    color: 'var(--muted)',
    textAlign: 'center',
  },
  '.puff-fold-marker': {
    display: 'inline-flex',
    width: '16px',
    height: '18px',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '4px',
    lineHeight: '1',
  },
  '.puff-fold-marker:hover': {
    backgroundColor: 'var(--surface-hover)',
    color: 'var(--accent)',
  },
  '.cm-foldPlaceholder': {
    margin: '0 2px',
    padding: '0 7px',
    border: '1px solid color-mix(in srgb, var(--accent) 22%, var(--line))',
    borderRadius: '999px',
    backgroundColor: 'var(--accent-soft)',
    color: 'var(--accent)',
    cursor: 'pointer',
  },
  '.cm-foldPlaceholder:hover': {
    borderColor: 'color-mix(in srgb, var(--accent) 46%, var(--line))',
  },
  '.cm-activeLine': {
    backgroundColor: 'transparent',
  },
  '.cm-cursor': {
    borderLeftColor: 'var(--text)',
  },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': {
    backgroundColor: 'color-mix(in srgb, var(--accent) 28%, transparent)',
  },
  '.cm-placeholder': {
    color: 'var(--faint)',
  },
  '.cm-tooltip': {
    border: '1px solid var(--line)',
    backgroundColor: 'var(--panel-strong)',
    color: 'var(--text)',
  },
});

export interface CodeMirrorSelection {
  from: number;
  to: number;
}

export interface CodeMirrorLineActivation {
  lineNumber: number;
  text: string;
  anchor: {
    left: number;
    right: number;
    top: number;
    bottom: number;
  };
}

export function markdownHeadingText(source: string, level: number): string {
  const safeLevel = Math.max(1, Math.min(6, Math.round(level)));
  return source
    .split('\n')
    .map((line) => `${'#'.repeat(safeLevel)} ${line.replace(/^#{1,6}\s+/, '')}`)
    .join('\n');
}

export interface CodeMirrorSourceOptions {
  parent: HTMLElement;
  textarea: HTMLTextAreaElement;
  value: string;
  showLineNumbers: boolean;
  onChange: (markdown: string) => void;
  onBlur: () => void;
  onScroll: () => void;
  onLineActivate?: (line: CodeMirrorLineActivation | null) => void;
}

export class CodeMirrorSource {
  readonly view: EditorView;
  readonly element: HTMLElement;
  readonly scrollElement: HTMLElement;

  private readonly textarea: HTMLTextAreaElement;
  private readonly onChange: (markdown: string) => void;
  private readonly onLineActivate?: (line: CodeMirrorLineActivation | null) => void;
  private readonly lineNumbersCompartment = new Compartment();
  private applyingExternal = false;
  private destroyed = false;

  constructor(options: CodeMirrorSourceOptions) {
    this.textarea = options.textarea;
    this.onChange = options.onChange;
    this.onLineActivate = options.onLineActivate;
    this.element = document.createElement('div');
    this.element.className = 'puff-codemirror-source';
    const preview = Array.from(options.parent.children).find(
      (element) => element.classList.contains('vditor-preview'),
    );
    options.parent.insertBefore(this.element, preview || null);

    this.view = new EditorView({
      parent: this.element,
      state: EditorState.create({
        doc: options.value,
        extensions: [
          history(),
          drawSelection(),
          dropCursor(),
          rectangularSelection(),
          highlightSpecialChars(),
          bracketMatching(),
          indentOnInput(),
          EditorState.phrases.of({
            'folded code': '已折疊內容',
            unfold: '展開',
          }),
          foldGutter({ markerDOM: foldMarkerDOM }),
          this.lineNumbersCompartment.of(options.showLineNumbers ? lineNumbers() : []),
          markdown(),
          syntaxHighlighting(markdownHighlightStyle),
          EditorView.lineWrapping,
          EditorState.allowMultipleSelections.of(true),
          placeholder('以 Markdown 開始書寫，或直接貼上圖片…'),
          EditorView.contentAttributes.of({
            'aria-label': 'Markdown 原始碼編輯器',
            spellcheck: 'false',
          }),
          EditorView.domEventHandlers({
            blur: () => {
              if (!this.destroyed) options.onBlur();
            },
            mousedown: (event, view) => {
              if (
                event.button !== 0 ||
                !(event.target instanceof Node) ||
                !view.contentDOM.contains(event.target)
              ) {
                return;
              }
              const position = view.posAtCoords({ x: event.clientX, y: event.clientY });
              if (position === null) return;
              const line = view.state.doc.lineAt(position);
              const coordinates = view.coordsAtPos(line.from);
              if (!coordinates) return;
              this.onLineActivate?.({
                lineNumber: line.number,
                text: line.text,
                anchor: {
                  left: event.clientX,
                  right: event.clientX,
                  top: coordinates.top,
                  bottom: coordinates.bottom,
                },
              });
            },
          }),
          EditorView.updateListener.of((update) => {
            if (!update.docChanged && !update.selectionSet) return;
            this.syncMirror();
            if (!update.docChanged || this.applyingExternal) return;
            this.onLineActivate?.(null);
            this.onChange(update.state.doc.toString());
          }),
          keymap.of([
            ...defaultKeymap,
            ...historyKeymap,
            ...foldKeymap,
            indentWithTab,
          ]),
          editorTheme,
        ],
      }),
    });
    this.scrollElement = this.view.scrollDOM;

    this.view.scrollDOM.addEventListener('scroll', () => {
      this.onLineActivate?.(null);
      options.onScroll();
    }, { passive: true });
    this.syncMirror();
  }

  getValue(): string {
    return this.view.state.doc.toString();
  }

  setValue(
    value: string,
    selection?: CodeMirrorSelection,
    scrollTop?: number,
  ) {
    if (this.destroyed) return;
    this.applyingExternal = true;
    const current = this.getValue();
    if (current !== value) {
      const anchor = Math.max(0, Math.min(
        selection?.from ?? this.view.state.selection.main.from,
        value.length,
      ));
      const head = Math.max(0, Math.min(
        selection?.to ?? this.view.state.selection.main.to,
        value.length,
      ));
      this.view.dispatch({
        changes: { from: 0, to: current.length, insert: value },
        selection: { anchor, head },
      });
    } else if (selection) {
      this.view.dispatch({
        selection: {
          anchor: Math.max(0, Math.min(selection.from, value.length)),
          head: Math.max(0, Math.min(selection.to, value.length)),
        },
      });
    }
    this.applyingExternal = false;
    this.syncMirror();
    if (scrollTop !== undefined) this.scrollElement.scrollTop = scrollTop;
  }

  getSelection(): CodeMirrorSelection {
    const range = this.view.state.selection.main;
    return { from: range.from, to: range.to };
  }

  setShowLineNumbers(visible: boolean) {
    if (this.destroyed) return;
    this.view.dispatch({
      effects: this.lineNumbersCompartment.reconfigure(visible ? lineNumbers() : []),
    });
  }

  selectRange(from: number, to: number, scroll = true) {
    const safeFrom = Math.max(0, Math.min(from, this.view.state.doc.length));
    const safeTo = Math.max(safeFrom, Math.min(to, this.view.state.doc.length));
    this.view.dispatch({
      selection: { anchor: safeFrom, head: safeTo },
      effects: scroll ? EditorView.scrollIntoView(safeFrom, { y: 'center' }) : undefined,
    });
    this.view.focus();
    this.syncMirror();
  }

  replaceRange(from: number, to: number, text: string) {
    const safeFrom = Math.max(0, Math.min(from, this.view.state.doc.length));
    const safeTo = Math.max(safeFrom, Math.min(to, this.view.state.doc.length));
    this.view.dispatch({
      changes: { from: safeFrom, to: safeTo, insert: text },
      selection: { anchor: safeFrom + text.length },
    });
    this.view.focus();
  }

  replaceRanges(ranges: ReadonlyArray<CodeMirrorSelection>, text: string) {
    if (ranges.length === 0) return;
    const ordered = [...ranges].sort((left, right) => right.from - left.from);
    this.view.dispatch({
      changes: ordered.map((range) => ({
        from: range.from,
        to: range.to,
        insert: text,
      })),
      selection: { anchor: ordered[ordered.length - 1].from + text.length },
    });
    this.view.focus();
  }

  applyHeading(level: number) {
    const selection = this.view.state.selection.main;
    const firstLine = this.view.state.doc.lineAt(selection.from);
    const lastLine = this.view.state.doc.lineAt(selection.to);
    const source = this.view.state.sliceDoc(firstLine.from, lastLine.to);
    const replacement = markdownHeadingText(source, level);
    this.view.dispatch({
      changes: { from: firstLine.from, to: lastLine.to, insert: replacement },
      selection: {
        anchor: firstLine.from,
        head: firstLine.from + replacement.length,
      },
      effects: EditorView.scrollIntoView(firstLine.from, { y: 'nearest' }),
    });
    this.view.focus();
  }

  focus() {
    this.view.focus();
  }

  setVisible(visible: boolean) {
    this.element.classList.toggle('is-visible', visible);
  }

  scrollByPage(direction: -1 | 1) {
    const scroller = this.scrollElement;
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    scroller.scrollBy({
      top: direction * Math.max(120, scroller.clientHeight * 0.9),
      behavior: reducedMotion ? 'auto' : 'smooth',
    });
  }

  undo() {
    undo(this.view);
    this.view.focus();
  }

  redo() {
    redo(this.view);
    this.view.focus();
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.onLineActivate?.(null);
    this.view.destroy();
    this.element.remove();
  }

  private syncMirror() {
    const selection = this.getSelection();
    this.textarea.value = this.getValue();
    this.textarea.setSelectionRange(selection.from, selection.to);
  }
}
