export const PDF_FOOTER_TEXT_KEY = 'pdf.footerCopyright';
export const PDF_WATERMARK_TEXT_KEY = 'pdf.watermarkText';
export const PDF_FOOTER_ENABLED_KEY = 'pdf.footerEnabled';
export const PDF_WATERMARK_ENABLED_KEY = 'pdf.watermarkEnabled';
export const PDF_WATERMARK_WIDTH_KEY = 'pdf.watermarkWidth';
export const PDF_WATERMARK_HEIGHT_KEY = 'pdf.watermarkHeight';
export const PDF_WATERMARK_FONT_SIZE_KEY = 'pdf.watermarkFontSize';
export const PDF_WATERMARK_OPACITY_KEY = 'pdf.watermarkOpacity';
export const PDF_WATERMARK_ANGLE_KEY = 'pdf.watermarkAngle';
export const PDF_WATERMARK_SHOW_BORDER_KEY = 'pdf.watermarkShowBorder';
export const PDF_FOOTER_MAX_LENGTH = 200;
export const PDF_WATERMARK_MAX_LENGTH = 80;
export const DEFAULT_PDF_WATERMARK_WIDTH = 900;
export const DEFAULT_PDF_WATERMARK_HEIGHT = 600;
export const DEFAULT_PDF_WATERMARK_FONT_SIZE = 42;
export const DEFAULT_PDF_WATERMARK_OPACITY = 10;
export const DEFAULT_PDF_WATERMARK_ANGLE = -45;
export const PDF_WATERMARK_WIDTH_RANGE = [300, 2000] as const;
export const PDF_WATERMARK_HEIGHT_RANGE = [200, 2000] as const;
export const PDF_WATERMARK_FONT_SIZE_RANGE = [16, 120] as const;
export const PDF_WATERMARK_OPACITY_RANGE = [1, 30] as const;
export const PDF_WATERMARK_ANGLE_RANGE = [-90, 90] as const;

export function sanitizePDFSettingText(value: unknown, maxLength: number): string {
  if (typeof value !== 'string') return '';
  return Array.from(
    value
      .replace(/[\u0000-\u001f\u007f]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim(),
  )
    .slice(0, maxLength)
    .join('');
}

export function decodePDFSettingText(value: string | undefined): string {
  if (!value) return '';
  try {
    const parsed: unknown = JSON.parse(value);
    return typeof parsed === 'string' ? parsed : '';
  } catch {
    return value.replace(/^"|"$/g, '');
  }
}

export function parsePDFDecorationsEnabled(value: string | null): boolean {
  return value === 'true';
}

export function parsePDFWatermarkShowBorder(value: string | null): boolean {
  return value === 'true';
}

export function normalizePDFInteger(
  value: unknown,
  fallback: number,
  range: readonly [number, number],
): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(range[0], Math.min(range[1], Math.round(parsed)));
}

export function decodePDFSettingNumber(value: string | undefined): number | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    return typeof parsed === 'number' ? parsed : null;
  } catch {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
}
