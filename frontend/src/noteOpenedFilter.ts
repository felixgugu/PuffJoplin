export type NoteOpenedFilter = 'any' | 'today' | 'threeDays';

export type NoteOpenedDisplayValue = 'opened-today' | 'opened-3d';

export function parseNoteOpenedFilter(value: string | null): NoteOpenedFilter {
  return value === 'today' || value === 'threeDays' ? value : 'any';
}

export function openedFilterDisplayValue(
  filter: NoteOpenedFilter,
): NoteOpenedDisplayValue | null {
  if (filter === 'today') return 'opened-today';
  if (filter === 'threeDays') return 'opened-3d';
  return null;
}

export function openedFilterFromDisplayValue(
  value: NoteOpenedDisplayValue,
): NoteOpenedFilter {
  return value === 'opened-today' ? 'today' : 'threeDays';
}

function localMidnight(now: number, daysAgo = 0): number {
  const date = new Date(now);
  date.setHours(0, 0, 0, 0);
  if (daysAgo !== 0) date.setDate(date.getDate() - daysAgo);
  return date.getTime();
}

export function openedSinceFor(filter: NoteOpenedFilter, now: number): number {
  if (filter === 'today') return localMidnight(now);
  if (filter === 'threeDays') return localMidnight(now, 2);
  return 0;
}
