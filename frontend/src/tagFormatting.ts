import type { Tag } from './types';

export function formatTagLabel(tag: Pick<Tag, 'title' | 'count'>): string {
  return `${tag.title.trim()}(${tag.count})`;
}
