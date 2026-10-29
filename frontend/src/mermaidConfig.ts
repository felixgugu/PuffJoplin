export type MermaidConfigFormat = 'directive' | 'frontmatter' | 'json';
export type MermaidThemeName = 'default' | 'base' | 'forest' | 'dark' | 'neutral';
export type MermaidCurveName = 'basis' | 'linear' | 'step' | 'stepBefore' | 'stepAfter';
export type MermaidSpacingKey =
  | 'nodeSpacing'
  | 'rankSpacing'
  | 'padding'
  | 'diagramPadding'
  | 'wrappingWidth';
export type MermaidColorKey =
  | 'primaryColor'
  | 'primaryTextColor'
  | 'lineColor'
  | 'clusterBkg'
  | 'clusterBorder';

export interface MermaidConfigDraft {
  theme: MermaidThemeName;
  fontSize: number;
  primaryColor: string;
  primaryTextColor: string;
  lineColor: string;
  clusterBkg: string;
  clusterBorder: string;
  curve: MermaidCurveName;
  nodeSpacing: number;
  rankSpacing: number;
  padding: number;
  diagramPadding: number;
  wrappingWidth: number;
  useMaxWidth: boolean;
  htmlLabels: boolean;
}

export interface MermaidConfigState {
  draft: MermaidConfigDraft;
  format: MermaidConfigFormat;
}

export const MERMAID_CONFIG_STORAGE_KEY = 'puffjoplin.mermaid-config.v1';

export const MERMAID_THEME_OPTIONS: ReadonlyArray<{ value: MermaidThemeName; label: string }> = [
  { value: 'default', label: 'Default' },
  { value: 'base', label: 'Base' },
  { value: 'forest', label: 'Forest' },
  { value: 'dark', label: 'Dark' },
  { value: 'neutral', label: 'Neutral' },
];

export const MERMAID_CURVE_OPTIONS: ReadonlyArray<{ value: MermaidCurveName; label: string }> = [
  { value: 'basis', label: '曲線（basis）' },
  { value: 'linear', label: '直線（linear）' },
  { value: 'step', label: '階梯（step）' },
  { value: 'stepBefore', label: '階梯前（stepBefore）' },
  { value: 'stepAfter', label: '階梯後（stepAfter）' },
];

export const MERMAID_FORMAT_OPTIONS: ReadonlyArray<{
  value: MermaidConfigFormat;
  label: string;
  hint: string;
}> = [
  { value: 'directive', label: '%%{init}%%', hint: '貼在 mermaid 區塊第一行' },
  { value: 'frontmatter', label: 'Frontmatter', hint: '貼在 mermaid 區塊最前面' },
  { value: 'json', label: 'JSON', hint: '給程式或工具使用' },
];

export const MERMAID_SPACING_FIELDS: ReadonlyArray<{
  key: MermaidSpacingKey;
  label: string;
  min: number;
  max: number;
  step: number;
}> = [
  { key: 'nodeSpacing', label: '節點間距', min: 0, max: 200, step: 5 },
  { key: 'rankSpacing', label: '層間距', min: 0, max: 200, step: 5 },
  { key: 'padding', label: '節點內距', min: 0, max: 60, step: 1 },
  { key: 'diagramPadding', label: '圖表外距', min: 0, max: 60, step: 1 },
  { key: 'wrappingWidth', label: '標籤換行寬度', min: 40, max: 600, step: 10 },
];

export const MERMAID_COLOR_FIELDS: ReadonlyArray<{ key: MermaidColorKey; label: string }> = [
  { key: 'primaryColor', label: '主要節點' },
  { key: 'primaryTextColor', label: '節點文字' },
  { key: 'lineColor', label: '連線' },
  { key: 'clusterBkg', label: '子圖背景' },
  { key: 'clusterBorder', label: '子圖邊框' },
];

export const defaultMermaidConfigDraft = (): MermaidConfigDraft => ({
  theme: 'default',
  fontSize: 16,
  primaryColor: '#ececff',
  primaryTextColor: '#131300',
  lineColor: '#333333',
  clusterBkg: '#ffffde',
  clusterBorder: '#aaaa33',
  curve: 'basis',
  nodeSpacing: 50,
  rankSpacing: 50,
  padding: 15,
  diagramPadding: 8,
  wrappingWidth: 200,
  useMaxWidth: true,
  htmlLabels: true,
});

const numberLimits = (key: MermaidSpacingKey | 'fontSize'): { min: number; max: number } => {
  if (key === 'fontSize') return { min: 8, max: 48 };
  const field = MERMAID_SPACING_FIELDS.find((item) => item.key === key);
  return field ? { min: field.min, max: field.max } : { min: 0, max: 400 };
};

export function clampMermaidNumber(key: MermaidSpacingKey | 'fontSize', value: number): number {
  const { min, max } = numberLimits(key);
  if (!Number.isFinite(value)) return defaultMermaidConfigDraft()[key];
  return Math.min(max, Math.max(min, Math.round(value)));
}

const isHexColor = (value: string) => /^#[0-9a-f]{6}$/i.test(value.trim());

const normalizeColor = (value: unknown, fallback: string) => {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return isHexColor(trimmed) ? trimmed.toLowerCase() : fallback;
};

const isTheme = (value: unknown): value is MermaidThemeName =>
  MERMAID_THEME_OPTIONS.some((option) => option.value === value);

const isCurve = (value: unknown): value is MermaidCurveName =>
  MERMAID_CURVE_OPTIONS.some((option) => option.value === value);

const isFormat = (value: unknown): value is MermaidConfigFormat =>
  MERMAID_FORMAT_OPTIONS.some((option) => option.value === value);

