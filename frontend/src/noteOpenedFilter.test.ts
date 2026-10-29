import { describe, expect, it } from 'vitest';
import {
  openedFilterDisplayValue,
  openedFilterFromDisplayValue,
  openedSinceFor,
  parseNoteOpenedFilter,
} from './noteOpenedFilter';

describe('note opened filters', () => {
  it('defaults to no filter', () => {
    expect(parseNoteOpenedFilter(null)).toBe('any');
    expect(parseNoteOpenedFilter('unexpected')).toBe('any');
    expect(parseNoteOpenedFilter('today')).toBe('today');
    expect(parseNoteOpenedFilter('threeDays')).toBe('threeDays');
  });

  it('maps filters to the dropdown values', () => {
    expect(openedFilterDisplayValue('any')).toBeNull();
    expect(openedFilterDisplayValue('today')).toBe('opened-today');
    expect(openedFilterDisplayValue('threeDays')).toBe('opened-3d');
    expect(openedFilterFromDisplayValue('opened-today')).toBe('today');
    expect(openedFilterFromDisplayValue('opened-3d')).toBe('threeDays');
  });

  it('starts the opened filters at local midnight', () => {
    const now = new Date(2026, 9, 29, 15, 30, 0, 0).getTime();
    expect(openedSinceFor('any', now)).toBe(0);
    expect(openedSinceFor('today', now)).toBe(new Date(2026, 9, 29).getTime());
    expect(openedSinceFor('threeDays', now)).toBe(new Date(2026, 9, 27).getTime());
  });
});
