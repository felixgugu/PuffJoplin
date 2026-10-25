import { describe, expect, it } from 'vitest';
import {
  applySourceTextColor,
  removeSourceTextColor,
  TEXT_COLORS,
  TEXT_COLOR_PLACEHOLDER,
} from './textColor';

describe('text colors', () => {
  it('provides sixteen unique common colors', () => {
    expect(TEXT_COLORS).toHaveLength(16);
    expect(new Set(TEXT_COLORS.map((color) => color.value)).size).toBe(16);
    expect(new Set(TEXT_COLORS.map((color) => color.name)).size).toBe(16);
  });

  it('wraps a source selection in a color span', () => {
    const result = applySourceTextColor('before value after', 7, 12, '#E53935');
    expect(result.value).toBe(
      'before <span style="color: #E53935">value</span> after',
    );
    expect(result.selectionStart).toBe(41);
  });

  it('inserts placeholder text and keeps the caret inside it', () => {
    const result = applySourceTextColor('abc', 1, 1, '#1E88E5');
    expect(result.value).toContain(TEXT_COLOR_PLACEHOLDER);
    const placeholderOffset = result.value.indexOf(TEXT_COLOR_PLACEHOLDER);
    expect(result.selectionStart).toBe(
      placeholderOffset + Math.floor(TEXT_COLOR_PLACEHOLDER.length / 2),
    );
  });

  it('removes color spans while keeping other inline styles', () => {
    const source = '<span style="color: #red; font-weight: bold">value</span>';
    const result = removeSourceTextColor(source, 0, source.length);
    expect(result.value).toBe('<span style="font-weight: bold">value</span>');
  });
});
