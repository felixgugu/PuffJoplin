import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import Vditor from 'vditor';
import 'vditor/dist/index.css';
import { api } from './api';
import { CodeMirrorSource } from './codeMirrorSource';
import { installDiagramGuards } from './diagramGuards';
import { parseEditorMode, type EditorMode, type EditorPreviewMode } from './editorTabs';
import EditorFindPanel from './EditorFindPanel';
import EditorMediaContextMenu, {
  type EditorMediaContextTarget,
} from './EditorMediaContextMenu';
import TextColorPalette from './TextColorPalette';
import { toolbarIcon, type ToolbarIconName } from './toolbarIcons';
import { EditorViewportController } from './editorViewportController';
import {
  applySearchHighlights,
  clearSearchHighlights,
  createSearchableTextMap,
  findTextMatches,
  rangesForTextMatches,
  replaceRangesWithText,
  scrollRangeIntoView,
  type EditorTextMatch,
} from './editorSearch';
import {
  clipboardImageFilename,
  localImageResourceID,
  mermaidClipboardFilename,
  rasterizeImageToPng,
} from './imageClipboard';
import { extractMermaidBlocks } from './mermaidBlocks';
import { bytesToBase64, renderMermaidImage } from './mermaidExport';
import { pageScrollDistance, pageScrollState } from './pageNavigation';
import { toEditorMarkdown, toStoredMarkdown } from './resourceUrls';
import {
  applySourceTextColor,
  clearTextColorHighlights,
  decorateTextColorMarkers,
  extractColorMarkerTemplates,
  insertColorMarkers,
  removeDomTextColor,
  removeDomTextColorMarkers,
  removeSourceTextColor,
  TEXT_COLORS,
  type TextColorSelection,
} from './textColor';
import type { Resource } from './types';

const vditorRoot = '/vditor/dist';
const contentThemePath = `${vditorRoot}/css/content-theme`;
const maxUploadBytes = 50 * 1024 * 1024;

function toolbarIconItem(name: ToolbarIconName) {
  return { name, icon: toolbarIcon(name) };
}

function uploadErrorMessage(value: string): string {
  try {
    const response = JSON.parse(value) as { msg?: unknown };
    if (typeof response.msg === 'string' && response.msg.trim()) return response.msg;
  } catch {
    // Vditor may pass a plain response or a transport error.
  }
  return value || '請稍後再試';
}

function applyEditorTheme(editor: Vditor, theme: 'light' | 'dark') {
  if (!editor.vditor) return;
  const dark = theme === 'dark';
  editor.setTheme(
    dark ? 'dark' : 'classic',
    dark ? 'dark' : 'light',
    dark ? 'github-dark' : 'github',
    contentThemePath,
  );
}

function applyToolbarTitles(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>('.vditor-toolbar [aria-label]').forEach((element) => {
    const label = element.getAttribute('aria-label')?.trim() || '';
    if (label && element.title !== label) element.title = label;
  });
}

function currentEditorPreviewMode(editor: Vditor): EditorPreviewMode {
  return editor.vditor?.options.preview?.mode === 'both' ? 'both' : 'editor';
}

const directEditorModes: Array<[string, EditorMode]> = [
  ['wysiwyg-mode', 'wysiwyg'],
  ['ir-mode', 'ir'],
  ['source-mode', 'sv'],
];

function editorModeButton(editor: Vditor, name: string): HTMLButtonElement | null {
  const item = editor.vditor?.toolbar?.elements?.[name];
  if (!item) return null;
  if (item instanceof HTMLButtonElement) return item;
  return item.querySelector<HTMLButtonElement>('button');
}

function syncEditorModeButtons(editor: Vditor) {
  const mode = editor.getCurrentMode();
  for (const [name, buttonMode] of directEditorModes) {
    const button = editorModeButton(editor, name);
    if (!button) continue;
    const active = mode === buttonMode;
    button.classList.toggle('vditor-menu--current', active);
    button.setAttribute('aria-pressed', String(active));
  }
}

function activateEditorMode(editor: Vditor, mode: EditorMode) {
  const controller = editor.vditor?.toolbar?.elements?.['edit-mode'];
  const target = controller?.querySelector<HTMLButtonElement>(
    `button[data-mode="${mode}"]`,
  );
  if (editor.getCurrentMode() !== mode) target?.click();
  if (mode === 'sv') {
    editor.setPreviewMode('editor');
  } else {
    if (editor.vditor?.options.preview) editor.vditor.options.preview.mode = 'editor';
    const preview = editor.vditor?.preview?.element;
    if (preview) preview.style.display = 'none';
    const hideRichModePreview = () => {
      if (editor.getCurrentMode() !== mode || editor.getCurrentMode() === 'sv') return;
      const previewButton = editor.vditor?.toolbar?.elements?.['preview']
        ?.querySelector<HTMLButtonElement>('button[data-type="preview"]');
      if (previewButton?.classList.contains('vditor-menu--current')) return;
      if (editor.vditor?.options.preview) editor.vditor.options.preview.mode = 'editor';
      const currentPreview = editor.vditor?.preview?.element;
      if (currentPreview) {
        currentPreview.style.display = 'none';
        const content = currentPreview.parentElement;
        if (content) content.dataset.puffPreviewHidden = 'true';
        currentPreview.closest<HTMLElement>('.vditor-editor-host')?.setAttribute(
          'data-puff-preview-hidden',
          'true',
        );
      }
      window.dispatchEvent(new Event('resize'));
    };
    window.requestAnimationFrame(hideRichModePreview);
    window.setTimeout(hideRichModePreview, 50);
  }
  syncEditorModeButtons(editor);
}

function clipboardHasImage(event: ClipboardEvent): boolean {
  const data = event.clipboardData;
  if (!data) return false;
  return Array.from(data.items).some(
    (item) => item.kind === 'file' && item.type.startsWith('image/'),
  ) || Array.from(data.files).some((file) => file.type.startsWith('image/'));
}

function clipboardImageMarkdown(resource: Resource): string {
  const name = resource.filename.replace(/[\\[\]]/g, '\\$&');
  return `![${name}](${resource.url})`;
}

interface VditorEditorProps {
  noteID: string;
  noteTitle: string;
  initialMode: EditorMode;
  initialPreviewMode: EditorPreviewMode;
  active: boolean;
  value: string;
  uploadToken: string;
  storageKind: 'database' | 'directory';
  resources: Resource[];
  theme: 'light' | 'dark';
  showSourceLineNumbers: boolean;
  onChange: (value: string) => void;
  onBlur: () => void;
  onModeChange: (mode: EditorMode) => void;
  onPreviewModeChange: (mode: EditorPreviewMode) => void;
}

export interface VditorEditorHandle {
  getHTML: () => string | null;
}

