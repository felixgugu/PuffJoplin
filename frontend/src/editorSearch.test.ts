import { describe, expect, it } from 'vitest';
import { findTextMatches } from './editorSearch';

describe('editor text matching', () => {
  it('matches literal text without interpreting regular expression syntax', () => {
    const text = 'Use [draft]. and a.b, then [draft]. again';
    expect(findTextMatches(text, '[draft].', { matchCase: true, wholeWord: false }))
      .toEqual([
        { start: 4, end: 12 },
        { start: 27, end: 35 },
      ]);
    expect(findTextMatches('a.b axb', 'a.b', { matchCase: true, wholeWord: false }))
      .toEqual([{ start: 0, end: 3 }]);
  });

  it('supports case-sensitive and whole-word matching', () => {
    const text = 'Note note notebook NOTE';
    expect(findTextMatches(text, 'note', { matchCase: true, wholeWord: true }))
      .toEqual([{ start: 5, end: 9 }]);
    expect(findTextMatches(text, 'note', { matchCase: false, wholeWord: true }))
      .toEqual([
        { start: 0, end: 4 },
        { start: 5, end: 9 },
        { start: 19, end: 23 },
      ]);
  });

  it('handles Chinese text and empty queries', () => {
    expect(findTextMatches('筆記與筆記本', '筆記', { matchCase: false, wholeWord: false }))
      .toEqual([
        { start: 0, end: 2 },
        { start: 3, end: 5 },
      ]);
    expect(findTextMatches('筆記', '', { matchCase: false, wholeWord: false })).toEqual([]);
  });
});
