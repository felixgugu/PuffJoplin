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
import UiIcon from './UiIcon';

interface SourceLinePreviewProps {
  target: SourcePreviewTarget;
  anchor: SourcePreviewLine['anchor'];
  onClose: () => void;
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

const mermaidPreviewCache = new Map<string, Promise<string>>();
const minimumZoom = 0.25;
const maximumZoom = 8;

function mermaidPreviewSource(code: string): Promise<string> {
  const cached = mermaidPreviewCache.get(code);
  if (cached) return cached;
  const pending = renderMermaidImage(code, 'svg').then((image) =>
    `data:image/svg+xml;base64,${bytesToBase64(image.data)}`);
  mermaidPreviewCache.set(code, pending);
  pending.catch(() => mermaidPreviewCache.delete(code));
  return pending;
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

export default function SourceLinePreview({
  target,
  anchor,
  onClose,
}: SourceLinePreviewProps) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const panRef = useRef<PanState | null>(null);
  const positionedTargetRef = useRef('');
  const userMovedRef = useRef(false);
  const [position, setPosition] = useState({ left: 0, top: 0, ready: false });
  const [maximized, setMaximized] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [mermaidSource, setMermaidSource] = useState('');
  const [loading, setLoading] = useState(target.kind === 'mermaid');
  const [error, setError] = useState('');
  const [busyAction, setBusyAction] = useState<'save' | 'copy' | null>(null);
  const [actionMessage, setActionMessage] = useState('');

  const targetKey = target.kind === 'image'
    ? `image:${target.lineNumber}:${target.src}`
    : `mermaid:${target.lineNumber}:${target.code}`;

  useEffect(() => {
    positionedTargetRef.current = '';
    userMovedRef.current = false;
    setMaximized(false);
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
  }, [target, targetKey]);

  useEffect(() => {
    if (!actionMessage) return undefined;
    const timer = window.setTimeout(() => setActionMessage(''), 2600);
    return () => window.clearTimeout(timer);
  }, [actionMessage]);

  useLayoutEffect(() => {
    if (maximized) return;
    const card = cardRef.current;
    if (!card) return;
    const targetChanged = positionedTargetRef.current !== targetKey;
    if (!targetChanged && userMovedRef.current) return;
    const rect = card.getBoundingClientRect();
    const margin = 12;
    let left = anchor.right + 14;
    if (left + rect.width > window.innerWidth - margin) {
      left = anchor.left - rect.width - 14;
    }
    if (left < margin) left = margin;
    let top = anchor.top;
    if (top + rect.height > window.innerHeight - margin) {
      top = window.innerHeight - rect.height - margin;
    }
    setPosition({
      left,
      top: Math.max(margin, top),
      ready: true,
    });
    positionedTargetRef.current = targetKey;
  }, [anchor, maximized, mermaidSource, loading, error, targetKey]);

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
    const card = cardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const margin = 8;
    const left = Math.max(
      margin,
      Math.min(
        drag.originLeft + event.clientX - drag.startX,
        window.innerWidth - rect.width - margin,
      ),
    );
    const top = Math.max(
      margin,
      Math.min(
        drag.originTop + event.clientY - drag.startY,
        window.innerHeight - rect.height - margin,
      ),
    );
    userMovedRef.current = true;
    setPosition({ left, top, ready: true });
  };

  const stopDrag = (event: ReactPointerEvent<HTMLElement>) => {
    if (dragRef.current?.pointerID !== event.pointerId) return;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const startPan = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
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

  const source = target.kind === 'image' ? target.src : mermaidSource;
  const title = target.kind === 'image' ? '圖片預覽' : 'Mermaid 預覽';
  const imageStyle: CSSProperties = {
    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
  };

  return createPortal(
    <div
      ref={cardRef}
      className={`source-line-preview${maximized ? ' is-maximized' : ''}`}
      role="dialog"
      aria-label={`${title}，第 ${target.lineNumber} 行`}
      style={maximized ? undefined : {
        left: position.left,
        top: position.top,
        opacity: position.ready ? 1 : 0,
      }}
      onPointerDown={(event) => event.stopPropagation()}
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
          <span>第 {target.lineNumber} 行</span>
        </div>
        <div className="source-line-preview-actions">
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
        className={`source-line-preview-body is-${target.kind}`}
        onPointerDown={startPan}
        onPointerMove={movePan}
        onPointerUp={stopPan}
        onPointerCancel={stopPan}
        onWheel={(event) => {
          event.preventDefault();
          changeZoom(event.deltaY < 0 ? 1.12 : 1 / 1.12);
        }}
      >
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
      </div>
    </div>,
    document.body,
  );
}
