import { parseEditorMode, type EditorMode } from './editorTabs';
import { sanitizeFontFamily } from './typography';

export const SOURCE_LINE_NUMBERS_KEY = 'puffjoplin.source.showLineNumbers';
export const EDITOR_PREFERENCES_KEY = 'puffjoplin.editorPreferences.v1';
export const EDITOR_PREFERENCES_SETTING = 'editor.preferences';
export const DEFAULT_SOURCE_FONT_FAMILY = 'Cascadia Code';

export const SOURCE_FONT_PRESETS = [
  { label: 'Cascadia Code', value: 'Cascadia Code' },
  { label: 'Cascadia Mono', value: 'Cascadia Mono' },
  { label: 'Consolas', value: 'Consolas' },
  { label: 'Courier New', value: 'Courier New' },
] as const;

export type SourceFontPreset = typeof SOURCE_FONT_PRESETS[number];

export interface SourceEditorTypography {
  fontFamily: string;
  fontScale: number;
  fontWeight: number;
  lineHeight: number;
}

export interface SourceEditorProfile {
  foreground: string;
  background: string;
  caretColor: string;
  gutterColor: string;
  caretWidth: number;
  heading: string;
  strong: string;
  emphasis: string;
  link: string;
  code: string;
  inlineCode: string;
  inlineCodeBackground: string;
  codeBlockBackground: string;
  quote: string;
  meta: string;
  list: string;
  string: string;
}

export interface EditorPreferences {
  version: 2;
  defaultMode: EditorMode;
  showSourceLineNumbers: boolean;
  sourceWordWrap: boolean;
  customSourceAppearance: boolean;
  sourceTypography: SourceEditorTypography;
  sourceAppearance: {
    light: SourceEditorProfile;
    dark: SourceEditorProfile;
  };
}

export const DEFAULT_LIGHT_SOURCE_PROFILE: Readonly<SourceEditorProfile> = {
  foreground: '#1b1b1b',
  background: '#fbfaf8',
  caretColor: '#1b1b1b',
  gutterColor: '#8d8d8d',
  caretWidth: 1,
  heading: '#1d5fa8',
  strong: '#8e3c82',
  emphasis: '#76558d',
  link: '#176c66',
  code: '#a34c16',
  inlineCode: '#a34c16',
  inlineCodeBackground: '#ebe7df',
  codeBlockBackground: '#f0ede7',
  quote: '#6a7a68',
  meta: '#8a5a00',
  list: '#0067c0',
  string: '#176c66',
};

export const DEFAULT_DARK_SOURCE_PROFILE: Readonly<SourceEditorProfile> = {
  foreground: '#f5f5f5',
  background: '#1f1f1f',
  caretColor: '#f5f5f5',
  gutterColor: '#898989',
  caretWidth: 1,
  heading: '#79bdff',
  strong: '#f0a7e4',
  emphasis: '#c7b2e3',
  link: '#79d6ca',
  code: '#ffb77f',
  inlineCode: '#ffb77f',
  inlineCodeBackground: '#343733',
  codeBlockBackground: '#2a2c29',
  quote: '#a4b9a1',
  meta: '#e7c66f',
  list: '#60cdff',
  string: '#79d6ca',
};

export const SOURCE_TYPOGRAPHY_VARIABLE_NAMES = [
  '--source-font-family',
  '--source-font-size',
  '--source-font-weight',
  '--source-line-height',
] as const;

export const SOURCE_COLOR_VARIABLE_NAMES = [
  '--source-foreground',
  '--source-background',
  '--source-caret',
  '--source-gutter',
  '--source-caret-width',
  '--source-heading',
  '--source-strong',
  '--source-emphasis',
  '--source-link',
  '--source-code',
  '--source-inline-code',
  '--source-inline-code-background',
  '--source-code-block-background',
  '--source-quote',
  '--source-meta',
  '--source-list',
  '--source-string',
] as const;

export const SOURCE_APPEARANCE_VARIABLE_NAMES = [
  ...SOURCE_TYPOGRAPHY_VARIABLE_NAMES,
  ...SOURCE_COLOR_VARIABLE_NAMES,
] as const;

export function defaultSourceEditorTypography(): SourceEditorTypography {
  return {
    fontFamily: DEFAULT_SOURCE_FONT_FAMILY,
    fontScale: 1,
    fontWeight: 400,
    lineHeight: 1.75,
  };
}

