export function normalizeTagTitle(value: string): string {
  return value.trim().replace(/^#+/, '').trim();
}

export function normalizeTagList(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const title = normalizeTagTitle(value);
    if (!title) continue;
    const key = title.toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(title);
  }
  return result.sort((left, right) => left.localeCompare(right, 'zh-TW', { sensitivity: 'base' }));
}

export function addTagValues(existing: string[], value: string): string[] {
  const additions = value.split(/[,，]/);
  return normalizeTagList([...existing, ...additions]);
}

export function removeTagValue(existing: string[], value: string): string[] {
  const key = normalizeTagTitle(value).toLocaleLowerCase();
  return existing.filter((tag) => normalizeTagTitle(tag).toLocaleLowerCase() !== key);
}

export function visibleTagCount(
  widths: number[],
  availableWidth: number,
  counterWidth: number,
  gap: number,
): number {
  if (widths.length === 0) return 0;
  const allWidth = widths.reduce((total, width) => total + width, 0) + gap * Math.max(0, widths.length - 1);
  if (allWidth <= availableWidth) return widths.length;

  const availableForTags = availableWidth - counterWidth - gap;
  let used = 0;
  let count = 0;
  for (const width of widths) {
    const next = used + (count === 0 ? 0 : gap) + width;
    if (next > availableForTags) break;
    used = next;
    count += 1;
  }
  return count;
}
