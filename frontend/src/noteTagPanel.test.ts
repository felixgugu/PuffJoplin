import { describe, expect, it } from 'vitest';
import { collectNoteTags, filterNotesByTag } from './noteTagPanel';

const notes = [
  { id: 'a', tags: ['工作', '專案', '工作', ''] },
  { id: 'b', tags: ['專案', '閱讀'] },
  { id: 'c', tags: [] },
];

describe('note tag panel helpers', () => {
  it('counts each tag once per note and sorts tag names', () => {
    expect(collectNoteTags(notes)).toEqual([
      { title: '工作', count: 1 },
      { title: '專案', count: 2 },
      { title: '閱讀', count: 1 },
    ]);
  });

  it('filters by one exact tag and returns all notes without a selection', () => {
    expect(filterNotesByTag(notes, '專案').map((note) => note.id))
      .toEqual(['a', 'b']);
    expect(filterNotesByTag(notes, '工作').map((note) => note.id))
      .toEqual(['a']);
    expect(filterNotesByTag(notes, '')).toHaveLength(3);
    expect(filterNotesByTag(notes, '不存在')).toEqual([]);
  });
});
