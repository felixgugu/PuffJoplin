import type { NoteSummary } from './types';

export interface NoteTagSummary {
  title: string;
  count: number;
}

const tagCollator = new Intl.Collator('zh-TW', {
  numeric: true,
  sensitivity: 'base',
});

export function collectNoteTags(
  notes: readonly Pick<NoteSummary, 'tags'>[],
): NoteTagSummary[] {
  const counts = new Map<string, number>();
  for (const note of notes) {
    const titles = new Set(
      note.tags
        .map((tag) => tag.trim())
        .filter(Boolean),
    );
    for (const title of titles) {
      counts.set(title, (counts.get(title) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([title, count]) => ({ title, count }))
    .sort((left, right) => tagCollator.compare(left.title, right.title));
}

export function filterNotesByTag<T extends Pick<NoteSummary, 'tags'>>(
  notes: readonly T[],
  selectedTag: string,
): T[] {
  const title = selectedTag.trim();
  if (!title) return [...notes];
  return notes.filter((note) => note.tags.some((tag) => tag.trim() === title));
}
