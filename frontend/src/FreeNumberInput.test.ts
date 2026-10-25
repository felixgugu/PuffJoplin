import { describe, expect, it } from 'vitest';
import {
  formatFreeNumber,
  hasFiniteNumberDraft,
  normalizeFreeNumberDraft,
} from './FreeNumberInput';

describe('FreeNumberInput', () => {
  it('keeps invalid or empty drafts as the current value on commit', () => {
    expect(normalizeFreeNumberDraft('', 8, 0, 50)).toBe(8);
    expect(normalizeFreeNumberDraft('-', 8, 0, 50)).toBe(8);
    expect(normalizeFreeNumberDraft('abc', 8, 0, 50)).toBe(8);
  });

  it('distinguishes valid live drafts from intermediate text', () => {
    expect(hasFiniteNumberDraft('3.5')).toBe(true);
    expect(hasFiniteNumberDraft('3,5')).toBe(true);
    expect(hasFiniteNumberDraft('-')).toBe(false);
    expect(hasFiniteNumberDraft('')).toBe(false);
  });

  it('accepts decimal commas, signs and scientific notation', () => {
    expect(normalizeFreeNumberDraft('-12.5', 0, -90, 90)).toBe(-12.5);
    expect(normalizeFreeNumberDraft('3,75', 0, 0, 100)).toBe(3.75);
    expect(normalizeFreeNumberDraft('1e2', 0, 0, 200)).toBe(100);
  });

  it('clamps only when the draft is committed', () => {
    expect(normalizeFreeNumberDraft('999', 8, 0, 50)).toBe(50);
    expect(normalizeFreeNumberDraft('-10', 8, 0, 50)).toBe(0);
  });

  it('formats floating point values without long binary tails', () => {
    expect(formatFreeNumber(93.69999694824219, 2)).toBe('93.7');
    expect(formatFreeNumber(8, 2)).toBe('8');
  });
});
