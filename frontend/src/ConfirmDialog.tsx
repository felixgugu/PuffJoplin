import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import UiIcon from './UiIcon';

export interface ConfirmDialogOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'default' | 'danger';
}

interface ConfirmDialogProps extends ConfirmDialogOptions {
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  title,
  message,
  confirmLabel = '確定',
  cancelLabel = '取消',
  tone = 'default',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const cancelButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    cancelButtonRef.current?.focus();
  }, []);

  return createPortal(
    <div className="modal-backdrop confirm-dialog-backdrop" onMouseDown={onCancel}>
      <div
        className="modal-card confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-message"
        onMouseDown={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            onCancel();
          }
        }}
      >
        <header>
          <div>
            <span className="eyebrow">需要確認</span>
            <h2 id="confirm-dialog-title">{title}</h2>
          </div>
          <button
            className="icon-button"
            type="button"
            aria-label="取消並關閉"
            title="取消"
            onClick={onCancel}
          >
            <UiIcon name="close" />
          </button>
        </header>
        <div className="confirm-dialog-content">
          <p id="confirm-dialog-message">{message}</p>
        </div>
        <footer>
          <button ref={cancelButtonRef} type="button" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            className={tone === 'danger' ? 'primary confirm-dialog-danger' : 'primary'}
            type="button"
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
