// @vitest-environment happy-dom

import { describe, expect, it } from 'vitest';
import {
  buildSearchResults,
  createSearchableTextMap,
  findTextMatches,
  rangesForMatchLines,
} from './editorSearch';

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

describe('editor search results', () => {
  it('collects matched line numbers and surrounding content', () => {
    const text = 'first line\nsecond Note here\nthird Note';
    const matches = findTextMatches(text, 'Note', { matchCase: false, wholeWord: false });

    expect(buildSearchResults(text, matches)).toEqual([
      {
        index: 0,
        lineNumber: 2,
        prefix: 'second ',
        match: 'Note',
        suffix: ' here',
        hasLeadingGap: false,
        hasTrailingGap: false,
      },
      {
        index: 1,
        lineNumber: 3,
        prefix: 'third ',
        match: 'Note',
        suffix: '',
        hasLeadingGap: false,
        hasTrailingGap: false,
      },
    ]);
  });

  it('keeps multiple matches on the same line and respects the result limit', () => {
    const text = 'Note and note and NOTE';
    const matches = findTextMatches(text, 'note', { matchCase: false, wholeWord: false });

    expect(buildSearchResults(text, matches).map((result) => result.lineNumber))
      .toEqual([1, 1, 1]);
    expect(buildSearchResults(text, matches, 2)).toHaveLength(2);
  });

  it('truncates long lines around the match with gap markers', () => {
    const prefix = 'a'.repeat(200);
    const suffix = 'b'.repeat(200);
    const text = `${prefix} keyword ${suffix}`;
    const matches = findTextMatches(text, 'keyword', { matchCase: false, wholeWord: false });
    const [result] = buildSearchResults(text, matches);

    expect(result.hasLeadingGap).toBe(true);
    expect(result.hasTrailingGap).toBe(true);
    expect(result.prefix.length).toBeLessThanOrEqual(60);
    expect(result.suffix.length).toBeGreaterThan(0);
    expect(result.prefix.endsWith('a ')).toBe(true);
  });
});

describe('editor search text map', () => {
  it('maps matches to their text blocks for line highlighting', () => {
    document.body.innerHTML = [
      '<div id="search-root">',
      '<p>First Note</p>',
      '<ul><li>Second Note</li></ul>',
      '</div>',
    ].join('');
    const root = document.getElementById('search-root');
    expect(root).not.toBeNull();

    const textMap = createSearchableTextMap(root!);
    expect(textMap.text).toBe('First Note\nSecond Note');
    expect(textMap.blocks).toEqual([
      { start: 0, end: 10, lineNumber: 1 },
      { start: 11, end: 22, lineNumber: 2 },
    ]);

    const matches = findTextMatches(textMap.text, 'Note', {
      matchCase: false,
      wholeWord: false,
    });
    const lineInfo = rangesForMatchLines(textMap, matches);
    expect(lineInfo.ranges).toHaveLength(2);
    expect(lineInfo.matchLineIndexes).toEqual([0, 1]);
  });
});
