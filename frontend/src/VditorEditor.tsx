import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from 'react';
import Vditor from 'vditor';
import 'vditor/dist/index.css';
import { api } from './api';
import { installDiagramGuards } from './diagramGuards';
import { toEditorMarkdown, toStoredMarkdown } from './resourceUrls';
import type { Resource } from './types';

const vditorRoot = '/vditor/dist';
const contentThemePath = `${vditorRoot}/css/content-theme`;
const maxUploadBytes = 50 * 1024 * 1024;

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
  value: string;
  uploadToken: string;
  storageKind: 'database' | 'directory';
  resources: Resource[];
  theme: 'light' | 'dark';
  onChange: (value: string) => void;
  onBlur: () => void;
}

export interface VditorEditorHandle {
  getHTML: () => string | null;
}

const VditorEditor = forwardRef<VditorEditorHandle, VditorEditorProps>(function VditorEditor({
  noteID,
  value,
  uploadToken,
  storageKind,
  resources,
  theme,
  onChange,
  onBlur,
}, ref) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<Vditor | null>(null);
  const readyRef = useRef(false);
  const initialValueRef = useRef(value);
  const themeRef = useRef(theme);
  const onChangeRef = useRef(onChange);
  const onBlurRef = useRef(onBlur);
  const pastingRef = useRef(false);
  const storageKindRef = useRef(storageKind);
  const resourcesRef = useRef(resources);
  const valueRef = useRef(value);
  const lastValueRef = useRef(value);
  const applyingExternalValueRef = useRef(false);

  themeRef.current = theme;
  onChangeRef.current = onChange;
  onBlurRef.current = onBlur;
  storageKindRef.current = storageKind;
  resourcesRef.current = resources;
  valueRef.current = value;

  useImperativeHandle(ref, () => ({
    getHTML: () => {
      if (!readyRef.current || !editorRef.current?.vditor) return null;
      return editorRef.current.getHTML();
    },
  }), []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    let disposed = false;
    let fullscreenActive = false;
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
      mode: 'ir',
      lang: 'zh_TW',
      icon: 'material',
      theme: initialTheme === 'dark' ? 'dark' : 'classic',
      cdn: '/vditor',
      cache: { enable: false },
      placeholder: '以 Markdown 開始書寫，或直接貼上圖片…',
      tab: '\t',
      undoDelay: 300,
      toolbar: [
        'emoji',
        'headings',
        'bold',
        'italic',
        'strike',
        'link',
        '|',
        'list',
        'ordered-list',
        'check',
        'outdent',
        'indent',
        '|',
        'quote',
        'line',
        'code',
        'inline-code',
        'insert-before',
        'insert-after',
        '|',
        'upload',
        'table',
        '|',
        'undo',
        'redo',
        '|',
        'edit-mode',
        {
          name: 'source-mode',
          tip: '原始碼',
          icon: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M11.3 8.7 3.9 16l7.4 7.3-2.2 2.3L0 16 9.1 6.4l2.2 2.3Zm9.4 0 7.4 7.3-7.4 7.3 2.2 2.3L32 16 22.9 6.4l-2.2 2.3ZM13 27.8l3.7-23.6 3 .5-3.7 23.6-3-.5Z"/></svg>',
          click: () => {
            if (!editor.vditor) return;
            const svButton = editor.vditor.toolbar?.elements?.['edit-mode']
              ?.querySelector<HTMLButtonElement>('button[data-mode="sv"]');
            svButton?.click();
            editor.setPreviewMode('editor');
          },
        },
        'both',
        'preview',
        'outline',
        'fullscreen',
      ],
      toolbarConfig: {
        pin: true,
      },
      preview: {
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
        readyRef.current = true;
        applyEditorTheme(editor, themeRef.current);
        const currentValue = toEditorMarkdown(valueRef.current, resourcesRef.current);
        if (currentValue !== toEditorMarkdown(initialValueRef.current, resourcesRef.current)) {
          applyingExternalValueRef.current = true;
          editor.setValue(currentValue, true);
          window.requestAnimationFrame(() => {
            applyingExternalValueRef.current = false;
          });
        }
        lastValueRef.current = valueRef.current;
      },
      input: (markdown) => {
        if (!disposed && readyRef.current) {
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
          editorRef.current.focus();
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

    return () => {
      disposed = true;
      readyRef.current = false;
      editorRef.current = null;
      fullscreenObserver.disconnect();
      if (fullscreenActive) {
        delete document.documentElement.dataset.vditorFullscreen;
        document.body.style.overflow = '';
      }
      document.removeEventListener('load', handleDiagramScriptLoad, true);
      host.removeEventListener('paste', handlePaste, true);
      // Vditor initializes asynchronously after loading its i18n dictionary.
      // React can unmount the editor before that finishes when switching notes.
      if (editor.vditor) {
        editor.destroy();
      }
      host.replaceChildren();
    };
  }, [noteID, uploadToken]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    applyEditorTheme(editor, theme);
  }, [theme]);

  useEffect(() => {
    if (value === lastValueRef.current) return undefined;
    const editor = editorRef.current;
    if (!editor || !readyRef.current) return undefined;
    applyingExternalValueRef.current = true;
    editor.setValue(toEditorMarkdown(value, resources), true);
    lastValueRef.current = value;
    const frame = window.requestAnimationFrame(() => {
      applyingExternalValueRef.current = false;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [resources, value]);

  return <div ref={hostRef} className="vditor-editor-host" aria-label="Markdown 編輯器" />;
});

VditorEditor.displayName = 'VditorEditor';

export default VditorEditor;
