export const DEFAULT_BASE_FONT_SIZE = 14;
export const MIN_BASE_FONT_SIZE = 12;
export const MAX_BASE_FONT_SIZE = 20;
export const DEFAULT_FONT_FAMILY = 'Segoe UI Variable Text';
export const BASE_FONT_SIZE_KEY = 'puffjoplin.baseFontSize';
export const FONT_FAMILY_KEY = 'puffjoplin.fontFamily';
export const FONT_SIZE_SETTING = 'appearance.baseFontSize';
export const FONT_FAMILY_SETTING = 'appearance.fontFamily';

export const FONT_PRESETS = [
  { label: '系統預設', value: DEFAULT_FONT_FAMILY },
  { label: '微軟正黑體', value: 'Microsoft JhengHei UI' },
  { label: '微軟雅黑', value: 'Microsoft YaHei UI' },
  { label: 'Noto Sans TC', value: 'Noto Sans TC' },
  { label: 'Arial', value: 'Arial' },
] as const;

export interface TypographyScale {
  base: number;
  display: number;
  subtitle: number;
  secondary: number;
}

export function normalizeBaseFontSize(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_BASE_FONT_SIZE;
  return Math.max(MIN_BASE_FONT_SIZE, Math.min(MAX_BASE_FONT_SIZE, Math.round(parsed)));
}

export function typographyScale(baseSize: unknown): TypographyScale {
  const base = normalizeBaseFontSize(baseSize);
  const round = (value: number) => Math.round(value * 100) / 100;
  return {
    base,
    display: round(base * 1.5),
    subtitle: round(base * 1.2),
    secondary: round(base * 0.8),
  };
}

export function sanitizeFontFamily(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(/["'\\;{}<>\u0000-\u001f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}

export function fontFamilyStack(value: unknown): string {
  const family = sanitizeFontFamily(value) || DEFAULT_FONT_FAMILY;
  return `"${family}", "Segoe UI Variable Text", "Segoe UI", "Microsoft JhengHei UI", sans-serif`;
}

export function decodeStoredString(value: string | undefined): string {
  if (!value) return '';
  try {
    const parsed: unknown = JSON.parse(value);
    return typeof parsed === 'string' ? parsed : '';
  } catch {
    return value.replace(/^"|"$/g, '');
  }
}
