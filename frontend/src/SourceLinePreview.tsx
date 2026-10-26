import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { api } from './api';
import {
  clipboardImageFilename,
  rasterizeImageToPng,
} from './imageClipboard';
import { bytesToBase64, renderMermaidImage } from './mermaidExport';
import type { SourcePreviewLine, SourcePreviewTarget } from './sourceLineTarget';
import {
  resizeSourcePreviewBounds,
  SOURCE_PREVIEW_MIN_HEIGHT,
  SOURCE_PREVIEW_MIN_WIDTH,
  SOURCE_PREVIEW_WINDOW_MARGIN,
  type SourcePreviewResizeHandle,
} from './sourcePreviewGeometry';
import UiIcon from './UiIcon';

interface SourceLinePreviewProps {
  target: SourcePreviewTarget;
  items: readonly SourcePreviewTarget[];
  anchor?: SourcePreviewLine['anchor'];
  onSelect: (target: SourcePreviewTarget) => void;
  onClose: () => void;
  onLocate: (target: SourcePreviewTarget) => void;
  onDeleteRequest: (target: SourcePreviewTarget) => Promise<boolean>;
}

type DragState = {
  pointerID: number;
  startX: number;
  startY: number;
  originLeft: number;
  originTop: number;
};

type PanState = {
  pointerID: number;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
};

type ResizeState = {
  handle: SourcePreviewResizeHandle;
  pointerID: number;
  startX: number;
  startY: number;
  startWidth: number;
  startHeight: number;
  startLeft: number;
  startTop: number;
};

const mermaidPreviewCache = new Map<string, Promise<string>>();
const minimumZoom = 0.25;
const maximumZoom = 8;
const resizeHandleClass: Record<SourcePreviewResizeHandle, string> = {
  n: 'resize-n',
  ne: 'resize-ne',
  e: 'resize-e',
  se: 'resize-se',
  s: 'resize-s',
  sw: 'resize-sw',
  w: 'resize-w',
  nw: 'resize-nw',
};
const resizeHandles = Object.keys(resizeHandleClass) as SourcePreviewResizeHandle[];

function mermaidPreviewSource(code: string): Promise<string> {
  const cached = mermaidPreviewCache.get(code);
  if (cached) return cached;
  const pending = renderMermaidImage(code, 'svg').then((image) =>
    `data:image/svg+xml;base64,${bytesToBase64(image.data)}`);
  mermaidPreviewCache.set(code, pending);
  pending.catch(() => mermaidPreviewCache.delete(code));
  return pending;
}

function mediaKindClass(kind: SourcePreviewTarget['kind']): string {
  return kind === 'mermaid' ? 'is-mermaid' : 'is-image';
}

function closeIcon() {
  return <UiIcon name="close" />;
}

function zoomOutIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <circle cx="8.5" cy="8.5" r="5.25" />
      <path d="M5.75 8.5h5.5M12.25 12.25 16 16" />
    </svg>
  );
}

function zoomInIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <circle cx="8.5" cy="8.5" r="5.25" />
      <path d="M5.75 8.5h5.5M8.5 5.75v5.5M12.25 12.25 16 16" />
    </svg>
  );
}

function maximizeIcon(maximized: boolean) {
  return maximized ? (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M3.5 8H8V3.5M16.5 8H12V3.5M3.5 12H8v4.5M16.5 12H12v4.5" />
    </svg>
  ) : (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M8 3.5H3.5V8M12 3.5h4.5V8M8 16.5H3.5V12M12 16.5h4.5V12" />
    </svg>
  );
}

