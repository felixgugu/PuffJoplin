import { describe, expect, it } from 'vitest';
import {
  addTagValues,
  normalizeTagList,
  removeTagValue,
  visibleTagCount,
} from './tagEditing';

describe('tag editing helpers', () => {
  it('normalizes prefixes, whitespace and case-insensitive duplicates', () => {
    expect(normalizeTagList([' #Work ', 'work', '##Joplin', ''])).toEqual(['Joplin', 'Work']);
  });

  it('adds comma-separated tags and removes by case-insensitive title', () => {
    expect(addTagValues(['Work'], '#Todo, note')).toEqual(['note', 'Todo', 'Work']);
    expect(removeTagValue(['note', 'Todo', 'Work'], '#WORK')).toEqual(['note', 'Todo']);
  });

  it('calculates how many capsules fit before the +N counter', () => {
    expect(visibleTagCount([40, 40, 40], 180, 28, 4)).toBe(3);
    expect(visibleTagCount([60, 60, 60, 60], 180, 28, 4)).toBe(2);
    expect(visibleTagCount([80, 80], 70, 24, 4)).toBe(0);
  });
});
