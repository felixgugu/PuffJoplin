import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import FreeNumberInput from './FreeNumberInput';
import {
  alignPDFCoverElements,
  centerPDFCoverElements,
  coverPreviewFontSizePx,
  coverPreviewText,
  movePDFCoverElement,
  movePDFCoverElements,
  pdfCoverDefinition,
  pdfCoverDefinitions,
  PDF_COVER_FONT_SIZE_RANGE,
  PDF_COVER_GLOBAL_FOOTER_KEY,
  PDF_COVER_MARGIN_BOTTOM_MM,
  PDF_COVER_MARGIN_SIDE_MM,
  PDF_COVER_MARGIN_TOP_MM,
  PDF_COVER_PAGE_HEIGHT_MM,
  PDF_COVER_PAGE_WIDTH_MM,
  PDF_COVER_POSITION_STEP_MM,
  pdfCoverMarginGuideLayout,
  updatePDFCoverElement,
  type PDFCoverAlignment,
  type PDFCoverDesign,
  type PDFCoverElement,
} from './coverDesign';
import { normalizeNoteInfoFields } from './noteInfo';
import type { NoteInfoField } from './types';
import UiIcon from './UiIcon';

interface PdfCoverDesignerProps {
  design: PDFCoverDesign;
  noteTitle: string;
  fields: readonly NoteInfoField[];
  globalFooterCopyright: string;
  onChange: (design: PDFCoverDesign) => void;
  onReset: () => void;
}

type CoverDragState = {
  pointerID: number;
  startClientX: number;
  startClientY: number;
  startPositions: Record<string, { xMm: number; yMm: number }>;
};

