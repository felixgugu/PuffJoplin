import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PDF_WATERMARK_FONT_SIZE,
  DEFAULT_PDF_WATERMARK_HEIGHT,
  DEFAULT_PDF_WATERMARK_OPACITY,
  DEFAULT_PDF_WATERMARK_WIDTH,
  DEFAULT_PDF_WATERMARK_ANGLE,
  decodePDFSettingNumber,
  decodePDFSettingText,
  normalizePDFInteger,
  PDF_FOOTER_MAX_LENGTH,
  PDF_WATERMARK_MAX_LENGTH,
  PDF_WATERMARK_FONT_SIZE_RANGE,
  PDF_WATERMARK_OPACITY_RANGE,
  PDF_WATERMARK_WIDTH_RANGE,
  PDF_WATERMARK_ANGLE_RANGE,
  parsePDFDecorationsEnabled,
  parsePDFWatermarkShowBorder,
  sanitizePDFSettingText,
} from './pdfSettings';

describe('PDF export settings', () => {
  it('decodes JSON and legacy plain-text settings', () => {
    expect(decodePDFSettingText(JSON.stringify('© 2026 PuffJoplin'))).toBe('© 2026 PuffJoplin');
    expect(decodePDFSettingText('Plain text')).toBe('Plain text');
    expect(decodePDFSettingText(undefined)).toBe('');
  });

  it('normalizes control characters and whitespace for single-line fields', () => {
    expect(sanitizePDFSettingText('  ©\n  PuffJoplin\t ', PDF_FOOTER_MAX_LENGTH))
      .toBe('© PuffJoplin');
  });

  it('enforces footer and watermark limits by Unicode code point', () => {
    expect(Array.from(sanitizePDFSettingText('😀'.repeat(210), PDF_FOOTER_MAX_LENGTH))).toHaveLength(200);
    expect(Array.from(sanitizePDFSettingText('浮水印'.repeat(40), PDF_WATERMARK_MAX_LENGTH))).toHaveLength(80);
  });

  it('keeps PDF decorations disabled until explicitly enabled', () => {
    expect(parsePDFDecorationsEnabled(null)).toBe(false);
    expect(parsePDFDecorationsEnabled('false')).toBe(false);
    expect(parsePDFDecorationsEnabled('true')).toBe(true);
    expect(parsePDFWatermarkShowBorder(null)).toBe(false);
    expect(parsePDFWatermarkShowBorder('true')).toBe(true);
  });

  it('normalizes configurable watermark dimensions, font size and opacity', () => {
    expect(DEFAULT_PDF_WATERMARK_WIDTH).toBe(900);
    expect(DEFAULT_PDF_WATERMARK_HEIGHT).toBe(600);
    expect(DEFAULT_PDF_WATERMARK_FONT_SIZE).toBe(42);
    expect(DEFAULT_PDF_WATERMARK_OPACITY).toBe(10);
    expect(DEFAULT_PDF_WATERMARK_ANGLE).toBe(-45);
    expect(normalizePDFInteger('720', 900, PDF_WATERMARK_WIDTH_RANGE)).toBe(720);
    expect(normalizePDFInteger(250, 900, PDF_WATERMARK_WIDTH_RANGE)).toBe(300);
    expect(normalizePDFInteger(150, 42, PDF_WATERMARK_FONT_SIZE_RANGE)).toBe(120);
    expect(normalizePDFInteger(0, 10, PDF_WATERMARK_OPACITY_RANGE)).toBe(1);
    expect(normalizePDFInteger(-120, -45, PDF_WATERMARK_ANGLE_RANGE)).toBe(-90);
  });

  it('decodes numeric settings stored as JSON or plain values', () => {
    expect(decodePDFSettingNumber('720')).toBe(720);
    expect(decodePDFSettingNumber('"480"')).toBeNull();
    expect(decodePDFSettingNumber('12.5')).toBe(12.5);
    expect(decodePDFSettingNumber(undefined)).toBeNull();
  });
});
