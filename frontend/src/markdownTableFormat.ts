export type MarkdownTableAlignment = 'none' | 'left' | 'center' | 'right';

export interface MarkdownTableFormatChange {
  from: number;
  to: number;
  text: string;
}

export interface MarkdownTableFormatResult {
  changes: MarkdownTableFormatChange[];
  formattedCount: number;
  matchedCount: number;
}

export interface SourceLine {
  end: number;
  start: number;
  text: string;
}

export interface TableBlock {
  from: number;
  to: number;
}

export interface TableRow {
  cells: string[];
  hasPipe: boolean;
}

function codePointWidth(codePoint: number): number {
  if (
    (codePoint >= 0x0300 && codePoint <= 0x036f) ||
    (codePoint >= 0x1ab0 && codePoint <= 0x1aff) ||
    (codePoint >= 0x1dc0 && codePoint <= 0x1dff) ||
    (codePoint >= 0x20d0 && codePoint <= 0x20ff) ||
    (codePoint >= 0xfe20 && codePoint <= 0xfe2f) ||
    (codePoint >= 0xfe00 && codePoint <= 0xfe0f)
  ) {
    return 0;
  }
  if (
    (codePoint >= 0x1100 && codePoint <= 0x115f) ||
    codePoint === 0x2329 ||
    codePoint === 0x232a ||
    (codePoint >= 0x2e80 && codePoint <= 0xa4cf) ||
    (codePoint >= 0xac00 && codePoint <= 0xd7a3) ||
    (codePoint >= 0xf900 && codePoint <= 0xfaff) ||
    (codePoint >= 0xfe10 && codePoint <= 0xfe19) ||
    (codePoint >= 0xfe30 && codePoint <= 0xfe6f) ||
    (codePoint >= 0xff00 && codePoint <= 0xff60) ||
    (codePoint >= 0xffe0 && codePoint <= 0xffe6) ||
    (codePoint >= 0x1f300 && codePoint <= 0x1faff) ||
    (codePoint >= 0x20000 && codePoint <= 0x3fffd)
  ) {
    return 2;
  }
  return 1;
}

export function markdownTableDisplayWidth(value: string): number {
  let width = 0;
  for (const character of value) {
    width += codePointWidth(character.codePointAt(0) ?? 0);
  }
  return width;
}

export function splitTableRow(line: string): TableRow {
  const value = line.trim();
  const cells: string[] = [];
  let cell = '';
  let escaped = false;
  let codeTicks = 0;
  let hasPipe = false;

  for (let index = 0; index < value.length; index++) {
    const character = value[index];
    if (escaped) {
      cell += character;
      escaped = false;
      continue;
    }
    if (character === '\\') {
      cell += character;
      escaped = true;
      continue;
    }
    if (character === '`') {
      let ticks = 1;
      while (value[index + ticks] === '`') ticks++;
      cell += '`'.repeat(ticks);
      if (codeTicks === 0) codeTicks = ticks;
      else if (codeTicks === ticks) codeTicks = 0;
      index += ticks - 1;
      continue;
    }
    if (character === '|' && codeTicks === 0) {
      cells.push(cell.trim());
      cell = '';
      hasPipe = true;
      continue;
    }
    cell += character;
  }
  cells.push(cell.trim());
  if (value.startsWith('|')) cells.shift();
  if (value.endsWith('|') && cells[cells.length - 1] === '') cells.pop();
  return { cells, hasPipe };
}

export function delimiterAlignments(line: string): MarkdownTableAlignment[] | null {
  const row = splitTableRow(line);
  if (row.cells.length === 0) return null;
  const alignments: MarkdownTableAlignment[] = [];
  for (const cell of row.cells) {
    const value = cell.trim();
    if (!/^:?-{3,}:?$/.test(value)) return null;
    const left = value.startsWith(':');
    const right = value.endsWith(':');
    alignments.push(left && right ? 'center' : left ? 'left' : right ? 'right' : 'none');
  }
  return alignments;
}

export function sourceLines(markdown: string): SourceLine[] {
  const lines: SourceLine[] = [];
  let start = 0;
  while (start <= markdown.length) {
    const newline = markdown.indexOf('\n', start);
    const rawEnd = newline === -1 ? markdown.length : newline;
    const raw = markdown.slice(start, rawEnd);
    const end = raw.endsWith('\r') ? rawEnd - 1 : rawEnd;
    lines.push({ start, end, text: markdown.slice(start, end) });
    if (newline === -1) break;
    start = newline + 1;
  }
  return lines;
}