function PreviewThumbnail({
  item,
  active,
  onSelect,
}: {
  item: SourcePreviewTarget;
  active: boolean;
  onSelect: () => void;
}) {
  const [source, setSource] = useState(item.kind === 'image' ? item.src : '');
  const [failed, setFailed] = useState(false);
  const label = item.kind === 'image' ? item.alt : 'Mermaid';
  const previewContent = item.kind === 'image' ? item.src : item.code;

  useEffect(() => {
    if (item.kind === 'image') {
      setSource(item.src);
      setFailed(false);
      return undefined;
    }
    let mounted = true;
    setSource('');
    setFailed(false);
    void mermaidPreviewSource(item.code)
      .then((value) => {
        if (mounted) setSource(value);
      })
      .catch(() => {
        if (mounted) setFailed(true);
      });
    return () => {
      mounted = false;
    };
  }, [item.kind, previewContent]);

  return (
    <button
      type="button"
      role="option"
      className={`source-line-preview-thumbnail${active ? ' active' : ''}`}
      aria-current={active ? 'true' : undefined}
      aria-selected={active}
      aria-label={`${label}，第 ${item.lineNumber} 行`}
      title={`第 ${item.lineNumber} 行 · ${label}`}
      onClick={onSelect}
    >
      <span className={`source-line-preview-thumbnail-media ${mediaKindClass(item.kind)}`}>
        {!failed && source
          ? <img src={source} alt="" draggable={false} onError={() => setFailed(true)} />
          : <UiIcon name={item.kind === 'mermaid' ? 'summary' : 'eye'} />}
      </span>
      <span>{label}</span>
    </button>
  );
}

