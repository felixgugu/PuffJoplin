import { describe, expect, it } from 'vitest';
import {
  MERMAID_CONFIG_STORAGE_KEY,
  buildMermaidConfig,
  clampMermaidNumber,
  defaultMermaidConfigDraft,
  formatMermaidConfig,
  loadMermaidConfigState,
  normalizeMermaidConfigDraft,
  saveMermaidConfigState,
} from './mermaidConfig';

const fakeStorage = () => {
  const values = new Map<string, string>();
  return {
    values,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
};

describe('Mermaid config builder', () => {
  it('builds the full config instead of only the changed fields', () => {
    const config = buildMermaidConfig(defaultMermaidConfigDraft());
    expect(config.theme).toBe('default');
    expect(config.themeVariables.fontSize).toBe('16px');
    expect(config.themeVariables.clusterBorder).toBe('#aaaa33');
    expect(config.flowchart).toEqual({
      curve: 'basis',
      nodeSpacing: 50,
      rankSpacing: 50,
      padding: 15,
      diagramPadding: 8,
      wrappingWidth: 200,
      useMaxWidth: true,
      htmlLabels: true,
    });
  });

  it('formats the init directive as valid JSON', () => {
    const draft = { ...defaultMermaidConfigDraft(), theme: 'base' as const, fontSize: 18 };
    const text = formatMermaidConfig(draft, 'directive');

    expect(text.startsWith('%%{init: {')).toBe(true);
    expect(text.endsWith('}}%%')).toBe(true);
    const json = text.slice('%%{init: '.length, -'}%%'.length);
    const parsed = JSON.parse(json) as ReturnType<typeof buildMermaidConfig>;
    expect(parsed.theme).toBe('base');
    expect(parsed.themeVariables.fontSize).toBe('18px');
  });

  it('formats YAML frontmatter with quoted strings', () => {
    const text = formatMermaidConfig(defaultMermaidConfigDraft(), 'frontmatter');
    expect(text.startsWith('---\nconfig:\n')).toBe(true);
    expect(text).toContain('  theme: "default"');
    expect(text).toContain('    fontSize: "16px"');
    expect(text).toContain('    primaryColor: "#ececff"');
    expect(text).toContain('    nodeSpacing: 50');
    expect(text).toContain('    useMaxWidth: true');
    expect(text.endsWith('\n---')).toBe(true);
  });

  it('formats plain JSON for tooling', () => {
    const draft = defaultMermaidConfigDraft();
    expect(JSON.parse(formatMermaidConfig(draft, 'json'))).toEqual(buildMermaidConfig(draft));
  });

  it('clamps numeric fields and rejects invalid values', () => {
    expect(clampMermaidNumber('nodeSpacing', -10)).toBe(0);
    expect(clampMermaidNumber('nodeSpacing', 999)).toBe(200);
    expect(clampMermaidNumber('fontSize', 5)).toBe(8);
    expect(clampMermaidNumber('fontSize', 99)).toBe(48);
    expect(clampMermaidNumber('padding', 12.6)).toBe(13);
    expect(clampMermaidNumber('padding', Number.NaN)).toBe(15);
  });

  it('normalizes untrusted drafts and colors', () => {
    const draft = normalizeMermaidConfigDraft({
      theme: 'neon',
      fontSize: 200,
      primaryColor: 'red',
      lineColor: '#AABBCC',
      curve: 'zigzag',
      useMaxWidth: 'yes',
    });
    expect(draft.theme).toBe('default');
    expect(draft.fontSize).toBe(48);
    expect(draft.primaryColor).toBe('#ececff');
    expect(draft.lineColor).toBe('#aabbcc');
    expect(draft.curve).toBe('basis');
    expect(draft.useMaxWidth).toBe(true);
  });

  it('persists and restores the last draft and format', () => {
    const storage = fakeStorage();
    const draft = { ...defaultMermaidConfigDraft(), theme: 'forest' as const, nodeSpacing: 70 };
    saveMermaidConfigState({ draft, format: 'frontmatter' }, storage);

    const stored = storage.values.get(MERMAID_CONFIG_STORAGE_KEY);
    expect(stored).toBeTruthy();

    const restored = loadMermaidConfigState(storage);
    expect(restored.format).toBe('frontmatter');
    expect(restored.draft.theme).toBe('forest');
    expect(restored.draft.nodeSpacing).toBe(70);
  });

  it('falls back to defaults for missing or corrupt storage', () => {
    expect(loadMermaidConfigState(null)).toEqual({
      draft: defaultMermaidConfigDraft(),
      format: 'directive',
    });
    const storage = fakeStorage();
    storage.values.set(MERMAID_CONFIG_STORAGE_KEY, '{not json');
    expect(loadMermaidConfigState(storage).format).toBe('directive');
  });
});