export function tableBlocks(markdown: string): TableBlock[] {
  const lines = sourceLines(markdown);
  const blocks: TableBlock[] = [];
  let fenceCharacter = '';
  let fenceLength = 0;

  for (let index = 0; index < lines.length - 1; index++) {
    const trimmed = lines[index].text.trimStart();
    const fence = trimmed.match(/^(`{3,}|~{3,})/);
    if (fenceCharacter) {
      if (
        fence &&
        fence[1][0] === fenceCharacter &&
        fence[1].length >= fenceLength
      ) {
        fenceCharacter = '';
        fenceLength = 0;
      }
      continue;
    }
    if (fence) {
      fenceCharacter = fence[1][0];
      fenceLength = fence[1].length;
      continue;
    }

    const header = splitTableRow(lines[index].text);
    const alignments = delimiterAlignments(lines[index + 1].text);
    if (!header.hasPipe || !alignments) continue;

    let lastLine = index + 1;
    while (lastLine + 1 < lines.length) {
      const row = splitTableRow(lines[lastLine + 1].text);
      if (lines[lastLine + 1].text.trim() === '' || !row.hasPipe) break;
      lastLine++;
    }
    blocks.push({
      from: lines[index].start,
      to: lines[lastLine].end,
    });
    index = lastLine;
  }
  return blocks;
}

function minimumColumnWidth(alignment: MarkdownTableAlignment): number {
  if (alignment === 'center') return 5;
  if (alignment === 'left' || alignment === 'right') return 4;
  return 3;
}

function alignedCell(value: string, width: number, alignment: MarkdownTableAlignment): string {
  const missing = Math.max(0, width - markdownTableDisplayWidth(value));
  if (alignment === 'right') return `${' '.repeat(missing)}${value}`;
  if (alignment === 'center') {
    const left = Math.floor(missing / 2);
    return `${' '.repeat(left)}${value}${' '.repeat(missing - left)}`;
  }
  return `${value}${' '.repeat(missing)}`;
}

function delimiterCell(width: number, alignment: MarkdownTableAlignment): string {
  if (alignment === 'center') return `:${'-'.repeat(width - 2)}:`;
  if (alignment === 'left') return `:${'-'.repeat(width - 1)}`;
  if (alignment === 'right') return `${'-'.repeat(width - 1)}:`;
  return '-'.repeat(width);
}

export function formatMarkdownTableText(value: string): string | null {
  const newline = value.includes('\r\n') ? '\r\n' : '\n';
  const lines = value.split(/\r?\n/);
  if (lines.length < 2) return null;
  const rows = lines.map(splitTableRow);
  const alignments = delimiterAlignments(lines[1]);
  if (!rows[0].hasPipe || !alignments) return null;

  const columnCount = Math.max(...rows.map((row) => row.cells.length));
  if (columnCount === 0) return null;
  const normalizedAlignments = Array.from(
    { length: columnCount },
    (_, index) => alignments[index] ?? 'none',
  );
  const widths = Array.from({ length: columnCount }, (_, column) => {
    let width = minimumColumnWidth(normalizedAlignments[column]);
    for (const row of rows) {
      width = Math.max(
        width,
        markdownTableDisplayWidth(row.cells[column] ?? ''),
      );
    }
    return width;
  });
  const indent = lines[0].match(/^[ \t]*/)?.[0] ?? '';
  const output = rows.map((row, rowIndex) => {
    const cells = widths.map((width, column) => {
      if (rowIndex === 1) {
        return delimiterCell(width, normalizedAlignments[column]);
      }
      return alignedCell(
        row.cells[column] ?? '',
        width,
        normalizedAlignments[column],
      );
    });
    return `${indent}| ${cells.join(' | ')} |`;
  });
  return output.join(newline);
}

export function formatMarkdownTables(
  markdown: string,
  selectionFrom: number,
  selectionTo: number,
): MarkdownTableFormatResult {
  const from = Math.max(0, Math.min(selectionFrom, selectionTo));
  const to = Math.min(markdown.length, Math.max(selectionFrom, selectionTo));
  const emptySelection = from === to;
  const changes: MarkdownTableFormatChange[] = [];
  let matchedCount = 0;
  for (const block of tableBlocks(markdown)) {
    const selected = emptySelection
      ? from >= block.from && from <= block.to
      : block.from <= to && block.to >= from;
    if (!selected) continue;
    matchedCount++;
    const formatted = formatMarkdownTableText(markdown.slice(block.from, block.to));
    if (formatted === null || formatted === markdown.slice(block.from, block.to)) continue;
    changes.push({ from: block.from, to: block.to, text: formatted });
  }
  return { changes, formattedCount: changes.length, matchedCount };
}