export default function SourceLinePreview({
  target,
  items,
  anchor,
  onSelect,
  onClose,
  onLocate,
  onDeleteRequest,
}: SourceLinePreviewProps) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const panRef = useRef<PanState | null>(null);
  const resizeRef = useRef<ResizeState | null>(null);
  const initializedRef = useRef(false);
  const [position, setPosition] = useState({ left: 0, top: 0, ready: false });
  const [size, setSize] = useState(() => ({
    width: Math.min(720, window.innerWidth - 24),
    height: Math.min(620, window.innerHeight - 24),
  }));
  const [maximized, setMaximized] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [mermaidSource, setMermaidSource] = useState('');
  const [loading, setLoading] = useState(target.kind === 'mermaid');
  const [error, setError] = useState('');
  const [busyAction, setBusyAction] = useState<'save' | 'copy' | 'delete' | null>(null);
  const [actionMessage, setActionMessage] = useState('');
  const currentIndex = Math.max(0, items.findIndex((item) => item.id === target.id));
  const targetContent = target.kind === 'image' ? target.src : target.code;

  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setError('');
    setBusyAction(null);
    setActionMessage('');
    if (target.kind === 'image') {
      setLoading(true);
      setMermaidSource('');
      return undefined;
    }
    let active = true;
    setLoading(true);
    void mermaidPreviewSource(target.code)
      .then((source) => {
        if (!active) return;
        setMermaidSource(source);
      })
      .catch((reason: unknown) => {
        if (!active) return;
        setError(reason instanceof Error ? reason.message : String(reason));
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [target.id, target.kind, targetContent]);

  useEffect(() => {
    if (!actionMessage) return undefined;
    const timer = window.setTimeout(() => setActionMessage(''), 2600);
    return () => window.clearTimeout(timer);
  }, [actionMessage]);

  useLayoutEffect(() => {
    if (initializedRef.current) return;
    const card = cardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const margin = 12;
    let left = anchor ? anchor.right + 14 : (window.innerWidth - rect.width) / 2;
    if (anchor && left + rect.width > window.innerWidth - margin) {
      left = anchor.left - rect.width - 14;
    }
    if (left < margin) left = margin;
    let top = anchor ? anchor.top : (window.innerHeight - rect.height) / 2;
    if (top + rect.height > window.innerHeight - margin) {
      top = window.innerHeight - rect.height - margin;
    }
    setPosition({
      left,
      top: Math.max(margin, top),
      ready: true,
    });
    card.focus({ preventScroll: true });
    initializedRef.current = true;
  }, [anchor]);

  useEffect(() => {
    const clampToWindow = () => {
      setSize((current) => ({
        width: Math.max(
          SOURCE_PREVIEW_MIN_WIDTH,
          Math.min(current.width, window.innerWidth - 24),
        ),
        height: Math.max(
          SOURCE_PREVIEW_MIN_HEIGHT,
          Math.min(current.height, window.innerHeight - 24),
        ),
      }));
      setPosition((current) => ({
        ...current,
        left: Math.max(SOURCE_PREVIEW_WINDOW_MARGIN, Math.min(
          current.left,
          window.innerWidth - SOURCE_PREVIEW_MIN_WIDTH - SOURCE_PREVIEW_WINDOW_MARGIN,
        )),
        top: Math.max(SOURCE_PREVIEW_WINDOW_MARGIN, Math.min(
          current.top,
          window.innerHeight - SOURCE_PREVIEW_MIN_HEIGHT - SOURCE_PREVIEW_WINDOW_MARGIN,
        )),
      }));
    };
    window.addEventListener('resize', clampToWindow);
    return () => window.removeEventListener('resize', clampToWindow);
  }, []);

  const selectRelative = (direction: -1 | 1) => {
    if (items.length < 2) return;
    const index = (currentIndex + direction + items.length) % items.length;
    onSelect(items[index]);
  };

  const startDrag = (event: ReactPointerEvent<HTMLElement>) => {
    if (
      maximized ||
      event.button !== 0 ||
      (event.target as Element).closest('button')
    ) {
      return;
    }
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerID: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originLeft: position.left,
      originTop: position.top,
    };
  };

  const dragWindow = (event: ReactPointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerID !== event.pointerId || maximized) return;
    const left = Math.max(
      SOURCE_PREVIEW_WINDOW_MARGIN,
      Math.min(
        drag.originLeft + event.clientX - drag.startX,
        window.innerWidth - size.width - SOURCE_PREVIEW_WINDOW_MARGIN,
      ),
    );
    const top = Math.max(
      SOURCE_PREVIEW_WINDOW_MARGIN,
      Math.min(
        drag.originTop + event.clientY - drag.startY,
        window.innerHeight - size.height - SOURCE_PREVIEW_WINDOW_MARGIN,
      ),
    );
    setPosition({ left, top, ready: true });
  };

  const stopDrag = (event: ReactPointerEvent<HTMLElement>) => {
    if (dragRef.current?.pointerID !== event.pointerId) return;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const startResize = (
    event: ReactPointerEvent<HTMLSpanElement>,
    handle: SourcePreviewResizeHandle,
  ) => {
    if (maximized || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    resizeRef.current = {
      handle,
      pointerID: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startWidth: size.width,
      startHeight: size.height,
      startLeft: position.left,
      startTop: position.top,
    };
  };

  const resizeWindow = (event: ReactPointerEvent<HTMLSpanElement>) => {
    const resize = resizeRef.current;
    if (!resize || resize.pointerID !== event.pointerId || maximized) return;
    const resized = resizeSourcePreviewBounds(
      {
        left: resize.startLeft,
        top: resize.startTop,
        width: resize.startWidth,
        height: resize.startHeight,
      },
      resize.handle,
      event.clientX - resize.startX,
      event.clientY - resize.startY,
      window.innerWidth,
      window.innerHeight,
    );
    setSize({ width: resized.width, height: resized.height });
    setPosition({ left: resized.left, top: resized.top, ready: true });
  };

  const stopResize = (event: ReactPointerEvent<HTMLSpanElement>) => {
    if (resizeRef.current?.pointerID !== event.pointerId) return;
    resizeRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const startPan = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (
      event.button !== 0 ||
      (event.target as Element).closest('button')
    ) {
      return;
    }
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    panRef.current = {
      pointerID: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: pan.x,
      originY: pan.y,
    };
  };

  const movePan = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = panRef.current;
    if (!drag || drag.pointerID !== event.pointerId) return;
    setPan({
      x: drag.originX + event.clientX - drag.startX,
      y: drag.originY + event.clientY - drag.startY,
    });
  };

  const stopPan = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (panRef.current?.pointerID !== event.pointerId) return;
    panRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const changeZoom = (factor: number) => {
    setZoom((current) =>
      Math.max(minimumZoom, Math.min(maximumZoom, Math.round(current * factor * 100) / 100)));
  };

  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const currentPng = async (): Promise<{ data: Uint8Array; filename: string }> => {
    if (target.kind === 'mermaid') {
      const image = await renderMermaidImage(target.code, 'png');
      return {
        data: image.data,
        filename: `PuffJoplin-mermaid-${target.lineNumber}.png`,
      };
    }
    const response = await fetch(target.src, { cache: 'no-store' });
    if (!response.ok) throw new Error('無法讀取預覽圖片');
    const png = await rasterizeImageToPng(await response.blob());
    return {
      data: new Uint8Array(await png.arrayBuffer()),
      filename: clipboardImageFilename(target.alt || `PuffJoplin-line-${target.lineNumber}`),
    };
  };

  const saveAs = async () => {
    if (busyAction) return;
    setBusyAction('save');
    setActionMessage('');
    try {
      const image = await currentPng();
      const path = await api.saveImageAs(
        image.filename,
        bytesToBase64(image.data),
      );
      if (path) setActionMessage('已另存圖片');
    } catch (reason) {
      setActionMessage(`另存失敗：${reason instanceof Error ? reason.message : String(reason)}`);
    } finally {
      setBusyAction(null);
    }
  };

  const copyImage = async () => {
    if (busyAction) return;
    setBusyAction('copy');
    setActionMessage('');
    try {
      const image = await currentPng();
      await api.copyClipboardImage(
        image.filename,
        bytesToBase64(image.data),
      );
      setActionMessage('已複製到剪貼簿');
    } catch (reason) {
      setActionMessage(`複製失敗：${reason instanceof Error ? reason.message : String(reason)}`);
    } finally {
      setBusyAction(null);
    }
  };

  const requestDelete = async () => {
    if (busyAction) return;
    setBusyAction('delete');
    setActionMessage('');
    try {
      if (await onDeleteRequest(target)) setActionMessage('已從內文移除媒體');
    } catch (reason) {
      setActionMessage(`刪除失敗：${reason instanceof Error ? reason.message : String(reason)}`);
    } finally {
      setBusyAction(null);
    }
  };

  const source = target.kind === 'image' ? target.src : mermaidSource;
  const title = target.kind === 'image' ? '圖片預覽' : 'Mermaid 預覽';
  const imageStyle: CSSProperties = {
    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
  };
  const cardStyle: CSSProperties | undefined = maximized ? undefined : {
    left: position.left,
    top: position.top,
    width: size.width,
    height: size.height,
    opacity: position.ready ? 1 : 0,
  };

  return createPortal(
    <div
      ref={cardRef}
      className={`source-line-preview${maximized ? ' is-maximized' : ''}`}
      role="dialog"
      aria-label={`${title}，第 ${target.lineNumber} 行`}
      tabIndex={-1}
      style={cardStyle}
      onPointerDown={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        if (event.key === 'ArrowLeft') {
          event.preventDefault();
          selectRelative(-1);
        } else if (event.key === 'ArrowRight') {
          event.preventDefault();
          selectRelative(1);
        }
      }}
    >
      <header
        className="source-line-preview-header"
        onPointerDown={startDrag}
        onPointerMove={dragWindow}
        onPointerUp={stopDrag}
        onPointerCancel={stopDrag}
      >
        <div className="source-line-preview-title">
          <strong>{title}</strong>
          <span>
            第 {target.lineNumber}
            {target.endLine !== target.lineNumber ? `–${target.endLine}` : ''} 行
            {' · '}{currentIndex + 1}/{items.length}
          </span>
        </div>
        <div className="source-line-preview-actions">
          <button
            type="button"
            aria-label="定位到內文"
            title="定位到內文"
            onClick={() => onLocate(target)}
          >
            <UiIcon name="locate" />
          </button>
          <button
            type="button"
            aria-label="從內文刪除"
            title="從內文刪除"
            disabled={busyAction !== null}
            onClick={() => void requestDelete()}
          >
            <UiIcon name="trash" />
          </button>
          <button
            type="button"
            aria-label="另存新檔"
            title="另存新檔"
            disabled={busyAction !== null}
            onClick={() => void saveAs()}
          >
            <UiIcon name="download" />
          </button>
          <button
            type="button"
            aria-label="複製到剪貼簿"
            title="複製到剪貼簿"
            disabled={busyAction !== null}
            onClick={() => void copyImage()}
          >
            <UiIcon name="copy" />
          </button>
          <button
            type="button"
            aria-label="縮小"
            title="縮小"
            onClick={() => changeZoom(1 / 1.25)}
          >
            {zoomOutIcon()}
          </button>
          <button
            className="source-line-preview-zoom"
            type="button"
            aria-label="重設縮放與位置"
            title="重設縮放與位置"
            onClick={resetView}
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            type="button"
            aria-label="放大"
            title="放大"
            onClick={() => changeZoom(1.25)}
          >
            {zoomInIcon()}
          </button>
          <button
            type="button"
            aria-label={maximized ? '還原預覽' : '放大預覽'}
            title={maximized ? '還原預覽' : '放大預覽'}
            onClick={() => setMaximized((value) => !value)}
          >
            {maximizeIcon(maximized)}
          </button>
          <button
            type="button"
            aria-label="關閉浮動預覽"
            title="關閉預覽"
            onClick={onClose}
          >
            {closeIcon()}
          </button>
        </div>
      </header>
      <div
        className={`source-line-preview-body ${mediaKindClass(target.kind)}`}
        onPointerDown={startPan}
        onPointerMove={movePan}
        onPointerUp={stopPan}
        onPointerCancel={stopPan}
        onWheel={(event) => {
          event.preventDefault();
          changeZoom(event.deltaY < 0 ? 1.12 : 1 / 1.12);
        }}
      >
        <button
          type="button"
          className="source-line-preview-nav previous"
          aria-label="上一張"
          title="上一張（←）"
          disabled={items.length < 2}
          onClick={() => selectRelative(-1)}
        >
          <UiIcon name="chevron-right" />
        </button>
        {actionMessage && (
          <div className="source-line-preview-action-message" role="status">
            {actionMessage}
          </div>
        )}
        {loading && <div className="source-line-preview-status">正在準備預覽…</div>}
        {error && (
          <div className="source-line-preview-status is-error">
            <strong>{target.kind === 'mermaid' ? 'Mermaid 無法預覽' : '圖片無法載入'}</strong>
            <span>{error}</span>
          </div>
        )}
        {!error && source && (
          <img
            src={source}
            alt={target.kind === 'image' ? target.alt : 'Mermaid 流程圖'}
            draggable={false}
            style={imageStyle}
            onLoad={() => setLoading(false)}
            onError={() => {
              setLoading(false);
              setError(target.kind === 'mermaid' ? '圖表無法轉成影像' : '找不到或無法讀取圖片');
            }}
          />
        )}
        <button
          type="button"
          className="source-line-preview-nav next"
          aria-label="下一張"
          title="下一張（→）"
          disabled={items.length < 2}
          onClick={() => selectRelative(1)}
        >
          <UiIcon name="chevron-right" />
        </button>
      </div>
      <div className="source-line-preview-gallery" role="listbox" aria-label="筆記媒體畫廊">
        {items.map((item) => (
          <PreviewThumbnail
            key={item.id}
            item={item}
            active={item.id === target.id}
            onSelect={() => onSelect(item)}
          />
        ))}
      </div>
      {!maximized && resizeHandles.map((handle) => (
        <span
          key={handle}
          className={`source-line-preview-resize ${resizeHandleClass[handle]}`}
          aria-hidden="true"
          onPointerDown={(event) => startResize(event, handle)}
          onPointerMove={resizeWindow}
          onPointerUp={stopResize}
          onPointerCancel={stopResize}
        />
      ))}
    </div>,
    document.body,
  );
}