export default function PdfCoverDesigner({
  design,
  noteTitle,
  fields,
  globalFooterCopyright,
  onChange,
  onReset,
}: PdfCoverDesignerProps) {
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(
    () => new Set(['documentTitle']),
  );
  const [activeKey, setActiveKey] = useState('documentTitle');
  const [spacingMm, setSpacingMm] = useState(8);
  const [fontScale, setFontScale] = useState(1);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<CoverDragState | null>(null);
  const selectionAnchorRef = useRef('documentTitle');
  const normalizedFields = normalizeNoteInfoFields(fields);
  const allKeys = pdfCoverDefinitions().map((definition) => definition.key);
  const selectedElements = design.elements.filter((element) => selectedKeys.has(element.key));
  const activeElement = design.elements.find((element) => element.key === activeKey)
    ?? selectedElements[0];
  const selectedDefinition = pdfCoverDefinition(activeElement?.key ?? '');
  const marginGuide = pdfCoverMarginGuideLayout();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const measure = () => {
      setFontScale((canvas.clientWidth / PDF_COVER_PAGE_WIDTH_MM) * 0.352777778);
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  const selectOnly = useCallback((key: string) => {
    setSelectedKeys(new Set([key]));
    setActiveKey(key);
    selectionAnchorRef.current = key;
  }, []);

  const toggleSelection = useCallback((key: string) => {
    setSelectedKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      setActiveKey(key);
      selectionAnchorRef.current = key;
      return next;
    });
  }, []);

  const selectRange = useCallback((key: string) => {
    const anchorIndex = Math.max(0, allKeys.indexOf(selectionAnchorRef.current));
    const targetIndex = allKeys.indexOf(key);
    if (targetIndex < 0) return;
    const start = Math.min(anchorIndex, targetIndex);
    const end = Math.max(anchorIndex, targetIndex);
    setSelectedKeys(new Set(allKeys.slice(start, end + 1)));
    setActiveKey(key);
  }, [allKeys]);

  const selectFromEvent = useCallback((
    key: string,
    shiftKey: boolean,
    toggleKey: boolean,
  ): Set<string> => {
    if (shiftKey) {
      selectRange(key);
      return new Set(allKeys.slice(
        Math.min(
          Math.max(0, allKeys.indexOf(selectionAnchorRef.current)),
          Math.max(0, allKeys.indexOf(key)),
        ),
        Math.max(
          Math.max(0, allKeys.indexOf(selectionAnchorRef.current)),
          Math.max(0, allKeys.indexOf(key)),
        ) + 1,
      ));
    }
    if (toggleKey) {
      const next = new Set(selectedKeys);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      setSelectedKeys(next);
      setActiveKey(key);
      selectionAnchorRef.current = key;
      return next;
    }
    if (selectedKeys.has(key) && selectedKeys.size > 1) {
      setActiveKey(key);
      selectionAnchorRef.current = key;
      return selectedKeys;
    }
    selectOnly(key);
    return new Set([key]);
  }, [allKeys, selectOnly, selectRange, selectedKeys]);

  const updateElement = useCallback((
    key: string,
    changes: Partial<Omit<PDFCoverElement, 'key'>>,
  ) => {
    onChange(updatePDFCoverElement(design, key, changes));
  }, [design, onChange]);

  const startDrag = (
    event: ReactPointerEvent<HTMLButtonElement>,
    element: PDFCoverElement,
  ) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const nextSelection = selectFromEvent(
      element.key,
      event.shiftKey,
      event.ctrlKey || event.metaKey,
    );
    if (!nextSelection.has(element.key)) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const startPositions = Object.fromEntries(
      design.elements
        .filter((item) => nextSelection.has(item.key))
        .map((item) => [item.key, { xMm: item.xMm, yMm: item.yMm }]),
    );
    dragRef.current = {
      pointerID: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startPositions,
    };
  };

  const dragElement = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    const canvas = canvasRef.current;
    if (!drag || drag.pointerID !== event.pointerId || !canvas) return;
    const bounds = canvas.getBoundingClientRect();
    const deltaX = ((event.clientX - drag.startClientX) / bounds.width) * PDF_COVER_PAGE_WIDTH_MM;
    const deltaY = ((event.clientY - drag.startClientY) / bounds.height) * PDF_COVER_PAGE_HEIGHT_MM;
    onChange(movePDFCoverElements(design, drag.startPositions, deltaX, deltaY));
  };

  const stopDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (dragRef.current?.pointerID !== event.pointerId) return;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const nudgeElement = (
    event: ReactKeyboardEvent<HTMLButtonElement>,
    element: PDFCoverElement,
  ) => {
    const amount = event.shiftKey ? PDF_COVER_POSITION_STEP_MM * 10 : PDF_COVER_POSITION_STEP_MM;
    const changes: Partial<Pick<PDFCoverElement, 'xMm' | 'yMm'>> = {};
    if (event.key === 'ArrowLeft') changes.xMm = element.xMm - amount;
    else if (event.key === 'ArrowRight') changes.xMm = element.xMm + amount;
    else if (event.key === 'ArrowUp') changes.yMm = element.yMm - amount;
    else if (event.key === 'ArrowDown') changes.yMm = element.yMm + amount;
    else return;
    event.preventDefault();
    onChange(movePDFCoverElement(
      design,
      element.key,
      changes.xMm ?? element.xMm,
      changes.yMm ?? element.yMm,
    ));
  };

  const alignSelected = (alignment: 'left' | 'center') => {
    const canvas = canvasRef.current;
    if (!canvas || selectedElements.length === 0) return;
    const bounds = canvas.getBoundingClientRect();
    const measuredHeights = Object.fromEntries(
      selectedElements.map((element) => {
        const node = canvas.querySelector<HTMLElement>(
          `[data-cover-key="${element.key}"]`,
        );
        return [
          element.key,
          node ? node.getBoundingClientRect().height / bounds.height * PDF_COVER_PAGE_HEIGHT_MM : 0,
        ];
      }),
    );
    onChange(alignPDFCoverElements(
      design,
      selectedElements.map((element) => element.key),
      alignment,
      spacingMm,
      measuredHeights,
    ));
  };

  const centerSelected = (axis: 'horizontal' | 'vertical') => {
    const canvas = canvasRef.current;
    const enabledSelection = selectedElements.filter((element) => element.enabled);
    if (!canvas || enabledSelection.length === 0) return;
    const canvasBounds = canvas.getBoundingClientRect();
    const elementBounds = enabledSelection
      .map((element) => canvas.querySelector<HTMLElement>(
        `[data-cover-key="${element.key}"]`,
      )?.getBoundingClientRect())
      .filter((bounds): bounds is DOMRect => Boolean(bounds));
    if (elementBounds.length === 0) return;
    const left = Math.min(...elementBounds.map((bounds) => bounds.left));
    const top = Math.min(...elementBounds.map((bounds) => bounds.top));
    const right = Math.max(...elementBounds.map((bounds) => bounds.right));
    const bottom = Math.max(...elementBounds.map((bounds) => bounds.bottom));
    onChange(centerPDFCoverElements(
      design,
      enabledSelection.map((element) => element.key),
      {
        left: (left - canvasBounds.left) / canvasBounds.width * PDF_COVER_PAGE_WIDTH_MM,
        top: (top - canvasBounds.top) / canvasBounds.height * PDF_COVER_PAGE_HEIGHT_MM,
        width: (right - left) / canvasBounds.width * PDF_COVER_PAGE_WIDTH_MM,
        height: (bottom - top) / canvasBounds.height * PDF_COVER_PAGE_HEIGHT_MM,
      },
      axis,
    ));
  };

  return (
    <section className="pdf-cover-designer">
      <div className="pdf-cover-designer-heading">
        <div>
          <strong>封面</strong>
          <span>拖曳變數調整位置；Ctrl、Shift 或核取方塊可多選。</span>
        </div>
        <button type="button" onClick={onReset}>重設版型</button>
      </div>

      <div className="pdf-cover-options">
        <label className="appearance-toggle pdf-cover-enabled">
          <input
            type="checkbox"
            checked={design.enabled}
            onChange={(event) => onChange({ ...design, enabled: event.target.checked })}
          />
          <span className="appearance-toggle-track" aria-hidden="true" />
          <span>在 PDF 第一頁加入封面</span>
        </label>
        <label className="appearance-toggle pdf-cover-enabled">
          <input
            type="checkbox"
            checked={design.includeWatermark}
            onChange={(event) => onChange({
              ...design,
              includeWatermark: event.target.checked,
            })}
          />
          <span className="appearance-toggle-track" aria-hidden="true" />
          <span>封面加入浮水印</span>
        </label>
      </div>
      <p className="pdf-cover-option-help">
        封面預設不加浮水印；內文頁仍依全域 PDF 裝飾設定顯示。
      </p>
      <p className="pdf-cover-margin-help">
        虛線框為頁面邊距：上 {PDF_COVER_MARGIN_TOP_MM} mm、左右 {PDF_COVER_MARGIN_SIDE_MM} mm、下 {PDF_COVER_MARGIN_BOTTOM_MM} mm。
      </p>

      <div className="pdf-cover-designer-layout">
        <div className="pdf-cover-canvas-shell">
          <div
            ref={canvasRef}
            className="pdf-cover-canvas"
            aria-label="A4 封面設計畫布"
            onPointerDown={(event) => {
              if (event.target === event.currentTarget) {
                setSelectedKeys(new Set());
                setActiveKey('');
              }
            }}
          >
            <span className="pdf-cover-canvas-label">A4 · 210 × 297 mm</span>
            <div
              className="pdf-cover-margin-guide"
              aria-hidden="true"
              style={{
                left: `${marginGuide.leftPercent}%`,
                top: `${marginGuide.topPercent}%`,
                width: `${marginGuide.widthPercent}%`,
                height: `${marginGuide.heightPercent}%`,
              }}
            />
            {design.elements.filter((element) => element.enabled).map((element) => {
              const text = coverPreviewText(
                element,
                normalizedFields,
                noteTitle,
                globalFooterCopyright,
              );
              const definition = pdfCoverDefinition(element.key);
              const isPlaceholder = text.includes('（尚未填寫）');
              const canWrap = element.alignment === 'center';
              const style: CSSProperties = {
                left: `${element.xMm / PDF_COVER_PAGE_WIDTH_MM * 100}%`,
                top: `${element.yMm / PDF_COVER_PAGE_HEIGHT_MM * 100}%`,
                fontSize: coverPreviewFontSizePx(element.fontSize, fontScale),
                fontWeight: definition?.weight ?? 400,
                textAlign: element.alignment,
                transform: element.alignment === 'center'
                  ? 'translateX(-50%)'
                  : element.alignment === 'right' ? 'translateX(-100%)' : undefined,
              };
              return (
                <button
                  type="button"
                  key={element.key}
                  data-cover-key={element.key}
                  className={[
                    'pdf-cover-canvas-element',
                    canWrap ? 'can-wrap' : '',
                    selectedKeys.has(element.key) ? 'selected' : '',
                    activeKey === element.key ? 'active' : '',
                    isPlaceholder ? 'placeholder' : '',
                    element.key === PDF_COVER_GLOBAL_FOOTER_KEY ? 'copyright' : '',
                  ].filter(Boolean).join(' ')}
                  style={style}
                  aria-label={`${definition?.defaultLabel ?? element.key}，X ${element.xMm} mm，Y ${element.yMm} mm`}
                  aria-pressed={selectedKeys.has(element.key)}
                  onPointerDown={(event) => startDrag(event, element)}
                  onPointerMove={dragElement}
                  onPointerUp={stopDrag}
                  onPointerCancel={stopDrag}
                  onKeyDown={(event) => nudgeElement(event, element)}
                >
                  {text}
                </button>
              );
            })}
          </div>
        </div>

        <div className="pdf-cover-inspector">
          <div className="pdf-cover-bulk-actions">
            <strong>已選 {selectedElements.length} 項</strong>
            <label>
              <span>文字間距</span>
              <div>
                <FreeNumberInput
                  value={spacingMm}
                  ariaLabel="文字間距（毫米）"
                  min={0}
                  max={50}
                  precision={2}
                  onCommit={setSpacingMm}
                  onDraftChange={setSpacingMm}
                />
                <span>mm</span>
              </div>
            </label>
            <div>
              <button
                type="button"
                disabled={selectedElements.length === 0}
                onClick={() => alignSelected('left')}
              >
                對齊左邊
              </button>
              <button
                type="button"
                disabled={selectedElements.length === 0}
                onClick={() => alignSelected('center')}
              >
                對齊中間
              </button>
            </div>
            <div className="pdf-cover-center-actions">
              <button
                type="button"
                title="將選取變數的群組水平中心對齊頁面中心"
                disabled={selectedElements.every((element) => !element.enabled)}
                onClick={() => centerSelected('horizontal')}
              >
                水平置中
              </button>
              <button
                type="button"
                title="將選取變數的群組垂直中心對齊頁面中心"
                disabled={selectedElements.every((element) => !element.enabled)}
                onClick={() => centerSelected('vertical')}
              >
                垂直置中
              </button>
            </div>
          </div>

          <div className="pdf-cover-variable-list" role="listbox" aria-label="封面變數">
            {pdfCoverDefinitions().map((definition) => {
              const element = design.elements.find((item) => item.key === definition.key);
              const text = element
                ? coverPreviewText(
                    element,
                    normalizedFields,
                    noteTitle,
                    globalFooterCopyright,
                  )
                : '';
              const checked = selectedKeys.has(definition.key);
              return (
                <div
                  className={[
                    'pdf-cover-variable-row',
                    element?.enabled ? '' : 'disabled',
                    checked ? 'selected' : '',
                    activeElement?.key === definition.key ? 'active' : '',
                  ].filter(Boolean).join(' ')}
                  key={definition.key}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    aria-label={`選取${definition.defaultLabel}`}
                    onChange={(event) => {
                      if (event.nativeEvent instanceof MouseEvent && event.nativeEvent.shiftKey) {
                        selectRange(definition.key);
                      } else {
                        toggleSelection(definition.key);
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="pdf-cover-variable-select"
                    role="option"
                    aria-selected={checked}
                    onClick={(event) => {
                      selectFromEvent(
                        definition.key,
                        event.shiftKey,
                        event.ctrlKey || event.metaKey,
                      );
                    }}
                  >
                    <span>{definition.defaultLabel}</span>
                    <small>{text}</small>
                  </button>
                  {element && (
                    <button
                      className={`pdf-cover-visibility-toggle ${element.enabled ? 'is-enabled' : ''}`}
                      type="button"
                      aria-label={`${element.enabled ? '停用' : '啟用'}${definition.defaultLabel}`}
                      title={`${element.enabled ? '停用' : '啟用'}${definition.defaultLabel}`}
                      onClick={() => updateElement(element.key, { enabled: !element.enabled })}
                    >
                      <UiIcon name={element.enabled ? 'eye' : 'eye-off'} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {selectedElements.length === 1 && activeElement && (
            <div className="pdf-cover-properties">
              <strong>{selectedDefinition?.defaultLabel ?? activeElement.key}</strong>
              <div className="pdf-cover-property-grid">
                <label>
                  <span>X 座標</span>
                  <div><FreeNumberInput
                    value={activeElement.xMm}
                    ariaLabel="X 座標（毫米）"
                    min={0}
                    max={PDF_COVER_PAGE_WIDTH_MM}
                    precision={1}
                    onCommit={(xMm) => updateElement(activeElement.key, { xMm })}
                    onDraftChange={(xMm) => updateElement(activeElement.key, { xMm })}
                  /><span>mm</span></div>
                </label>
                <label>
                  <span>Y 座標</span>
                  <div><FreeNumberInput
                    value={activeElement.yMm}
                    ariaLabel="Y 座標（毫米）"
                    min={0}
                    max={PDF_COVER_PAGE_HEIGHT_MM}
                    precision={1}
                    onCommit={(yMm) => updateElement(activeElement.key, { yMm })}
                    onDraftChange={(yMm) => updateElement(activeElement.key, { yMm })}
                  /><span>mm</span></div>
                </label>
                <label>
                  <span>字級</span>
                  <div><FreeNumberInput
                    value={activeElement.fontSize}
                    ariaLabel="字級（點）"
                    min={PDF_COVER_FONT_SIZE_RANGE[0]}
                    max={PDF_COVER_FONT_SIZE_RANGE[1]}
                    precision={1}
                    onCommit={(fontSize) => updateElement(activeElement.key, { fontSize })}
                    onDraftChange={(fontSize) => updateElement(activeElement.key, { fontSize })}
                  /><span>pt</span></div>
                </label>
              </div>
              <div className="pdf-cover-alignment">
                <span>對齊</span>
                <div>
                  {(['left', 'center', 'right'] as PDFCoverAlignment[]).map((alignment) => (
                    <button
                      type="button"
                      className={activeElement.alignment === alignment ? 'active' : ''}
                      key={alignment}
                      onClick={() => updateElement(activeElement.key, { alignment })}
                    >
                      {alignment === 'left' ? '左' : alignment === 'center' ? '中' : '右'}
                    </button>
                  ))}
                </div>
              </div>
              {activeElement.key !== PDF_COVER_GLOBAL_FOOTER_KEY && (
                <label className="appearance-toggle pdf-cover-show-label">
                  <input
                    type="checkbox"
                    checked={activeElement.showLabel}
                    onChange={(event) => updateElement(activeElement.key, {
                      showLabel: event.target.checked,
                    })}
                  />
                  <span className="appearance-toggle-track" aria-hidden="true" />
                  <span>在封面顯示參數名稱</span>
                </label>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
