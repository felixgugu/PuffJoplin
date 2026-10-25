import { createPortal } from 'react-dom';
import UiIcon from './UiIcon';
import type { Resource } from './types';

export type EditorMediaContextTarget =
  | {
      kind: 'mermaid';
      x: number;
      y: number;
      code: string;
      index: number;
      count: number;
    }
  | {
      kind: 'image';
      x: number;
      y: number;
      resource: Resource;
    };

interface EditorMediaContextMenuProps {
  target: EditorMediaContextTarget;
  busy: boolean;
  onCopyImage: () => void;
  onCopyFile: () => void;
  onClose: () => void;
}

export default function EditorMediaContextMenu({
  target,
  busy,
  onCopyImage,
  onCopyFile,
  onClose,
}: EditorMediaContextMenuProps) {
  const imageLabel = target.kind === 'mermaid'
    ? '複製 PNG 影像'
    : /\.svg$/i.test(target.resource.filename)
      ? '複製 PNG 影像'
      : '複製影像';
  const fileLabel = target.kind === 'mermaid'
    ? '複製 SVG 檔案'
    : '複製檔案';
  const title = target.kind === 'mermaid'
    ? `Mermaid 圖表 ${target.index + 1}/${target.count}`
    : target.resource.filename || '圖片附件';

  return createPortal(
    <div
      className="notebook-context-menu editor-media-context-menu"
      role="menu"
      aria-label={`${title} 操作`}
      style={{
        left: Math.max(8, Math.min(target.x, window.innerWidth - 232)),
        top: Math.max(8, Math.min(target.y, window.innerHeight - 112)),
      }}
      onPointerDown={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.preventDefault()}
    >
      <div className="context-menu-title">{title}</div>
      <button
        type="button"
        role="menuitem"
        disabled={busy}
        onClick={onCopyImage}
      >
        <UiIcon name="copy" />
        {imageLabel}
      </button>
      <button
        type="button"
        role="menuitem"
        disabled={busy}
        onClick={onCopyFile}
      >
        <UiIcon name="copy" />
        {fileLabel}
      </button>
      <button
        type="button"
        role="menuitem"
        className="close-row"
        disabled={busy}
        onClick={onClose}
      >
        <UiIcon name="close" />
        關閉
      </button>
    </div>,
    document.body,
  );
}