export function defaultEditorPreferences(): EditorPreferences {
  return {
    version: 2,
    defaultMode: 'sv',
    showSourceLineNumbers: true,
    sourceWordWrap: true,
    customSourceAppearance: false,
    sourceTypography: defaultSourceEditorTypography(),
    sourceAppearance: {
      light: { ...DEFAULT_LIGHT_SOURCE_PROFILE },
      dark: { ...DEFAULT_DARK_SOURCE_PROFILE },
    },
  };
}

export function parseShowSourceLineNumbers(value: string | null): boolean {
  return value !== 'false';
}

export function normalizeSourceColor(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const color = value.trim();
  if (/^#[0-9a-f]{6}$/i.test(color)) return color.toLowerCase();
  if (/^#[0-9a-f]{3}$/i.test(color)) {
    return `#${color.slice(1).split('').map((part) => part + part).join('')}`.toLowerCase();
  }
  return null;
}

export function normalizeSourceFontFamily(value: unknown): string {
  return sanitizeFontFamily(value) || DEFAULT_SOURCE_FONT_FAMILY;
}

export function sourceFontFamilyStack(value: unknown): string {
  const family = normalizeSourceFontFamily(value);
  const fallbacks = ['Cascadia Code', 'Cascadia Mono', 'Consolas']
    .filter((fallback) => fallback !== family)
    .map((fallback) => `"${fallback}"`);
  return [`"${family}"`, ...fallbacks, 'monospace'].join(', ');
}

function normalizeNumber(
  value: unknown,
  fallback: number,
  min: number,
  max: number,
  precision = 0,
): number {
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(number)) return fallback;
  const factor = 10 ** precision;
  return Math.round(Math.max(min, Math.min(max, number)) * factor) / factor;
}

function normalizeSteppedNumber(
  value: unknown,
  fallback: number,
  min: number,
  max: number,
  step: number,
): number {
  const number = normalizeNumber(value, fallback, min, max, 4);
  return normalizeNumber(
    min + Math.round((number - min) / step) * step,
    fallback,
    min,
    max,
    4,
  );
}

function normalizeSourceTypography(
  value: unknown,
  fallback: SourceEditorTypography = defaultSourceEditorTypography(),
): SourceEditorTypography {
  const source = value && typeof value === 'object'
    ? value as Record<string, unknown>
    : {};
  return {
    fontFamily: normalizeSourceFontFamily(source.fontFamily ?? fallback.fontFamily),
    fontWeight: normalizeSteppedNumber(
      source.fontWeight,
      fallback.fontWeight,
      300,
      800,
      100,
    ),
    fontScale: normalizeSteppedNumber(source.fontScale, fallback.fontScale, 0.8, 1.8, 0.05),
    lineHeight: normalizeSteppedNumber(
      source.lineHeight,
      fallback.lineHeight,
      1.2,
      2.2,
      0.05,
    ),
  };
}

function normalizeProfile(
  value: unknown,
  fallback: SourceEditorProfile,
): SourceEditorProfile {
  const source = value && typeof value === 'object'
    ? value as Record<string, unknown>
    : {};
  return {
    foreground: normalizeSourceColor(source.foreground) ?? fallback.foreground,
    background: normalizeSourceColor(source.background) ?? fallback.background,
    caretColor: normalizeSourceColor(source.caretColor) ?? fallback.caretColor,
    gutterColor: normalizeSourceColor(source.gutterColor) ?? fallback.gutterColor,
    caretWidth: normalizeSteppedNumber(source.caretWidth, fallback.caretWidth, 1, 3, 1),
    heading: normalizeSourceColor(source.heading) ?? fallback.heading,
    strong: normalizeSourceColor(source.strong) ?? fallback.strong,
    emphasis: normalizeSourceColor(source.emphasis) ?? fallback.emphasis,
    link: normalizeSourceColor(source.link) ?? fallback.link,
    code: normalizeSourceColor(source.code) ?? fallback.code,
    inlineCode: normalizeSourceColor(source.inlineCode) ?? fallback.inlineCode,
    inlineCodeBackground: normalizeSourceColor(source.inlineCodeBackground) ??
      fallback.inlineCodeBackground,
    codeBlockBackground: normalizeSourceColor(source.codeBlockBackground) ??
      fallback.codeBlockBackground,
    quote: normalizeSourceColor(source.quote) ?? fallback.quote,
    meta: normalizeSourceColor(source.meta) ?? fallback.meta,
    list: normalizeSourceColor(source.list) ?? fallback.list,
    string: normalizeSourceColor(source.string) ?? fallback.string,
  };
}

