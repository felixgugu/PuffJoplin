import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BASE_FONT_SIZE,
  fontFamilyStack,
  normalizeBaseFontSize,
  sanitizeFontFamily,
  typographyScale,
} from './typography';

describe('typography settings', () => {
  it.each([
    [undefined, 14],
    [11, 12],
    [14, 14],
    [19.6, 20],
    [24, 20],
  ])('clamps base font size %s to %s', (input, expected) => {
    expect(normalizeBaseFontSize(input)).toBe(expected);
  });

  it('derives the Fluent scale from the body size', () => {
    expect(typographyScale(DEFAULT_BASE_FONT_SIZE)).toEqual({
      base: 14,
      display: 21,
      subtitle: 16.8,
      secondary: 11.2,
    });
  });

  it('removes unsafe custom font characters and supplies fallbacks', () => {
    expect(sanitizeFontFamily('  My "Font"; {}  ')).toBe('My Font');
    expect(fontFamilyStack('Noto Sans TC')).toContain('"Noto Sans TC"');
    expect(fontFamilyStack('bad;value')).toContain('"badvalue"');
    expect(fontFamilyStack('')).toContain('"Segoe UI Variable Text"');
  });
});
