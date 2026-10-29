const rawIconModules = import.meta.glob(
  './assets/toolbar-icons-fontawesome/svg/*.svg',
  { eager: true, query: '?raw', import: 'default' },
) as Record<string, string>;

const rawIcons = new Map(
  Object.entries(rawIconModules).map(([path, svg]) => [
    path.split('/').pop()?.replace(/\.svg$/i, '') || '',
    svg,
  ]),
);

export const TOOLBAR_ICON_FILE_BY_NAME = {
  emoji: 'face-smile',
  headings: 'heading',
  bold: 'bold',
  italic: 'italic',
  strike: 'strikethrough',
  'text-color': 'font',
  link: 'link',
  list: 'list-ul',
  'ordered-list': 'list-ol',
  check: 'list-check',
  outdent: 'outdent',
  indent: 'indent',
  quote: 'quote-right',
  line: 'minus',
  code: 'file-code',
  'inline-code': 'code',
  'insert-before': 'arrow-up-long',
  'insert-after': 'arrow-down-long',
  upload: 'cloud-arrow-up',
  table: 'table',
  'format-table': 'table-list-solid-full',
  gallery: 'images',
  'mermaid-config': 'sliders',
  'source-word-wrap': 'text-width',
  undo: 'rotate-left',
  redo: 'rotate-right',
  'page-prev': 'arrow-up',
  'page-next': 'arrow-down',
  'find-replace': 'magnifying-glass',
  'fold-all': 'chevron-right-solid-full',
  'unfold-all': 'caret-down-solid-full',
  'wysiwyg-mode': 'mode-wysiwyg',
  'ir-mode': 'mode-instant-render',
  'source-mode': 'file-code-regular-full',
  both: 'table-columns',
  preview: 'eye',
  outline: 'list',
  fullscreen: 'expand',
} as const;

export type ToolbarIconName = keyof typeof TOOLBAR_ICON_FILE_BY_NAME;

function normalizeIcon(svg: string): string {
  let normalized = svg.trim();
  if (!normalized.includes('currentColor')) {
    normalized = normalized.replace(/<svg\b/, '<svg fill="currentColor"');
  }
  return normalized.replace(
    /<svg\b/,
    '<svg class="puff-toolbar-svg" aria-hidden="true" focusable="false"',
  );
}

export function toolbarIcon(name: ToolbarIconName): string {
  const fileName = TOOLBAR_ICON_FILE_BY_NAME[name];
  const svg = rawIcons.get(fileName);
  if (!svg) throw new Error(`Missing toolbar SVG: ${fileName}.svg`);
  return normalizeIcon(svg);
}
