import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from './api';
import {
  markdownCellToPlainText,
  tableToTsv,
  type MarkdownTable,
} from './markdownTables';
import { convertTablesToXlsxBase64, xlsxExportFilename } from './tableExport';
import UiIcon from './UiIcon';

interface TableOverviewDialogProps {
  tables: readonly MarkdownTable[];
  noteTitle: string;
  onClose: () => void;
  onLocate: (table: MarkdownTable) => void;
}

interface DialogMessage {
  text: string;
  error: boolean;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
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

function alignmentStyle(
  table: MarkdownTable,
  column: number,
): 'left' | 'center' | 'right' {
  const alignment = table.alignments[column];
  if (alignment === 'center') return 'center';
  if (alignment === 'right') return 'right';
  return 'left';
}

export default function TableOverviewDialog({
  tables,
  noteTitle,
  onClose,
  onLocate,
}: TableOverviewDialogProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [busy, setBusy] = useState<'copy' | 'export' | null>(null);
  const [maximized, setMaximized] = useState(false);
  const [message, setMessage] = useState<DialogMessage | null>(null);
  const activeTable = tables[Math.min(activeIndex, tables.length - 1)];

  useEffect(() => {
    dialogRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    if (activeIndex < tables.length) return;
    setActiveIndex(Math.max(0, tables.length - 1));
  }, [activeIndex, tables.length]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, left: 0 });
  }, [activeIndex]);

  useEffect(() => {
    if (!message || message.error) return undefined;
    const timer = window.setTimeout(() => setMessage(null), 2800);
    return () => window.clearTimeout(timer);
  }, [message]);

  if (!activeTable) return null;

  const selectTable = (index: number) => {
    setMessage(null);
    setActiveIndex(Math.max(0, Math.min(index, tables.length - 1)));
  };

  const selectRelative = (direction: -1 | 1) => {
    if (tables.length < 2) return;
    selectTable((activeIndex + direction + tables.length) % tables.length);
  };

  const copyTsv = async () => {
    if (busy) return;
    setBusy('copy');
    setMessage(null);
    try {
      await api.copyText(tableToTsv(activeTable));
      setMessage({ text: `已複製表格 ${activeTable.index} 的 TSV`, error: false });
    } catch (error) {
      setMessage({ text: `複製失敗：${errorMessage(error)}`, error: true });
    } finally {
      setBusy(null);
    }
  };

  const exportXlsx = async () => {
    if (busy) return;
    setBusy('export');
    setMessage(null);
    try {
      const dataBase64 = await convertTablesToXlsxBase64(tables);
      const path = await api.saveXlsxAs(xlsxExportFilename(noteTitle), dataBase64);
      if (!path) {
        setMessage({ text: '已取消匯出', error: false });
        return;
      }
      setMessage({ text: `已匯出至 ${path}`, error: false });
      try {
        await api.openFilePath(path);
      } catch (error) {
        setMessage({
          text: `已匯出，但無法開啟檔案：${errorMessage(error)}`,
          error: true,
        });
      }
    } catch (error) {
      setMessage({ text: `匯出失敗：${errorMessage(error)}`, error: true });
    } finally {
      setBusy(null);
    }
  };

  return createPortal(
    <div
      className="modal-backdrop table-overview-backdrop"
      onMouseDown={busy ? undefined : onClose}
    >
      <div
        ref={dialogRef}
        className={`modal-card table-overview-dialog ${maximized ? 'is-maximized' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="table-overview-title"
        tabIndex={-1}
        onMouseDown={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && !busy) {
            event.preventDefault();
            onClose();
          } else if (event.key === 'ArrowLeft') {
            event.preventDefault();
            selectRelative(-1);
          } else if (event.key === 'ArrowRight') {
            event.preventDefault();
            selectRelative(1);
          }
        }}
      >
        <header>
          <div>
            <span className="eyebrow">表格</span>
            <h2 id="table-overview-title">表格總覽</h2>
            <p>{noteTitle || '未命名筆記'} · 共 {tables.length} 張表格</p>
          </div>
          <div className="table-overview-header-actions">
            <button
              type="button"
              title="定位到內文"
              aria-label="定位到內文"
              disabled={busy !== null}
              onClick={() => onLocate(activeTable)}
            >
              <UiIcon name="locate" />
            </button>
            <button
              type="button"
              title="複製目前表格 TSV"
              aria-label="複製目前表格 TSV"
              disabled={busy !== null}
              onClick={() => void copyTsv()}
            >
              <UiIcon name="copy" />
            </button>
            <button
              type="button"
              title={busy === 'export' ? '正在產生 Excel…' : '匯出全部表格為 Excel'}
              aria-label="匯出全部表格為 Excel"
              aria-busy={busy === 'export'}
              disabled={busy !== null}
              onClick={() => void exportXlsx()}
            >
              <UiIcon name="download" />
            </button>
            <button
              type="button"
              title={maximized ? '還原大小' : '放到最大'}
              aria-label={maximized ? '還原表格總覽大小' : '放到最大'}
              onClick={() => setMaximized((value) => !value)}
            >
              {maximizeIcon(maximized)}
            </button>
            <button
              type="button"
              title="關閉"
              aria-label="關閉表格總覽"
              disabled={busy !== null}
              onClick={onClose}
            >
              <UiIcon name="close" />
            </button>
          </div>
        </header>

        <div className="table-overview-meta">
          <span>表格 {activeTable.index} / {tables.length}</span>
          <span>第 {activeTable.startLine}–{activeTable.endLine} 行</span>
          <span>{activeTable.rows.length} 列 × {activeTable.columnCount} 欄</span>
          {activeTable.heading && (
            <span className="table-overview-heading">{activeTable.heading}</span>
          )}
        </div>

        <div className="table-overview-body">
          <button
            className="table-overview-nav previous"
            type="button"
            title="上一張表格（←）"
            aria-label="上一張表格"
            disabled={tables.length < 2}
            onClick={() => selectRelative(-1)}
          >
            <UiIcon name="chevron-right" />
          </button>
          <div ref={scrollRef} className="table-overview-scroll">
            <table className="table-overview-table">
              <thead>
                <tr>
                  {activeTable.headers.map((cell, column) => (
                    <th
                      key={`header-${column}`}
                      style={{ textAlign: alignmentStyle(activeTable, column) }}
                    >
                      {markdownCellToPlainText(cell)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {activeTable.rows.map((row, rowIndex) => (
                  <tr key={`row-${rowIndex}`}>
                    {row.map((cell, column) => (
                      <td
                        key={`cell-${column}`}
                        style={{ textAlign: alignmentStyle(activeTable, column) }}
                      >
                        {markdownCellToPlainText(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            className="table-overview-nav next"
            type="button"
            title="下一張表格（→）"
            aria-label="下一張表格"
            disabled={tables.length < 2}
            onClick={() => selectRelative(1)}
          >
            <UiIcon name="chevron-right" />
          </button>
        </div>

        <div className="table-overview-switcher" role="tablist" aria-label="表格清單">
          {tables.map((table, index) => (
            <button
              key={table.id}
              type="button"
              role="tab"
              aria-selected={index === activeIndex}
              className={`table-overview-switcher-item ${index === activeIndex ? 'is-active' : ''}`}
              title={`第 ${table.startLine}–${table.endLine} 行 · ${table.rows.length} 列 × ${table.columnCount} 欄`}
              onClick={() => selectTable(index)}
            >
              <span>表格 {table.index}</span>
              <small>{table.rows.length}×{table.columnCount}</small>
            </button>
          ))}
        </div>

        <footer className="table-overview-footer">
          <span className={message?.error ? 'is-error' : ''} role="status">
            {message?.text ?? ''}
          </span>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
