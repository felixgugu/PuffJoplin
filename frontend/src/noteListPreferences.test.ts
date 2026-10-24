import { describe, expect, it } from 'vitest';
import {
  DEFAULT_NOTE_SORT_BY,
  DEFAULT_NOTE_SORT_DIRECTION,
  parseNoteSortBy,
  parseNoteSortDirection,
  parseSearchScope,
  parseShowNoteSummary,
  shouldExpandNoteList,
} from './noteListPreferences';

describe('note list preferences', () => {
  it('accepts supported sort values', () => {
    expect(parseNoteSortBy('title')).toBe('title');
    expect(parseNoteSortBy('created')).toBe('created');
    expect(parseNoteSortBy('updated')).toBe('updated');
    expect(parseNoteSortDirection('asc')).toBe('asc');
    expect(parseNoteSortDirection('desc')).toBe('desc');
  });

  it('falls back to modified date descending', () => {
    expect(parseNoteSortBy('unknown')).toBe(DEFAULT_NOTE_SORT_BY);
    expect(parseNoteSortBy(null)).toBe('updated');
    expect(parseNoteSortDirection('sideways')).toBe(DEFAULT_NOTE_SORT_DIRECTION);
    expect(parseNoteSortDirection(null)).toBe('desc');
  });

  it('requires an expanded list when no note is open', () => {
    expect(shouldExpandNoteList(true, false)).toBe(true);
    expect(shouldExpandNoteList(true, true)).toBe(false);
    expect(shouldExpandNoteList(false, false)).toBe(false);
  });

  it('shows note summaries by default', () => {
    expect(parseShowNoteSummary(null)).toBe(true);
    expect(parseShowNoteSummary('true')).toBe(true);
    expect(parseShowNoteSummary('false')).toBe(false);
    expect(parseShowNoteSummary('unexpected')).toBe(true);
  });

  it('defaults search scope to all notebooks', () => {
    expect(parseSearchScope(null)).toBe('all');
    expect(parseSearchScope('current')).toBe('current');
    expect(parseSearchScope('unknown')).toBe('all');
  });
});