const VditorEditor = forwardRef<VditorEditorHandle, VditorEditorProps>(function VditorEditor({
  noteID,
  noteTitle,
  initialMode,
  initialPreviewMode,
  active,
  value,
  uploadToken,
  storageKind,
  resources,
  theme,
  showSourceLineNumbers,
  onChange,
  onBlur,
  onModeChange,
  onPreviewModeChange,
}, ref) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<Vditor | null>(null);
  const readyRef = useRef(false);
  const initialValueRef = useRef(value);
  const initialModeRef = useRef(initialMode);
  const initialPreviewModeRef = useRef(initialPreviewMode);
  const themeRef = useRef(theme);
  const showSourceLineNumbersRef = useRef(showSourceLineNumbers);
  const onChangeRef = useRef(onChange);
  const onBlurRef = useRef(onBlur);
  const onModeChangeRef = useRef(onModeChange);
  const onPreviewModeChangeRef = useRef(onPreviewModeChange);
  const pastingRef = useRef(false);
  const storageKindRef = useRef(storageKind);
  const resourcesRef = useRef(resources);
  const valueRef = useRef(value);
  const noteTitleRef = useRef(noteTitle);
  const lastValueRef = useRef(value);
  const applyingExternalValueRef = useRef(false);
  const [findOpen, setFindOpen] = useState(false);
  const [findQuery, setFindQuery] = useState('');
  const [findReplacement, setFindReplacement] = useState('');
  const [findMatchCase, setFindMatchCase] = useState(false);
  const [findWholeWord, setFindWholeWord] = useState(false);
  const [findMatchCount, setFindMatchCount] = useState(0);
  const [findActiveIndex, setFindActiveIndex] = useState(0);
  const [mediaContext, setMediaContext] = useState<EditorMediaContextTarget | null>(null);
  const [mediaBusy, setMediaBusy] = useState(false);
  const [textColorPalette, setTextColorPalette] = useState<{ x: number; y: number } | null>(null);
  const [textColor, setTextColor] = useState(TEXT_COLORS[10].value);
  const findQueryInputRef = useRef<HTMLInputElement | null>(null);
  const findReplacementInputRef = useRef<HTMLInputElement | null>(null);
  const findActiveIndexRef = useRef(0);
  const findRangesRef = useRef<Range[]>([]);
  const findSourceMatchesRef = useRef<EditorTextMatch[]>([]);
  const findSourceTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const refreshFindRef = useRef<(resetActive: boolean) => void>(() => undefined);
  const openFindRef = useRef<(field: 'query' | 'replace') => void>(() => undefined);
  const closeFindRef = useRef<() => void>(() => undefined);
  const scrollEditorPageRef = useRef<(direction: -1 | 1) => void>(() => undefined);
  const refreshPageNavigationRef = useRef<() => void>(() => undefined);
  const lastDomTextRangeRef = useRef<Range | null>(null);
  const textColorSelectionRef = useRef<TextColorSelection | null>(null);
  const openTextColorPaletteRef = useRef<(anchor: HTMLElement) => void>(() => undefined);
  const refreshTextColorMarkersRef = useRef<() => void>(() => undefined);
  const refreshEditorViewportRef = useRef<() => void>(() => undefined);
  const sourceEditorRef = useRef<CodeMirrorSource | null>(null);
  const initializeSourceEditorRef = useRef<() => void>(() => undefined);
  const refreshSourceEditorRef = useRef<() => void>(() => undefined);

  themeRef.current = theme;
  showSourceLineNumbersRef.current = showSourceLineNumbers;
  onChangeRef.current = onChange;
  onBlurRef.current = onBlur;
  onModeChangeRef.current = onModeChange;
  onPreviewModeChangeRef.current = onPreviewModeChange;
  storageKindRef.current = storageKind;
  resourcesRef.current = resources;
  valueRef.current = value;
  noteTitleRef.current = noteTitle;

  const setFindActiveMatch = useCallback((index: number) => {
    findActiveIndexRef.current = index;
    setFindActiveIndex(index);
  }, []);

  const revealSourceMatch = useCallback((
    textarea: HTMLTextAreaElement,
    matches: EditorTextMatch[],
    index: number,
  ) => {
    const match = matches[index];
    if (!match) return;
    textarea.setSelectionRange(match.start, match.end);
    const line = textarea.value.slice(0, match.start).split('\n').length - 1;
    const lineHeight = Number.parseFloat(window.getComputedStyle(textarea).lineHeight) || 22;
    textarea.scrollTop = Math.max(0, line * lineHeight - textarea.clientHeight / 2);
  }, []);

  const refreshFind = useCallback((resetActive: boolean) => {
    const editor = editorRef.current;
    if (!findOpen || !readyRef.current || !editor) {
      clearSearchHighlights();
      findRangesRef.current = [];
      findSourceMatchesRef.current = [];
      setFindMatchCount(0);
      setFindActiveMatch(0);
      return;
    }
    const requestedIndex = resetActive ? 0 : findActiveIndexRef.current;
    if (editor.getCurrentMode() === 'sv') {
      if (sourceEditorRef.current) {
        const matches = findTextMatches(sourceEditorRef.current.getValue(), findQuery, {
          matchCase: findMatchCase,
          wholeWord: findWholeWord,
        });
        clearSearchHighlights();
        findRangesRef.current = [];
        findSourceMatchesRef.current = matches;
        findSourceTextareaRef.current = null;
        const index = matches.length === 0
          ? 0
          : Math.max(0, Math.min(requestedIndex, matches.length - 1));
        setFindMatchCount(matches.length);
        setFindActiveMatch(index);
        const match = matches[index];
        if (match) sourceEditorRef.current.selectRange(match.start, match.end);
        return;
      }
      const textarea = editor.vditor.sv?.element;
      if (!textarea) return;
      const matches = findTextMatches(textarea.value, findQuery, {
        matchCase: findMatchCase,
        wholeWord: findWholeWord,
      });
      clearSearchHighlights();
      findRangesRef.current = [];
      findSourceMatchesRef.current = matches;
      findSourceTextareaRef.current = textarea;
      const index = matches.length === 0
        ? 0
        : Math.max(0, Math.min(requestedIndex, matches.length - 1));
      setFindMatchCount(matches.length);
      setFindActiveMatch(index);
      revealSourceMatch(textarea, matches, index);
      return;
    }

    findSourceMatchesRef.current = [];
    findSourceTextareaRef.current = null;
    const mode = editor.getCurrentMode();
    const root = mode === 'wysiwyg'
      ? editor.vditor.wysiwyg?.element
      : editor.vditor.ir?.element;
    if (!root) return;
    const textMap = createSearchableTextMap(root);
    const textMatches = findTextMatches(textMap.text, findQuery, {
      matchCase: findMatchCase,
      wholeWord: findWholeWord,
    });
    const ranges = rangesForTextMatches(textMap, textMatches);
    const index = ranges.length === 0
      ? 0
      : Math.max(0, Math.min(requestedIndex, ranges.length - 1));
    findRangesRef.current = ranges;
    setFindMatchCount(ranges.length);
    setFindActiveMatch(index);
    if (ranges.length > 0) {
      applySearchHighlights(ranges, index);
      scrollRangeIntoView(ranges[index]);
    } else {
      clearSearchHighlights();
    }
  }, [
    findMatchCase,
    findOpen,
    findQuery,
    findWholeWord,
    revealSourceMatch,
    setFindActiveMatch,
  ]);
  refreshFindRef.current = refreshFind;

  const openFindPanel = useCallback((field: 'query' | 'replace') => {
    const selection = editorRef.current?.getSelection()?.trim() || '';
    if (selection && !selection.includes('\n') && selection.length <= 200) {
      setFindQuery(selection);
    }
    setFindOpen(true);
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        const input = field === 'replace'
          ? findReplacementInputRef.current
          : findQueryInputRef.current;
        input?.focus();
        input?.select();
      });
    });
  }, []);
  openFindRef.current = openFindPanel;

  const closeFindPanel = useCallback(() => {
    setFindOpen(false);
    setFindQuery('');
    setFindReplacement('');
    setFindMatchCase(false);
    setFindWholeWord(false);
    setFindMatchCount(0);
    setFindActiveMatch(0);
    findRangesRef.current = [];
    findSourceMatchesRef.current = [];
    findSourceTextareaRef.current = null;
    clearSearchHighlights();
  }, [setFindActiveMatch]);
  closeFindRef.current = closeFindPanel;

  const navigateFind = useCallback((direction: -1 | 1) => {
    const count = findMatchCount;
    if (count === 0) {
      refreshFindRef.current(true);
      return;
    }
    const index = (findActiveIndexRef.current + direction + count) % count;
    setFindActiveMatch(index);
    if (editorRef.current?.getCurrentMode() === 'sv' && sourceEditorRef.current) {
      const match = findSourceMatchesRef.current[index];
      if (match) sourceEditorRef.current.selectRange(match.start, match.end);
      return;
    }
    if (findSourceTextareaRef.current) {
      revealSourceMatch(
        findSourceTextareaRef.current,
        findSourceMatchesRef.current,
        index,
      );
      return;
    }
    applySearchHighlights(findRangesRef.current, index);
    scrollRangeIntoView(findRangesRef.current[index]);
  }, [findMatchCount, revealSourceMatch, setFindActiveMatch]);

  const dispatchEditorInput = useCallback((
    element: HTMLElement | HTMLTextAreaElement,
    replacement: string,
  ) => {
    element.dispatchEvent(new InputEvent('input', {
      bubbles: true,
      inputType: 'insertReplacementText',
      data: replacement,
    }));
  }, []);

  const replaceFindMatch = useCallback(() => {
    const editor = editorRef.current;
    if (!editor || findMatchCount === 0) return;
    if (editor.getCurrentMode() === 'sv') {
      const match = findSourceMatchesRef.current[findActiveIndexRef.current];
      if (!match) return;
      if (sourceEditorRef.current) {
        sourceEditorRef.current.replaceRange(match.start, match.end, findReplacement);
        window.setTimeout(() => {
          refreshFindRef.current(true);
          findReplacementInputRef.current?.focus();
        }, 30);
        return;
      }
      const textarea = editor.vditor.sv?.element;
      if (!textarea) return;
      textarea.setRangeText(findReplacement, match.start, match.end, 'end');
      dispatchEditorInput(textarea, findReplacement);
    } else {
      const range = findRangesRef.current[findActiveIndexRef.current];
      if (!range) return;
      const mode = editor.getCurrentMode();
      const root = mode === 'wysiwyg'
        ? editor.vditor.wysiwyg?.element
        : editor.vditor.ir?.element;
      if (!root) return;
      root.focus({ preventScroll: true });
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      if (findReplacement) {
        document.execCommand('insertText', false, findReplacement);
      } else {
        document.execCommand('delete', false);
      }
    }
    window.setTimeout(() => {
      refreshFindRef.current(true);
      findReplacementInputRef.current?.focus();
    }, 30);
  }, [dispatchEditorInput, findMatchCount, findReplacement]);

  const replaceAllFindMatches = useCallback(() => {
    const editor = editorRef.current;
    if (!editor || findMatchCount === 0 || findReplacement === findQuery) return;
    if (editor.getCurrentMode() === 'sv') {
      if (sourceEditorRef.current) {
        sourceEditorRef.current.replaceRanges(
          findSourceMatchesRef.current.map((match) => ({
            from: match.start,
            to: match.end,
          })),
          findReplacement,
        );
        window.setTimeout(() => {
          refreshFindRef.current(true);
          findReplacementInputRef.current?.focus();
        }, 30);
        return;
      }
      const textarea = editor.vditor.sv?.element;
      if (!textarea) return;
      const matches = findSourceMatchesRef.current;
      for (let index = matches.length - 1; index >= 0; index -= 1) {
        const match = matches[index];
        textarea.setRangeText(findReplacement, match.start, match.end, 'end');
      }
      dispatchEditorInput(textarea, findReplacement);
    } else {
      const mode = editor.getCurrentMode();
      const root = mode === 'wysiwyg'
        ? editor.vditor.wysiwyg?.element
        : editor.vditor.ir?.element;
      if (!root) return;
      const ranges = [...findRangesRef.current];
      replaceRangesWithText(ranges, findReplacement);
      root.focus({ preventScroll: true });
      const anchor = ranges[0]?.cloneRange();
      if (anchor) {
        anchor.collapse(true);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(anchor);
      }
      dispatchEditorInput(root, findReplacement);
    }
    window.setTimeout(() => {
      refreshFindRef.current(true);
      findReplacementInputRef.current?.focus();
    }, 30);
  }, [
    dispatchEditorInput,
    findMatchCount,
    findQuery,
    findReplacement,
  ]);

  const captureTextColorSelection = useCallback(() => {
    const editor = editorRef.current;
    if (!editor?.vditor || editor.getCurrentMode() === 'sv') return;
    const mode = editor.getCurrentMode();
    const root = mode === 'wysiwyg'
      ? editor.vditor.wysiwyg?.element
      : editor.vditor.ir?.element;
    const selection = window.getSelection();
    if (!root || !selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) return;
    lastDomTextRangeRef.current = range.cloneRange();
  }, []);

  const openTextColorPalette = useCallback((anchor: HTMLElement) => {
    const editor = editorRef.current;
    if (!editor?.vditor) return;
    if (editor.getCurrentMode() === 'sv') {
      const textarea = editor.vditor.sv?.element;
      if (textarea) {
        textColorSelectionRef.current = {
          mode: 'source',
          start: textarea.selectionStart,
          end: textarea.selectionEnd,
        };
      }
    } else {
      const mode = editor.getCurrentMode();
      const root = mode === 'wysiwyg'
        ? editor.vditor.wysiwyg?.element
        : editor.vditor.ir?.element;
      if (root) {
        let range = lastDomTextRangeRef.current;
        if (!range || !root.contains(range.startContainer) || !root.contains(range.endContainer)) {
          range = document.createRange();
          range.selectNodeContents(root);
          range.collapse(false);
        }
        textColorSelectionRef.current = { mode: 'dom', range: range.cloneRange() };
      }
    }
    const rect = anchor.getBoundingClientRect();
    setTextColorPalette({ x: rect.left, y: rect.bottom + 6 });
  }, []);
  openTextColorPaletteRef.current = openTextColorPalette;

  const applyTextColor = useCallback((color: string | null) => {
    const editor = editorRef.current;
    const selection = textColorSelectionRef.current;
    setTextColorPalette(null);
    if (!editor?.vditor || !selection) return;
    if (selection.mode === 'source') {
      const textarea = editor.vditor.sv?.element;
      if (!textarea) return;
      const result = color
        ? applySourceTextColor(textarea.value, selection.start, selection.end, color)
        : removeSourceTextColor(textarea.value, selection.start, selection.end);
      if (result.value !== textarea.value) {
        textarea.value = result.value;
        textarea.setSelectionRange(result.selectionStart, result.selectionEnd);
        textarea.focus();
        dispatchEditorInput(textarea, color || '');
      }
      if (color) setTextColor(color);
      return;
    }
    if (selection.mode !== 'dom') return;
    const mode = editor.getCurrentMode();
    const root = mode === 'wysiwyg'
      ? editor.vditor.wysiwyg?.element
      : editor.vditor.ir?.element;
    if (!root || !root.contains(selection.range.startContainer) ||
      !root.contains(selection.range.endContainer)) {
      editorRef.current?.tip('原本的文字選取已失效，請重新選取', 3000);
      return;
    }
    let changed = removeDomTextColor(root, selection.range);
    changed = removeDomTextColorMarkers(root, selection.range) || changed;
    if (color) {
      const markerMarkup = mode === 'wysiwyg'
        ? editor.vditor.lute.Md2VditorDOM(
          `<span style="color: ${color}">${'\u200B'}</span>`,
        )
        : editor.vditor.lute.Md2VditorIRDOM(
          `<span style="color: ${color}">${'\u200B'}</span>`,
        );
      const templates = extractColorMarkerTemplates(markerMarkup);
      if (!templates) {
        editorRef.current?.tip('無法建立文字顏色標記', 3000);
        return;
      }
      changed = insertColorMarkers(root, selection.range, templates) || changed;
    }
    if (changed) {
      root.focus({ preventScroll: true });
      dispatchEditorInput(root, color || '');
      window.requestAnimationFrame(() => refreshTextColorMarkersRef.current());
    }
    if (color) setTextColor(color);
  }, [dispatchEditorInput]);

  useEffect(() => {
    document.addEventListener('selectionchange', captureTextColorSelection);
    return () => document.removeEventListener('selectionchange', captureTextColorSelection);
  }, [captureTextColorSelection]);

  useEffect(() => {
    if (!textColorPalette) return undefined;
    const close = () => setTextColorPalette(null);
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    window.addEventListener('pointerdown', close);
    window.addEventListener('blur', close);
    window.addEventListener('keydown', closeOnEscape);
    document.addEventListener('scroll', close, true);
    return () => {
      window.removeEventListener('pointerdown', close);
      window.removeEventListener('blur', close);
      window.removeEventListener('keydown', closeOnEscape);
      document.removeEventListener('scroll', close, true);
    };
  }, [textColorPalette]);

  const handleEditorContextMenu = useCallback((event: MouseEvent) => {
    const target = event.target;
    const host = hostRef.current;
    if (!(target instanceof Element) || !host) return;
    const svg = target.closest('svg');
    const mermaid = svg?.closest('.language-mermaid');
    if (mermaid && host.contains(mermaid)) {
      const diagrams = Array.from(host.querySelectorAll<HTMLElement>('.language-mermaid'))
        .filter((element) => Array.from(element.getClientRects())
          .some((rect) => rect.width > 0 && rect.height > 0));
      const index = diagrams.indexOf(mermaid as HTMLElement);
      const blocks = extractMermaidBlocks(valueRef.current);
      const block = blocks[index];
      if (index >= 0 && block) {
        event.preventDefault();
        setMediaBusy(false);
        setMediaContext({
          kind: 'mermaid',
          x: event.clientX,
          y: event.clientY,
          code: block.code,
          index,
          count: blocks.length,
        });
      }
      return;
    }
    const image = target.closest<HTMLImageElement>('img[src]');
    if (!image) return;
    const resourceID = localImageResourceID(image.getAttribute('src') || image.src);
    const resource = resourcesRef.current.find((item) => item.id === resourceID);
    if (!resource) return;
    event.preventDefault();
    setMediaBusy(false);
    setMediaContext({
      kind: 'image',
      x: event.clientX,
      y: event.clientY,
      resource,
    });
  }, []);

  const copyMediaImage = useCallback(async () => {
    const target = mediaContext;
    if (!target || mediaBusy) return;
    setMediaBusy(true);
    try {
      if (target.kind === 'mermaid') {
        const image = await renderMermaidImage(target.code, 'png');
        const filename = mermaidClipboardFilename(
          noteTitleRef.current,
          target.index,
          target.count,
          'png',
        );
        await api.copyClipboardImage(filename, bytesToBase64(image.data));
      } else {
        const response = await fetch(target.resource.url, { cache: 'no-store' });
        if (!response.ok) throw new Error('無法讀取圖片附件');
        const png = await rasterizeImageToPng(await response.blob());
        const data = new Uint8Array(await png.arrayBuffer());
        await api.copyClipboardImage(
          clipboardImageFilename(target.resource.filename),
          bytesToBase64(data),
        );
      }
      editorRef.current?.tip('已複製圖片至剪貼簿', 2500);
      setMediaContext(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      editorRef.current?.tip(`複製圖片失敗：${message}`, 4000);
    } finally {
      setMediaBusy(false);
    }
  }, [mediaBusy, mediaContext]);

  const copyMediaFile = useCallback(async () => {
    const target = mediaContext;
    if (!target || mediaBusy) return;
    setMediaBusy(true);
    try {
      if (target.kind === 'mermaid') {
        const image = await renderMermaidImage(target.code, 'svg');
        const filename = mermaidClipboardFilename(
          noteTitleRef.current,
          target.index,
          target.count,
          'svg',
        );
        await api.copyClipboardFile(filename, bytesToBase64(image.data));
      } else {
        await api.copyResourceFileToClipboard(target.resource.id);
      }
      editorRef.current?.tip('已複製圖片檔案至剪貼簿', 2500);
      setMediaContext(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      editorRef.current?.tip(`複製檔案失敗：${message}`, 4000);
    } finally {
      setMediaBusy(false);
    }
  }, [mediaBusy, mediaContext]);

  useEffect(() => {
    if (!mediaContext) return undefined;
    const close = () => setMediaContext(null);
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    window.addEventListener('pointerdown', close);
    window.addEventListener('blur', close);
    window.addEventListener('keydown', closeOnEscape);
    document.addEventListener('scroll', close, true);
    return () => {
      window.removeEventListener('pointerdown', close);
      window.removeEventListener('blur', close);
      window.removeEventListener('keydown', closeOnEscape);
      document.removeEventListener('scroll', close, true);
    };
  }, [mediaContext]);

  useImperativeHandle(ref, () => ({
    getHTML: () => {
      if (!readyRef.current || !editorRef.current?.vditor) return null;
      return editorRef.current.getHTML();
    },
  }), []);

  useEffect(() => {
    if (!findOpen) return undefined;
    const frame = window.requestAnimationFrame(() => refreshFind(true));
    return () => window.cancelAnimationFrame(frame);
  }, [findOpen, refreshFind]);

  useEffect(() => {
    const handleFindShortcut = (event: KeyboardEvent) => {
      const target = event.target;
      if (!(target instanceof Node) || !shellRef.current?.contains(target)) return;
      if (event.key === 'Escape' && shellRef.current.querySelector('.editor-find-panel')) {
        event.preventDefault();
        event.stopPropagation();
        closeFindRef.current();
        return;
      }
      if (event.altKey && !event.ctrlKey && !event.metaKey &&
        (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
        event.preventDefault();
        event.stopPropagation();
        scrollEditorPageRef.current(event.key === 'ArrowLeft' ? -1 : 1);
        return;
      }
      if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
      const key = event.key.toLowerCase();
      if (key !== 'f' && key !== 'h') return;
      event.preventDefault();
      event.stopPropagation();
      openFindRef.current(key === 'h' ? 'replace' : 'query');
    };
    document.addEventListener('keydown', handleFindShortcut, true);
    return () => document.removeEventListener('keydown', handleFindShortcut, true);
  }, []);

  useEffect(() => () => {
    clearSearchHighlights();
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    let disposed = false;
    let fullscreenActive = false;
    let codeMirrorSource: CodeMirrorSource | null = null;
    let sourceVisibilityObserver: MutationObserver | null = null;
    let sourcePreviewTimer: number | null = null;
    let previewAllowedInRichMode = false;
    let lastEditorMode: EditorMode | '' = '';
    readyRef.current = false;
    host.replaceChildren();

    const syncFullscreenState = (active: boolean) => {
      if (active === fullscreenActive) return;
      fullscreenActive = active;
      if (active) {
        document.documentElement.dataset.vditorFullscreen = 'true';
        document.body.style.overflow = 'hidden';
      } else {
        delete document.documentElement.dataset.vditorFullscreen;
        document.body.style.overflow = '';
      }
      window.requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
    };
    const fullscreenObserver = new MutationObserver(() => {
      syncFullscreenState(
        host.classList.contains('vditor--fullscreen') ||
        host.querySelector('.vditor--fullscreen') !== null,
      );
    });
    fullscreenObserver.observe(host, {
      attributes: true,
      attributeFilter: ['class'],
      subtree: true,
    });

    const handleDiagramScriptLoad = (event: Event) => {
      const target = event.target;
      if (target instanceof HTMLScriptElement &&
        (target.src.includes('/flowchart.js/flowchart.min.js') ||
          target.src.includes('/mermaid/mermaid.min.js'))) {
        installDiagramGuards();
      }
    };
    document.addEventListener('load', handleDiagramScriptLoad, true);
    installDiagramGuards();

    const initialTheme = themeRef.current;
    const editor = new Vditor(host, {
      height: '100%',
      width: '100%',
      minHeight: 320,
      value: toEditorMarkdown(initialValueRef.current, resourcesRef.current),
      mode: initialModeRef.current,
      lang: 'zh_TW',
      icon: 'material',
      theme: initialTheme === 'dark' ? 'dark' : 'classic',
      cdn: '/vditor',
      cache: { enable: false },
      placeholder: '以 Markdown 開始書寫，或直接貼上圖片…',
      tab: '\t',
      undoDelay: 300,
      toolbar: [
        toolbarIconItem('emoji'),
        toolbarIconItem('headings'),
        toolbarIconItem('bold'),
        toolbarIconItem('italic'),
        toolbarIconItem('strike'),
        {
          ...toolbarIconItem('text-color'),
          className: 'puff-text-color-toolbar',
          tip: '文字顏色',
          tipPosition: 'n',
          click: (event) => {
            if (event.currentTarget instanceof HTMLElement) {
              openTextColorPaletteRef.current(event.currentTarget);
            }
          },
        },
        toolbarIconItem('link'),
        '|',
        toolbarIconItem('list'),
        toolbarIconItem('ordered-list'),
        toolbarIconItem('check'),
        toolbarIconItem('outdent'),
        toolbarIconItem('indent'),
        '|',
        toolbarIconItem('quote'),
        toolbarIconItem('line'),
        toolbarIconItem('code'),
        toolbarIconItem('inline-code'),
        toolbarIconItem('insert-before'),
        toolbarIconItem('insert-after'),
        '|',
        toolbarIconItem('upload'),
        toolbarIconItem('table'),
        '|',
        toolbarIconItem('undo'),
        toolbarIconItem('redo'),
        '|',
        {
          ...toolbarIconItem('page-prev'),
          tip: '上一頁 (Alt+←)',
          tipPosition: 'n',
          click: () => scrollEditorPageRef.current(-1),
        },
        {
          ...toolbarIconItem('page-next'),
          tip: '下一頁 (Alt+→)',
          tipPosition: 'n',
          click: () => scrollEditorPageRef.current(1),
        },
        '|',
        {
          ...toolbarIconItem('find-replace'),
          tip: '搜尋與取代 (Ctrl+F / Ctrl+H)',
          tipPosition: 'n',
          click: () => openFindRef.current('query'),
        },
        '|',
        {
          className: 'puff-mode-controller',
          icon: '<svg viewBox="0 0 32 32" aria-hidden="true"><use xlink:href="#vditor-icon-edit"></use></svg>',
          name: 'edit-mode',
          tip: '切換編輯模式',
          tipPosition: 'n',
        },
        {
          ...toolbarIconItem('wysiwyg-mode'),
          tip: '所見即所得 (Alt+Ctrl+7)',
          tipPosition: 'n',
          click: () => activateEditorMode(editor, 'wysiwyg'),
        },
        {
          ...toolbarIconItem('ir-mode'),
          tip: '即時渲染 (Alt+Ctrl+8)',
          tipPosition: 'n',
          click: () => activateEditorMode(editor, 'ir'),
        },
        {
          ...toolbarIconItem('source-mode'),
          tip: '原始碼',
          tipPosition: 'n',
          click: () => activateEditorMode(editor, 'sv'),
        },
        toolbarIconItem('both'),
        toolbarIconItem('preview'),
        toolbarIconItem('outline'),
        toolbarIconItem('fullscreen'),
      ],
      toolbarConfig: {
        pin: true,
      },
      preview: {
        mode: initialPreviewModeRef.current,
        maxWidth: 100000,
        actions: [],
        theme: {
          current: initialTheme === 'dark' ? 'dark' : 'light',
          path: contentThemePath,
        },
        hljs: {
          enable: true,
          lineNumber: false,
          style: initialTheme === 'dark' ? 'github-dark' : 'github',
        },
        markdown: {
          sanitize: true,
          gfmAutoLink: true,
          footnotes: true,
          toc: true,
          codeBlockPreview: true,
        },
      },
      hint: {
        emojiPath: `${vditorRoot}/images/emoji`,
      },
      link: {
        isOpen: false,
        click: (element) => {
          const href = element.getAttribute('href')?.trim() || '';
          if (/^(https?:|mailto:)/i.test(href)) {
            void api.openExternal(href);
            return;
          }
          const resource = href.match(/^\/resources\/([A-Za-z0-9]{32})$/);
          if (resource) void api.openResource(resource[1]);
        },
      },
      upload: {
        url: `/upload?noteId=${encodeURIComponent(noteID)}`,
        headers: { 'X-PuffJoplin-Upload': uploadToken },
        fieldName: 'file[]',
        max: maxUploadBytes,
        multiple: true,
        validate: (files) => {
          for (const file of Array.from(files)) {
            if (file.size > maxUploadBytes) return `${file.name} 超過 50 MB`;
          }
          return true;
        },
        error: (message) => {
          editorRef.current?.tip(`附件上傳失敗：${uploadErrorMessage(message)}`, 4000);
        },
      },
      after: () => {
        if (disposed) return;
        initializeSourceEditorRef.current();
        readyRef.current = true;
        onModeChangeRef.current(editor.getCurrentMode());
        onPreviewModeChangeRef.current(currentEditorPreviewMode(editor));
        syncEditorModeButtons(editor);
        applyEditorTheme(editor, themeRef.current);
        const currentValue = toEditorMarkdown(valueRef.current, resourcesRef.current);
        if (currentValue !== toEditorMarkdown(initialValueRef.current, resourcesRef.current)) {
          applyingExternalValueRef.current = true;
          editor.setValue(currentValue, true);
          sourceEditorRef.current?.setValue(currentValue);
          window.requestAnimationFrame(() => {
            applyingExternalValueRef.current = false;
          });
        }
        lastValueRef.current = valueRef.current;
        const toolbar = editor.vditor?.toolbar?.element;
        if (toolbar) applyToolbarTitles(toolbar);
        window.setTimeout(() => refreshPageNavigationRef.current(), 30);
        refreshTextColorMarkersRef.current();
        refreshEditorViewportRef.current();
        refreshSourceEditorRef.current();
      },
      input: (markdown) => {
        if (!disposed && readyRef.current) {
          const textarea = editor.vditor?.sv?.element;
          if (editor.getCurrentMode() === 'sv' && textarea && sourceEditorRef.current) {
            sourceEditorRef.current.setValue(
              markdown,
              { from: textarea.selectionStart, to: textarea.selectionEnd },
            );
            window.requestAnimationFrame(() => {
              if (document.activeElement === textarea) {
                sourceEditorRef.current?.focus();
              }
            });
          }
          const stored = toStoredMarkdown(
            markdown,
            resourcesRef.current,
            storageKindRef.current,
          );
          lastValueRef.current = stored;
          if (!applyingExternalValueRef.current) {
            onChangeRef.current(stored);
          }
        }
      },
      blur: () => {
        if (!disposed) onBlurRef.current();
      },
    });
    editorRef.current = editor;
    const refreshSourceEditor = () => {
      if (!codeMirrorSource) return;
      const textarea = editor.vditor?.sv?.element;
      if (!textarea) return;
      const mode = editor.getCurrentMode();
      const modeChanged = mode !== lastEditorMode;
      lastEditorMode = mode;
      const visible = mode === 'sv' &&
        window.getComputedStyle(textarea).display !== 'none';
      if (visible && codeMirrorSource.getValue() !== textarea.value) {
        codeMirrorSource.setValue(textarea.value);
      }
      if (mode !== 'sv') {
        if (modeChanged) previewAllowedInRichMode = false;
        if (!previewAllowedInRichMode && editor.vditor?.preview?.element) {
          if (editor.vditor.options.preview) editor.vditor.options.preview.mode = 'editor';
          editor.vditor.preview.element.style.display = 'none';
        }
      } else {
        previewAllowedInRichMode = false;
      }
      codeMirrorSource.setVisible(visible);
      const content = codeMirrorSource.element.parentElement;
      content?.classList.toggle('is-codemirror-active', visible);
      if (content) {
        if (mode === 'sv' || previewAllowedInRichMode) delete content.dataset.puffPreviewHidden;
        else content.dataset.puffPreviewHidden = 'true';
      }
      if (mode === 'sv' || previewAllowedInRichMode) delete host.dataset.puffPreviewHidden;
      else host.dataset.puffPreviewHidden = 'true';
    };
    const initializeSourceEditor = () => {
      if (codeMirrorSource) return;
      const content = host.querySelector<HTMLElement>('.vditor-content');
      const sourceTextarea = editor.vditor?.sv?.element;
      if (!content || !sourceTextarea) return;
      const nativeSetRangeText = sourceTextarea.setRangeText.bind(sourceTextarea);
      const guardedSetRangeText = (
        replacement: string,
        start?: number,
        end?: number,
        selectionMode?: 'select' | 'start' | 'end' | 'preserve',
      ) => {
        if (start === undefined || end === undefined) {
          nativeSetRangeText(replacement);
          return;
        }
        const length = sourceTextarea.value.length;
        const safeStart = Math.max(0, Math.min(start, length));
        const safeEnd = Math.max(safeStart, Math.min(end, length));
        nativeSetRangeText(
          replacement,
          safeStart,
          safeEnd,
          selectionMode || 'preserve',
        );
      };
      sourceTextarea.setRangeText = guardedSetRangeText as HTMLTextAreaElement['setRangeText'];
      try {
        codeMirrorSource = new CodeMirrorSource({
          parent: content,
          textarea: sourceTextarea,
          value: sourceTextarea.value,
          showLineNumbers: showSourceLineNumbersRef.current,
          onChange: (markdown) => {
            const stored = toStoredMarkdown(
              markdown,
              resourcesRef.current,
              storageKindRef.current,
            );
            lastValueRef.current = stored;
            if (!applyingExternalValueRef.current) onChangeRef.current(stored);
            if (sourcePreviewTimer !== null) window.clearTimeout(sourcePreviewTimer);
            sourcePreviewTimer = window.setTimeout(() => {
              sourcePreviewTimer = null;
              if (disposed || editor.getCurrentMode() !== 'sv') return;
              const preview = editor.vditor?.preview?.element;
              if (!preview || window.getComputedStyle(preview).display === 'none') return;
              editor.vditor?.preview?.render(editor.vditor);
            }, 160);
          },
          onBlur: () => {
            if (!disposed) onBlurRef.current();
          },
          onScroll: () => {
            refreshPageNavigationRef.current();
            refreshEditorViewportRef.current();
          },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const stack = error instanceof Error ? error.stack || '' : '';
        void api.reportFrontendError(
          `CodeMirror source initialization failed: ${message}`,
          stack,
          'codemirror-init',
        );
        refreshSourceEditorRef.current = () => undefined;
        return;
      }
      sourceEditorRef.current = codeMirrorSource;
      refreshSourceEditorRef.current = refreshSourceEditor;
      refreshSourceEditor();
      sourceVisibilityObserver = new MutationObserver(() => {
        refreshSourceEditorRef.current();
      });
      sourceVisibilityObserver.observe(sourceTextarea, {
        attributes: true,
        attributeFilter: ['style'],
      });
    };
    initializeSourceEditorRef.current = initializeSourceEditor;
    initializeSourceEditor();
    const toolbar = editor.vditor?.toolbar?.element;
    if (toolbar) applyToolbarTitles(toolbar);
    const viewportController = new EditorViewportController(host);
    refreshEditorViewportRef.current = viewportController.schedule;
    viewportController.start();

    let textColorFrame: number | null = null;
    const refreshTextColorMarkers = () => {
      textColorFrame = null;
      if (!editor.vditor) return;
      const mode = editor.getCurrentMode();
      const root = mode === 'wysiwyg'
        ? editor.vditor.wysiwyg?.element
        : editor.vditor.ir?.element;
      if (root) decorateTextColorMarkers(root);
    };
    const scheduleTextColorMarkers = () => {
      if (textColorFrame !== null) return;
      textColorFrame = window.requestAnimationFrame(refreshTextColorMarkers);
    };
    refreshTextColorMarkersRef.current = scheduleTextColorMarkers;
    scheduleTextColorMarkers();

    const pageButton = (name: string): HTMLButtonElement | null => {
      if (!editor.vditor) return null;
      const element = editor.vditor.toolbar?.elements?.[name];
      if (!element) return null;
      if (element instanceof HTMLButtonElement) return element;
      return element.querySelector<HTMLButtonElement>('button');
    };
    const pageScroller = (): HTMLElement | null => {
      if (!editor.vditor) return null;
      const mode = editor.getCurrentMode();
      const candidates: Array<HTMLElement | null | undefined> = [
        mode === 'sv' ? codeMirrorSource?.scrollElement : undefined,
        mode === 'wysiwyg' ? editor.vditor.wysiwyg?.element : undefined,
        mode === 'ir' ? editor.vditor.ir?.element : undefined,
        host.querySelector<HTMLElement>('.vditor-preview'),
      ];
      for (const candidate of candidates) {
        if (!candidate || candidate.getClientRects().length === 0) continue;
        const style = window.getComputedStyle(candidate);
        if (candidate.scrollHeight <= candidate.clientHeight + 1) continue;
        if (style.overflowY === 'auto' || style.overflowY === 'scroll' ||
          style.overflowY === 'overlay') {
          return candidate;
        }
      }
      return null;
    };
    let pageNavigationFrame: number | null = null;
    const refreshPageNavigation = () => {
      pageNavigationFrame = null;
      const target = pageScroller();
      const state = target
        ? pageScrollState(target)
        : { canPrevious: false, canNext: false };
      for (const [name, disabled] of [
        ['page-prev', !state.canPrevious],
        ['page-next', !state.canNext],
      ] as const) {
        const button = pageButton(name);
        if (button) {
          button.disabled = disabled;
          button.setAttribute('aria-disabled', String(disabled));
        }
      }
    };
    const schedulePageNavigationRefresh = () => {
      if (pageNavigationFrame !== null) return;
      pageNavigationFrame = window.requestAnimationFrame(refreshPageNavigation);
    };
    scrollEditorPageRef.current = (direction) => {
      const target = pageScroller();
      if (!target) {
        schedulePageNavigationRefresh();
        return;
      }
      const state = pageScrollState(target);
      if ((direction < 0 && !state.canPrevious) || (direction > 0 && !state.canNext)) {
        return;
      }
      const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      target.scrollBy({
        top: direction * pageScrollDistance(target.clientHeight),
        behavior: reducedMotion ? 'auto' : 'smooth',
      });
      schedulePageNavigationRefresh();
      window.setTimeout(schedulePageNavigationRefresh, 180);
    };
    refreshPageNavigationRef.current = schedulePageNavigationRefresh;

    const handlePaste = (event: ClipboardEvent) => {
      if (!clipboardHasImage(event)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (pastingRef.current) return;
      pastingRef.current = true;
      void api.pasteClipboardImage(noteID)
        .then((resource) => {
          if (disposed || !readyRef.current || !editorRef.current) return;
          editorRef.current.insertMD(clipboardImageMarkdown(resource));
          if (editorRef.current.getCurrentMode() === 'sv' && sourceEditorRef.current) {
            sourceEditorRef.current.focus();
          } else {
            editorRef.current.focus();
          }
        })
        .catch((error: unknown) => {
          if (disposed || !readyRef.current || !editorRef.current) return;
          const message = error instanceof Error ? error.message : String(error);
          editorRef.current.tip(`剪貼簿圖片貼上失敗：${message}`, 4000);
        })
        .finally(() => {
          pastingRef.current = false;
        });
    };
    host.addEventListener('paste', handlePaste, true);

    let findRefreshTimer: number | null = null;
    const scheduleFindRefresh = () => {
      if (findRefreshTimer !== null) window.clearTimeout(findRefreshTimer);
      findRefreshTimer = window.setTimeout(() => {
        findRefreshTimer = null;
        refreshFindRef.current(false);
        schedulePageNavigationRefresh();
        scheduleTextColorMarkers();
        refreshEditorViewportRef.current();
      }, 120);
    };
    const handleEditorClick = (event: Event) => {
      const target = event.target;
      const headingAction = target instanceof Element
        ? target.closest<HTMLButtonElement>('button[data-tag^="h"]')
        : null;
      const headingLevel = Number.parseInt(headingAction?.dataset.tag?.slice(1) || '', 10);
      if (headingAction &&
        Number.isFinite(headingLevel) &&
        editor.getCurrentMode() === 'sv' &&
        codeMirrorSource) {
        event.preventDefault();
        event.stopImmediatePropagation();
        codeMirrorSource.applyHeading(headingLevel);
        const panel = headingAction.parentElement;
        if (panel) panel.style.display = 'none';
        return;
      }
      const sourceHistoryAction = target instanceof Element
        ? target.closest<HTMLButtonElement>('button[data-type="undo"], button[data-type="redo"]')
        : null;
      if (sourceHistoryAction &&
        editor.getCurrentMode() === 'sv' &&
        codeMirrorSource) {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (sourceHistoryAction.dataset.type === 'undo') codeMirrorSource.undo();
        else codeMirrorSource.redo();
        return;
      }
      const previewAction = target instanceof Element
        ? target.closest<HTMLButtonElement>('button[data-type="preview"]')
        : null;
      if (previewAction && codeMirrorSource?.element.parentElement) {
        previewAllowedInRichMode = true;
        delete codeMirrorSource.element.parentElement.dataset.puffPreviewHidden;
        delete host.dataset.puffPreviewHidden;
      }
      const modeButton = target instanceof Element
        ? target.closest<HTMLButtonElement>('button[data-mode]')
        : null;
      const requestedMode = parseEditorMode(modeButton?.dataset.mode);
      if (requestedMode) previewAllowedInRichMode = false;
      if (requestedMode && requestedMode !== 'sv') codeMirrorSource?.setVisible(false);
      const modeControl = target instanceof Element
        ? target.closest(
          'button[data-mode], button[data-type="both"], button[data-type="preview"]',
        )
        : null;
      if (modeControl) {
        window.setTimeout(() => {
          if (requestedMode &&
            modeButton?.isConnected &&
            editor.getCurrentMode() !== requestedMode) {
            modeButton.click();
          }
          refreshFindRef.current(true);
          schedulePageNavigationRefresh();
          scheduleTextColorMarkers();
          refreshEditorViewportRef.current();
          refreshSourceEditorRef.current();
          onModeChangeRef.current(editor.getCurrentMode());
          onPreviewModeChangeRef.current(currentEditorPreviewMode(editor));
          syncEditorModeButtons(editor);
        }, 30);
      }
    };
    host.addEventListener('input', scheduleFindRefresh, true);
    host.addEventListener('click', handleEditorClick, true);
    host.addEventListener('contextmenu', handleEditorContextMenu);
    host.addEventListener('scroll', schedulePageNavigationRefresh, true);
    window.addEventListener('resize', schedulePageNavigationRefresh);
    schedulePageNavigationRefresh();

    return () => {
      disposed = true;
      readyRef.current = false;
      editorRef.current = null;
      if (findRefreshTimer !== null) window.clearTimeout(findRefreshTimer);
      if (sourcePreviewTimer !== null) window.clearTimeout(sourcePreviewTimer);
      if (pageNavigationFrame !== null) window.cancelAnimationFrame(pageNavigationFrame);
      if (textColorFrame !== null) window.cancelAnimationFrame(textColorFrame);
      refreshPageNavigationRef.current = () => undefined;
      scrollEditorPageRef.current = () => undefined;
      refreshTextColorMarkersRef.current = () => undefined;
      refreshEditorViewportRef.current = () => undefined;
      refreshSourceEditorRef.current = () => undefined;
      initializeSourceEditorRef.current = () => undefined;
      sourceVisibilityObserver?.disconnect();
      sourceEditorRef.current = null;
      codeMirrorSource?.destroy();
      viewportController.destroy();
      clearTextColorHighlights();
      fullscreenObserver.disconnect();
      if (fullscreenActive) {
        delete document.documentElement.dataset.vditorFullscreen;
        document.body.style.overflow = '';
      }
      document.removeEventListener('load', handleDiagramScriptLoad, true);
      host.removeEventListener('paste', handlePaste, true);
      host.removeEventListener('input', scheduleFindRefresh, true);
      host.removeEventListener('click', handleEditorClick, true);
      host.removeEventListener('contextmenu', handleEditorContextMenu);
      host.removeEventListener('scroll', schedulePageNavigationRefresh, true);
      window.removeEventListener('resize', schedulePageNavigationRefresh);
      // Vditor initializes asynchronously after loading its i18n dictionary.
      // React can unmount the editor before that finishes when switching notes.
      if (editor.vditor) {
        editor.destroy();
      }
      host.replaceChildren();
    };
  }, [handleEditorContextMenu, noteID, uploadToken]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    applyEditorTheme(editor, theme);
  }, [theme]);

  useEffect(() => {
    sourceEditorRef.current?.setShowLineNumbers(showSourceLineNumbers);
  }, [showSourceLineNumbers]);

  useEffect(() => {
    const editor = editorRef.current;
    const host = hostRef.current;
    if (!editor || !host) return undefined;
    if (active) {
      const frame = window.requestAnimationFrame(() => {
        refreshEditorViewportRef.current();
        refreshSourceEditorRef.current();
        window.dispatchEvent(new Event('resize'));
      });
      return () => window.cancelAnimationFrame(frame);
    }
    closeFindPanel();
    setMediaContext(null);
    setTextColorPalette(null);
    clearSearchHighlights();
    document.body.classList.remove(
      'editor-splitter-dragging',
      'editor-scrollbar-dragging',
    );
    if (host.classList.contains('vditor--fullscreen') ||
      host.querySelector('.vditor--fullscreen')) {
      editor.vditor?.toolbar?.elements?.fullscreen
        ?.querySelector<HTMLButtonElement>('button')?.click();
    }
    return undefined;
  }, [active, closeFindPanel]);

  useEffect(() => {
    if (value === lastValueRef.current) return undefined;
    const editor = editorRef.current;
    if (!editor || !readyRef.current) return undefined;
    applyingExternalValueRef.current = true;
    const markdown = toEditorMarkdown(value, resources);
    editor.setValue(markdown, true);
    sourceEditorRef.current?.setValue(markdown);
    lastValueRef.current = value;
    const frame = window.requestAnimationFrame(() => {
      applyingExternalValueRef.current = false;
      refreshFindRef.current(false);
      refreshPageNavigationRef.current();
      refreshTextColorMarkersRef.current();
      refreshEditorViewportRef.current();
      refreshSourceEditorRef.current();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [resources, value]);

  return (
    <div ref={shellRef} className="vditor-editor-shell">
      <div ref={hostRef} className="vditor-editor-host" aria-label="Markdown 編輯器" />
      {findOpen && (
        <EditorFindPanel
          query={findQuery}
          replacement={findReplacement}
          matchCase={findMatchCase}
          wholeWord={findWholeWord}
          matchCount={findMatchCount}
          activeIndex={findActiveIndex}
          queryInputRef={findQueryInputRef}
          replaceInputRef={findReplacementInputRef}
          onQueryChange={setFindQuery}
          onReplacementChange={setFindReplacement}
          onMatchCaseChange={setFindMatchCase}
          onWholeWordChange={setFindWholeWord}
          onPrevious={() => navigateFind(-1)}
          onNext={() => navigateFind(1)}
          onReplace={replaceFindMatch}
          onReplaceAll={replaceAllFindMatches}
          onClose={closeFindPanel}
        />
      )}
      {mediaContext && (
        <EditorMediaContextMenu
          target={mediaContext}
          busy={mediaBusy}
          onCopyImage={() => void copyMediaImage()}
          onCopyFile={() => void copyMediaFile()}
          onClose={() => setMediaContext(null)}
        />
      )}
      {textColorPalette && (
        <TextColorPalette
          x={textColorPalette.x}
          y={textColorPalette.y}
          selectedColor={textColor}
          onSelect={(color) => applyTextColor(color)}
          onReset={() => applyTextColor(null)}
          onClose={() => setTextColorPalette(null)}
        />
      )}
    </div>
  );
});

VditorEditor.displayName = 'VditorEditor';

export default VditorEditor;
