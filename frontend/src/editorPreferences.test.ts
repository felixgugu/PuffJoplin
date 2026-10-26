import { describe, expect, it } from 'vitest';
import {
  DEFAULT_DARK_SOURCE_PROFILE,
  DEFAULT_LIGHT_SOURCE_PROFILE,
  DEFAULT_SOURCE_FONT_FAMILY,
  defaultEditorPreferences,
  normalizeSourceFontFamily,
  normalizeSourceColor,
  parseEditorPreferences,
  parseShowSourceLineNumbers,
  serializeEditorPreferences,
  sourceColorCSSVariables,
  sourceFontFamilyStack,
  sourceTypographyCSSVariables,
} from './editorPreferences';

describe('source editor preferences', () => {
  it('shows source line numbers by default', () => {
    expect(parseShowSourceLineNumbers(null)).toBe(true);
    expect(parseShowSourceLineNumbers('true')).toBe(true);
    expect(parseShowSourceLineNumbers('unexpected')).toBe(true);
  });

  it('keeps an explicit choice to hide line numbers', () => {
    expect(parseShowSourceLineNumbers('false')).toBe(false);
  });

  it('provides complete light and dark source profiles by default', () => {
    const preferences = parseEditorPreferences(null);

    expect(preferences.version).toBe(2);
    expect(preferences.defaultMode).toBe('sv');
    expect(preferences.showSourceLineNumbers).toBe(true);
    expect(preferences.customSourceAppearance).toBe(false);
    expect(preferences.sourceTypography).toEqual({
      fontFamily: DEFAULT_SOURCE_FONT_FAMILY,
      fontScale: 1,
      fontWeight: 400,
      lineHeight: 1.75,
    });
    expect(preferences.sourceAppearance.light).toEqual(DEFAULT_LIGHT_SOURCE_PROFILE);
    expect(preferences.sourceAppearance.dark).toEqual(DEFAULT_DARK_SOURCE_PROFILE);
  });

  it('migrates the legacy line-number preference', () => {
    expect(parseEditorPreferences(null, 'false').showSourceLineNumbers).toBe(false);
    expect(parseEditorPreferences(null, 'true').showSourceLineNumbers).toBe(true);
  });

  it('normalizes colors and bounded source appearance values', () => {
    const preferences = parseEditorPreferences(JSON.stringify({
      defaultMode: 'ir',
      showSourceLineNumbers: false,
      customSourceAppearance: true,
      sourceAppearance: {
        light: {
          foreground: '#ABC',
          background: 'not-a-color',
          fontWeight: 999,
          fontScale: 4,
          lineHeight: 0.5,
          caretWidth: 9,
        },
      },
    }));

    expect(preferences.defaultMode).toBe('ir');
    expect(preferences.showSourceLineNumbers).toBe(false);
    expect(preferences.customSourceAppearance).toBe(true);
    expect(preferences.sourceAppearance.light.foreground).toBe('#aabbcc');
    expect(preferences.sourceAppearance.light.background).toBe(
      DEFAULT_LIGHT_SOURCE_PROFILE.background,
    );
    expect(preferences.sourceTypography.fontWeight).toBe(800);
    expect(preferences.sourceTypography.fontScale).toBe(1.8);
    expect(preferences.sourceTypography.lineHeight).toBe(1.2);
    expect(preferences.sourceAppearance.light.caretWidth).toBe(3);
  });

  it('migrates shared typography from the active legacy color scheme', () => {
    const preferences = parseEditorPreferences(JSON.stringify({
      sourceAppearance: {
        light: { fontWeight: 300, fontScale: 0.9, lineHeight: 1.5 },
        dark: { fontWeight: 700, fontScale: 1.3, lineHeight: 1.95 },
      },
    }), null, 'dark');

    expect(preferences.sourceTypography).toEqual({
      fontFamily: DEFAULT_SOURCE_FONT_FAMILY,
      fontWeight: 700,
      fontScale: 1.3,
      lineHeight: 1.95,
    });
  });

  it('round-trips preferences and creates CodeMirror CSS variables', () => {
    const preferences = defaultEditorPreferences();
    preferences.sourceTypography.fontFamily = 'JetBrains Mono';
    preferences.sourceTypography.fontWeight = 700;
    preferences.sourceTypography.fontScale = 1.2;
    preferences.sourceTypography.lineHeight = 1.9;
    preferences.sourceAppearance.dark.foreground = '#c0ffee';
    const restored = parseEditorPreferences(serializeEditorPreferences(preferences));

    expect(restored).toEqual(preferences);
    expect(sourceTypographyCSSVariables(restored.sourceTypography)).toMatchObject({
      '--source-font-family': sourceFontFamilyStack('JetBrains Mono'),
      '--source-font-size': '1.2rem',
      '--source-font-weight': '700',
      '--source-line-height': '1.9',
    });
    expect(sourceColorCSSVariables(restored.sourceAppearance.dark)).toMatchObject({
      '--source-foreground': '#c0ffee',
      '--source-caret-width': '1px',
      '--source-inline-code': '#ffb77f',
      '--source-inline-code-background': '#343733',
      '--source-code-block-background': '#2a2c29',
    });
  });

  it('validates and expands CSS hex colors', () => {
    expect(normalizeSourceColor('#12abEF')).toBe('#12abef');
    expect(normalizeSourceColor('#abc')).toBe('#aabbcc');
    expect(normalizeSourceColor('abc')).toBeNull();
    expect(normalizeSourceColor('#abcd')).toBeNull();
  });

  it('sanitizes source font names and supplies the monospace fallback stack', () => {
    expect(normalizeSourceFontFamily('  My "Mono"; {}  ')).toBe('My Mono');
    expect(normalizeSourceFontFamily('')).toBe(DEFAULT_SOURCE_FONT_FAMILY);
    expect(sourceFontFamilyStack('JetBrains Mono')).toBe(
      '"JetBrains Mono", "Cascadia Code", "Cascadia Mono", "Consolas", monospace',
    );
  });
});
