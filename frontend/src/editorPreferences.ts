export const SOURCE_LINE_NUMBERS_KEY = 'puffjoplin.source.showLineNumbers';

export function parseShowSourceLineNumbers(value: string | null): boolean {
  return value !== 'false';
}