export function normalizeMermaidConfigDraft(value: unknown): MermaidConfigDraft {
  const fallback = defaultMermaidConfigDraft();
  if (!value || typeof value !== 'object') return fallback;
  const source = value as Partial<Record<keyof MermaidConfigDraft, unknown>>;
  const boolean = (key: 'useMaxWidth' | 'htmlLabels') =>
    typeof source[key] === 'boolean' ? source[key] as boolean : fallback[key];
  return {
    theme: isTheme(source.theme) ? source.theme : fallback.theme,
    fontSize: clampMermaidNumber('fontSize', Number(source.fontSize ?? fallback.fontSize)),
    primaryColor: normalizeColor(source.primaryColor, fallback.primaryColor),
    primaryTextColor: normalizeColor(source.primaryTextColor, fallback.primaryTextColor),
    lineColor: normalizeColor(source.lineColor, fallback.lineColor),
    clusterBkg: normalizeColor(source.clusterBkg, fallback.clusterBkg),
    clusterBorder: normalizeColor(source.clusterBorder, fallback.clusterBorder),
    curve: isCurve(source.curve) ? source.curve : fallback.curve,
    nodeSpacing: clampMermaidNumber('nodeSpacing', Number(source.nodeSpacing ?? fallback.nodeSpacing)),
    rankSpacing: clampMermaidNumber('rankSpacing', Number(source.rankSpacing ?? fallback.rankSpacing)),
    padding: clampMermaidNumber('padding', Number(source.padding ?? fallback.padding)),
    diagramPadding: clampMermaidNumber(
      'diagramPadding',
      Number(source.diagramPadding ?? fallback.diagramPadding),
    ),
    wrappingWidth: clampMermaidNumber(
      'wrappingWidth',
      Number(source.wrappingWidth ?? fallback.wrappingWidth),
    ),
    useMaxWidth: boolean('useMaxWidth'),
    htmlLabels: boolean('htmlLabels'),
  };
}

export interface MermaidConfigObject {
  theme: MermaidThemeName;
  themeVariables: {
    fontSize: string;
    primaryColor: string;
    primaryTextColor: string;
    lineColor: string;
    clusterBkg: string;
    clusterBorder: string;
  };
  flowchart: {
    curve: MermaidCurveName;
    nodeSpacing: number;
    rankSpacing: number;
    padding: number;
    diagramPadding: number;
    wrappingWidth: number;
    useMaxWidth: boolean;
    htmlLabels: boolean;
  };
}

export function buildMermaidConfig(draft: MermaidConfigDraft): MermaidConfigObject {
  const normalized = normalizeMermaidConfigDraft(draft);
  return {
    theme: normalized.theme,
    themeVariables: {
      fontSize: `${normalized.fontSize}px`,
      primaryColor: normalized.primaryColor,
      primaryTextColor: normalized.primaryTextColor,
      lineColor: normalized.lineColor,
      clusterBkg: normalized.clusterBkg,
      clusterBorder: normalized.clusterBorder,
    },
    flowchart: {
      curve: normalized.curve,
      nodeSpacing: normalized.nodeSpacing,
      rankSpacing: normalized.rankSpacing,
      padding: normalized.padding,
      diagramPadding: normalized.diagramPadding,
      wrappingWidth: normalized.wrappingWidth,
      useMaxWidth: normalized.useMaxWidth,
      htmlLabels: normalized.htmlLabels,
    },
  };
}

const yamlScalar = (value: string | number | boolean) =>
  typeof value === 'string' ? JSON.stringify(value) : String(value);

export function formatMermaidConfig(
  draft: MermaidConfigDraft,
  format: MermaidConfigFormat,
): string {
  const config = buildMermaidConfig(draft);
  if (format === 'json') return JSON.stringify(config, null, 2);
  if (format === 'frontmatter') {
    const lines = [
      '---',
      'config:',
      `  theme: ${yamlScalar(config.theme)}`,
      '  themeVariables:',
      ...Object.entries(config.themeVariables).map(
        ([key, value]) => `    ${key}: ${yamlScalar(value)}`,
      ),
      '  flowchart:',
      ...Object.entries(config.flowchart).map(
        ([key, value]) => `    ${key}: ${yamlScalar(value)}`,
      ),
      '---',
    ];
    return lines.join('\n');
  }
  const indented = JSON.stringify(config, null, 2)
    .split('\n')
    .map((line, index) => (index === 0 ? line : `  ${line}`))
    .join('\n');
  return `%%{init: ${indented}}%%`;
}

function browserStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function loadMermaidConfigState(
  storage: Pick<Storage, 'getItem'> | null = browserStorage(),
): MermaidConfigState {
  const fallback: MermaidConfigState = { draft: defaultMermaidConfigDraft(), format: 'directive' };
  if (!storage) return fallback;
  try {
    const raw = storage.getItem(MERMAID_CONFIG_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as { draft?: unknown; format?: unknown };
    return {
      draft: normalizeMermaidConfigDraft(parsed.draft),
      format: isFormat(parsed.format) ? parsed.format : fallback.format,
    };
  } catch {
    return fallback;
  }
}

export function saveMermaidConfigState(
  state: MermaidConfigState,
  storage: Pick<Storage, 'setItem'> | null = browserStorage(),
): void {
  if (!storage) return;
  try {
    storage.setItem(MERMAID_CONFIG_STORAGE_KEY, JSON.stringify({
      draft: normalizeMermaidConfigDraft(state.draft),
      format: state.format,
    }));
  } catch {
    // Storage is best-effort; the dialog still works without persistence.
  }
}
