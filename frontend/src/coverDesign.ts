import {
  NOTE_INFO_DEFINITIONS,
  normalizeNoteInfoFields,
  type NoteInfoDefinition,
} from './noteInfo';
import type { NoteInfoField } from './types';

export const PDF_COVER_DESIGN_KEY = 'pdf.coverDesign';
export const PDF_COVER_GLOBAL_FOOTER_KEY = 'globalFooterCopyright';
export const PDF_COVER_PAGE_WIDTH_MM = 210;
export const PDF_COVER_PAGE_HEIGHT_MM = 297;
export const PDF_COVER_MARGIN_TOP_MM = 25.4;
export const PDF_COVER_MARGIN_SIDE_MM = 19;
export const PDF_COVER_MARGIN_BOTTOM_MM = 12.5;
export const PDF_COVER_FONT_SIZE_RANGE = [8, 48] as const;
export const PDF_COVER_POSITION_STEP_MM = 0.5;

export type PDFCoverAlignment = 'left' | 'center' | 'right';

export interface PDFCoverElement {
  key: string;
  enabled: boolean;
  xMm: number;
  yMm: number;
  fontSize: number;
  alignment: PDFCoverAlignment;
  showLabel: boolean;
}

export interface PDFCoverBoundsMm {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface PDFCoverMarginGuideLayout {
  topPercent: number;
  leftPercent: number;
  widthPercent: number;
  heightPercent: number;
}

export interface PDFCoverDesign {
  version: 2;
  enabled: boolean;
  includeWatermark: boolean;
  elements: PDFCoverElement[];
}

const DEFAULT_COVER_ELEMENTS: readonly PDFCoverElement[] = [
  { key: 'companyName', enabled: true, xMm: 25, yMm: 25.6, fontSize: 15, alignment: 'left', showLabel: false },
  { key: 'documentNumber', enabled: true, xMm: 185, yMm: 41.3, fontSize: 10, alignment: 'right', showLabel: true },
  { key: 'version', enabled: true, xMm: 112, yMm: 49.7, fontSize: 10, alignment: 'left', showLabel: true },
  { key: 'classification', enabled: true, xMm: 151, yMm: 49.7, fontSize: 10, alignment: 'left', showLabel: true },
  { key: 'documentTitle', enabled: true, xMm: 105, yMm: 93.7, fontSize: 30, alignment: 'center', showLabel: false },
  { key: 'subtitle', enabled: true, xMm: 105, yMm: 121, fontSize: 16, alignment: 'center', showLabel: false },
  { key: 'scope', enabled: true, xMm: 105, yMm: 138.1, fontSize: 11, alignment: 'center', showLabel: false },
  { key: 'preparedByUnit', enabled: true, xMm: 55, yMm: 181, fontSize: 11, alignment: 'left', showLabel: true },
  { key: 'preparedBy', enabled: true, xMm: 55, yMm: 194.5, fontSize: 11, alignment: 'left', showLabel: true },
  { key: 'submittedTo', enabled: true, xMm: 55, yMm: 208, fontSize: 11, alignment: 'left', showLabel: true },
  { key: 'issueDate', enabled: true, xMm: 55, yMm: 221.5, fontSize: 11, alignment: 'left', showLabel: true },
  { key: 'footerText', enabled: true, xMm: 105, yMm: 280.7, fontSize: 8, alignment: 'center', showLabel: false },
  {
    key: PDF_COVER_GLOBAL_FOOTER_KEY,
    enabled: true,
    xMm: 105,
    yMm: 275.5,
    fontSize: 8,
    alignment: 'center',
    showLabel: false,
  },
] as const;

export const DEFAULT_PDF_COVER_DESIGN: PDFCoverDesign = {
  version: 2,
  enabled: false,
  includeWatermark: false,
  elements: DEFAULT_COVER_ELEMENTS.map((element) => ({ ...element })),
};

export function pdfCoverMarginGuideLayout(): PDFCoverMarginGuideLayout {
  const width = PDF_COVER_PAGE_WIDTH_MM - PDF_COVER_MARGIN_SIDE_MM * 2;
  const height = PDF_COVER_PAGE_HEIGHT_MM
    - PDF_COVER_MARGIN_TOP_MM
    - PDF_COVER_MARGIN_BOTTOM_MM;
  return {
    topPercent: PDF_COVER_MARGIN_TOP_MM / PDF_COVER_PAGE_HEIGHT_MM * 100,
    leftPercent: PDF_COVER_MARGIN_SIDE_MM / PDF_COVER_PAGE_WIDTH_MM * 100,
    widthPercent: width / PDF_COVER_PAGE_WIDTH_MM * 100,
    heightPercent: height / PDF_COVER_PAGE_HEIGHT_MM * 100,
  };
}

export function clampCoverPosition(value: unknown, fallback: number, maximum: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.round(Math.max(0, Math.min(maximum, parsed)) * 10) / 10;
}

export function clampCoverFontSize(value: unknown, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.round(
    Math.max(PDF_COVER_FONT_SIZE_RANGE[0], Math.min(PDF_COVER_FONT_SIZE_RANGE[1], parsed)) * 10,
  ) / 10;
}

export function normalizePDFCoverDesign(value: unknown): PDFCoverDesign {
  const source = value && typeof value === 'object'
    ? value as Partial<PDFCoverDesign>
    : {};
  const legacyVersion = Number(source.version) < 2;
  const sourceElements = Array.isArray(source.elements) ? source.elements : [];
  const byKey = new Map<string, Partial<PDFCoverElement>>();
  sourceElements.forEach((element) => {
    if (element && typeof element === 'object' && typeof element.key === 'string') {
      byKey.set(element.key, element as Partial<PDFCoverElement>);
    }
  });
  return {
    version: 2,
    enabled: source.enabled === true,
    includeWatermark: source.includeWatermark === true,
    elements: DEFAULT_COVER_ELEMENTS.map((fallback) => {
      const element = byKey.get(fallback.key);
      const alignment = element?.alignment;
      return {
        key: fallback.key,
        enabled: legacyVersion
          ? fallback.enabled
          : typeof element?.enabled === 'boolean' ? element.enabled : fallback.enabled,
        xMm: clampCoverPosition(element?.xMm, fallback.xMm, PDF_COVER_PAGE_WIDTH_MM),
        yMm: clampCoverPosition(element?.yMm, fallback.yMm, PDF_COVER_PAGE_HEIGHT_MM),
        fontSize: clampCoverFontSize(element?.fontSize, fallback.fontSize),
        alignment: alignment === 'left' || alignment === 'right' || alignment === 'center'
          ? alignment
          : fallback.alignment,
        showLabel: typeof element?.showLabel === 'boolean'
          ? element.showLabel
          : fallback.showLabel,
      };
    }),
  };
}

export function parsePDFCoverDesign(value: string | undefined): PDFCoverDesign {
  if (!value) return normalizePDFCoverDesign(DEFAULT_PDF_COVER_DESIGN);
  try {
    return normalizePDFCoverDesign(JSON.parse(value));
  } catch {
    return normalizePDFCoverDesign(DEFAULT_PDF_COVER_DESIGN);
  }
}

export function serializePDFCoverDesign(design: PDFCoverDesign): string {
  return JSON.stringify(normalizePDFCoverDesign(design));
}

export function updatePDFCoverElement(
  design: PDFCoverDesign,
  key: string,
  changes: Partial<Omit<PDFCoverElement, 'key'>>,
): PDFCoverDesign {
  return normalizePDFCoverDesign({
    ...design,
    elements: design.elements.map((element) =>
      element.key === key ? { ...element, ...changes, key } : element),
  });
}

export function movePDFCoverElement(
  design: PDFCoverDesign,
  key: string,
  xMm: number,
  yMm: number,
): PDFCoverDesign {
  return updatePDFCoverElement(design, key, {
    xMm: clampCoverPosition(xMm, 0, PDF_COVER_PAGE_WIDTH_MM),
    yMm: clampCoverPosition(yMm, 0, PDF_COVER_PAGE_HEIGHT_MM),
  });
}

export function movePDFCoverElements(
  design: PDFCoverDesign,
  startPositions: Readonly<Record<string, { xMm: number; yMm: number }>>,
  deltaX: number,
  deltaY: number,
): PDFCoverDesign {
  return normalizePDFCoverDesign({
    ...design,
    elements: design.elements.map((element) => {
      const start = startPositions[element.key];
      if (!start) return element;
      return {
        ...element,
        xMm: clampCoverPosition(start.xMm + deltaX, element.xMm, PDF_COVER_PAGE_WIDTH_MM),
        yMm: clampCoverPosition(start.yMm + deltaY, element.yMm, PDF_COVER_PAGE_HEIGHT_MM),
      };
    }),
  });
}

export function estimatedPDFCoverHeightMm(element: PDFCoverElement): number {
  return element.fontSize * 1.25 * 25.4 / 72;
}

export function coverPreviewFontSizePx(fontSize: number, scale: number): number {
  if (!Number.isFinite(fontSize) || !Number.isFinite(scale)) return 0;
  return Math.max(0, fontSize * scale);
}

export function alignPDFCoverElements(
  design: PDFCoverDesign,
  keys: readonly string[],
  alignment: Extract<PDFCoverAlignment, 'left' | 'center'>,
  spacingMm: number,
  measuredHeightsMm: Readonly<Record<string, number>> = {},
): PDFCoverDesign {
  const selected = new Set(keys);
  const ordered = design.elements
    .filter((element) => selected.has(element.key))
    .sort((left, right) => left.yMm - right.yMm || left.xMm - right.xMm);
  if (ordered.length === 0) return design;
  const gap = Math.max(0, Math.min(50, Number.isFinite(spacingMm) ? spacingMm : 8));
  const leftXMm = Math.min(...ordered.map((element) => element.xMm));
  const positions = new Map<string, Pick<PDFCoverElement, 'xMm' | 'yMm' | 'alignment'>>();
  let nextY = ordered[0].yMm;
  ordered.forEach((element) => {
    const yMm = clampCoverPosition(nextY, element.yMm, PDF_COVER_PAGE_HEIGHT_MM);
    positions.set(element.key, {
      xMm: alignment === 'center' ? PDF_COVER_PAGE_WIDTH_MM / 2 : leftXMm,
      yMm,
      alignment,
    });
    const height = Math.max(
      0.1,
      measuredHeightsMm[element.key] || estimatedPDFCoverHeightMm(element),
    );
    nextY = yMm + height + gap;
  });
  return normalizePDFCoverDesign({
    ...design,
    elements: design.elements.map((element) => {
      const position = positions.get(element.key);
      return position ? { ...element, ...position } : element;
    }),
  });
}

export function centerPDFCoverElements(
  design: PDFCoverDesign,
  keys: readonly string[],
  bounds: PDFCoverBoundsMm,
  axis: 'horizontal' | 'vertical',
): PDFCoverDesign {
  if (
    keys.length === 0 ||
    !Number.isFinite(bounds.left) ||
    !Number.isFinite(bounds.top) ||
    !Number.isFinite(bounds.width) ||
    !Number.isFinite(bounds.height) ||
    bounds.width <= 0 ||
    bounds.height <= 0
  ) {
    return design;
  }
  const selected = new Set(keys);
  const deltaX = axis === 'horizontal'
    ? PDF_COVER_PAGE_WIDTH_MM / 2 - (bounds.left + bounds.width / 2)
    : 0;
  const deltaY = axis === 'vertical'
    ? PDF_COVER_PAGE_HEIGHT_MM / 2 - (bounds.top + bounds.height / 2)
    : 0;
  return normalizePDFCoverDesign({
    ...design,
    elements: design.elements.map((element) => selected.has(element.key)
      ? {
          ...element,
          xMm: element.xMm + deltaX,
          yMm: element.yMm + deltaY,
        }
      : element),
  });
}

export function resetPDFCoverDesign(enabled = false): PDFCoverDesign {
  return {
    ...normalizePDFCoverDesign(DEFAULT_PDF_COVER_DESIGN),
    enabled,
    includeWatermark: false,
  };
}

export function pdfCoverDefinitions(): readonly NoteInfoDefinition[] {
  return [
    ...NOTE_INFO_DEFINITIONS,
    {
      key: PDF_COVER_GLOBAL_FOOTER_KEY,
      defaultLabel: 'PDF 頁尾版權宣告',
      weight: 400,
    },
  ];
}

export function pdfCoverDefinition(key: string): NoteInfoDefinition | undefined {
  return pdfCoverDefinitions().find((definition) => definition.key === key);
}

export function coverPreviewText(
  element: PDFCoverElement,
  fields: readonly NoteInfoField[] | undefined,
  noteTitle: string,
  globalFooterCopyright: string,
): string {
  if (element.key === PDF_COVER_GLOBAL_FOOTER_KEY) {
    return globalFooterCopyright || '（尚未填寫）';
  }
  const normalized = normalizeNoteInfoFields(fields);
  const field = normalized.find((item) => item.key === element.key);
  if (!field) return '';
  let value = field.value;
  if (element.key === 'documentTitle' && !value) value = noteTitle || '未命名筆記';
  if (!value) return element.showLabel ? `${field.label}：（尚未填寫）` : '（尚未填寫）';
  return element.showLabel ? `${field.label}：${value}` : value;
}