export function parseEditorPreferences(
  raw: unknown,
  legacyLineNumbers: string | null = null,
  preferredLegacyTheme: 'light' | 'dark' = 'light',
): EditorPreferences {
  let parsed: Record<string, unknown> = {};
  if (raw && typeof raw === 'object') {
    parsed = raw as Record<string, unknown>;
  } else if (typeof raw === 'string' && raw.trim()) {
    try {
      const value = JSON.parse(raw) as unknown;
      if (value && typeof value === 'object') parsed = value as Record<string, unknown>;
    } catch {
      parsed = {};
    }
  }
  const sourceAppearance = parsed.sourceAppearance &&
    typeof parsed.sourceAppearance === 'object'
    ? parsed.sourceAppearance as Record<string, unknown>
    : {};
  const legacyProfileValue = sourceAppearance[preferredLegacyTheme];
  const legacyProfile = legacyProfileValue && typeof legacyProfileValue === 'object'
    ? legacyProfileValue as Record<string, unknown>
    : {};
  const defaultTypography = defaultSourceEditorTypography();
  const legacyTypography: SourceEditorTypography = {
    fontFamily: DEFAULT_SOURCE_FONT_FAMILY,
    fontWeight: normalizeSteppedNumber(
      legacyProfile.fontWeight,
      defaultTypography.fontWeight,
      300,
      800,
      100,
    ),
    fontScale: normalizeSteppedNumber(
      legacyProfile.fontScale,
      defaultTypography.fontScale,
      0.8,
      1.8,
      0.05,
    ),
    lineHeight: normalizeSteppedNumber(
      legacyProfile.lineHeight,
      defaultTypography.lineHeight,
      1.2,
      2.2,
      0.05,
    ),
  };
  return {
    version: 2,
    defaultMode: parseEditorMode(parsed.defaultMode) ?? 'sv',
    showSourceLineNumbers: typeof parsed.showSourceLineNumbers === 'boolean'
      ? parsed.showSourceLineNumbers
      : parseShowSourceLineNumbers(legacyLineNumbers),
    sourceWordWrap: parsed.sourceWordWrap !== false,
    customSourceAppearance: parsed.customSourceAppearance === true,
    sourceTypography: normalizeSourceTypography(parsed.sourceTypography, legacyTypography),
    sourceAppearance: {
      light: normalizeProfile(sourceAppearance.light, DEFAULT_LIGHT_SOURCE_PROFILE),
      dark: normalizeProfile(sourceAppearance.dark, DEFAULT_DARK_SOURCE_PROFILE),
    },
  };
}

export function serializeEditorPreferences(preferences: EditorPreferences): string {
  return JSON.stringify(preferences);
}

export function sourceTypographyCSSVariables(
  typography: SourceEditorTypography,
): Record<(typeof SOURCE_TYPOGRAPHY_VARIABLE_NAMES)[number], string> {
  return {
    '--source-font-family': sourceFontFamilyStack(typography.fontFamily),
    '--source-font-size': `${typography.fontScale}rem`,
    '--source-font-weight': String(typography.fontWeight),
    '--source-line-height': String(typography.lineHeight),
  };
}

export function sourceColorCSSVariables(
  profile: SourceEditorProfile,
): Record<(typeof SOURCE_COLOR_VARIABLE_NAMES)[number], string> {
  return {
    '--source-foreground': profile.foreground,
    '--source-background': profile.background,
    '--source-caret': profile.caretColor,
    '--source-gutter': profile.gutterColor,
    '--source-caret-width': `${profile.caretWidth}px`,
    '--source-heading': profile.heading,
    '--source-strong': profile.strong,
    '--source-emphasis': profile.emphasis,
    '--source-link': profile.link,
    '--source-code': profile.code,
    '--source-inline-code': profile.inlineCode,
    '--source-inline-code-background': profile.inlineCodeBackground,
    '--source-code-block-background': profile.codeBlockBackground,
    '--source-quote': profile.quote,
    '--source-meta': profile.meta,
    '--source-list': profile.list,
    '--source-string': profile.string,
  };
}
