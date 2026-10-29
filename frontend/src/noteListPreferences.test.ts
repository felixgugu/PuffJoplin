import { describe, expect, it } from 'vitest';
import {
  DEFAULT_NOTE_SORT_BY,
  DEFAULT_NOTE_SORT_DIRECTION,
  DEFAULT_NOTE_TAG_PANEL_RATIO,
  DEFAULT_TODO_SORT_BY,
  DEFAULT_TODO_STATUS,
  DEFAULT_SEARCH_FIELD,
  normalizeNoteTagPanelRatio,
  parseNoteSortBy,
  parseNoteSortDirection,
  parseNoteTagPanelOpen,
  parseNoteTagPanelRatio,
  parseSearchField,
  parseSearchScope,
  parseSearchToggle,
  parseShowNoteSummary,
  parseIncludeSubnotebooks,
  parseTodoStatus,
  parseTodoSortBy,
  shouldExpandNoteList,
} from './noteListPreferences';

describe('note list preferences', () => {
  it('accepts supported sort values', () => {
    expect(parseNoteSortBy('title')).toBe('title');
    expect(parseNoteSortBy('created')).toBe('created');
    expect(parseNoteSortBy('updated')).toBe('updated');
    expect(parseNoteSortBy('due')).toBe('due');
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

  it('includes subnotebook notes by default', () => {
    expect(parseIncludeSubnotebooks(null)).toBe(true);
    expect(parseIncludeSubnotebooks('true')).toBe(true);
    expect(parseIncludeSubnotebooks('false')).toBe(false);
    expect(parseIncludeSubnotebooks('unexpected')).toBe(true);
  });

  it('defaults the tag panel to a hidden one-third split', () => {
    expect(parseNoteTagPanelOpen(null)).toBe(false);
    expect(parseNoteTagPanelOpen('true')).toBe(true);
    expect(parseNoteTagPanelRatio(null)).toBe(DEFAULT_NOTE_TAG_PANEL_RATIO);
    expect(parseNoteTagPanelRatio('0.42')).toBe(0.42);
    expect(parseNoteTagPanelRatio('bad')).toBe(DEFAULT_NOTE_TAG_PANEL_RATIO);
    expect(normalizeNoteTagPanelRatio(0.05)).toBe(0.2);
    expect(normalizeNoteTagPanelRatio(0.95)).toBe(0.7);
  });

  it('defaults search scope to all notebooks', () => {
    expect(parseSearchScope(null)).toBe('all');
    expect(parseSearchScope('current')).toBe('current');
    expect(parseSearchScope('unknown')).toBe('all');
  });

  it('defaults search rules to title and body, case-insensitive matching', () => {
    expect(DEFAULT_SEARCH_FIELD).toBe('all');
    expect(parseSearchField(null)).toBe('all');
    expect(parseSearchField('title')).toBe('title');
    expect(parseSearchField('unknown')).toBe('all');
    expect(parseSearchToggle(null)).toBe(false);
    expect(parseSearchToggle('false')).toBe(false);
    expect(parseSearchToggle('true')).toBe(true);
  });

  it('uses due-date ascending and open todos as defaults', () => {
    expect(DEFAULT_TODO_SORT_BY).toBe('due');
    expect(DEFAULT_TODO_STATUS).toBe('open');
    expect(parseTodoSortBy(null)).toBe('due');
    expect(parseTodoSortBy('title')).toBe('title');
    expect(parseTodoSortBy('created')).toBe('created');
    expect(parseTodoSortBy('updated')).toBe('updated');
    expect(parseTodoSortBy('unknown')).toBe('due');
    expect(parseTodoStatus(null)).toBe('open');
    expect(parseTodoStatus('completed')).toBe('completed');
    expect(parseTodoStatus('all')).toBe('all');
  });
});
