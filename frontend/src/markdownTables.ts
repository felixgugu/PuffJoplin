import {
  delimiterAlignments,
  markdownTableDisplayWidth,
  sourceLines,
  splitTableRow,
  tableBlocks,
  type MarkdownTableAlignment,
  type SourceLine,
} from './markdownTableFormat';

export interface MarkdownTable {
  id: string;
  index: number;
  from: number;
  to: number;
  startLine: number;
  endLine: number;
  headers: string[];
  rows: string[][];
  alignments: MarkdownTableAlignment[];
  columnCount: number;
  heading: string;
  source: string;
}

export type XlsxAlignment = 'left' | 'center' | 'right';

export interface XlsxCell {
  value: string | number;
  fontWeight?: 'bold';
  backgroundColor?: string;
  align?: XlsxAlignment;
  wrap?: boolean;
}

export type XlsxRow = Array<XlsxCell | null>;

export interface XlsxSheet {
  data: XlsxRow[];
  sheet: string;
  columns: Array<{ width: number }>;
  stickyRowsCount: number;
}

const inlineCodePlaceholder = '\uE000';
const openingFencePattern = /^ {0,3}(`{3,}|~{3,})(.*)$/;
const closingFencePattern = /^ {0,3}(`{3,}|~{3,})\s*$/;
const headingPattern = /^ {0,3}#{1,6}[ \t]+(.+?)\s*#*\s*$/;
const invalidSheetCharacters = /[\\/?*\[\]:]/g;
const maximumSheetNameLength = 31;

function lineIndexAt(lines: readonly SourceLine[], position: number): number {
  let low = 0;
  let high = lines.length - 1;
  let result = 0;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    if (lines[middle].start <= position) {
      result = middle;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }
  return result;
}

function fencedLineFlags(lines: readonly SourceLine[]): boolean[] {
  const flags = lines.map(() => false);
  let fence: { character: string; length: number } | null = null;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].text;
    if (fence) {
      flags[index] = true;
      const closing = closingFencePattern.exec(line);
      if (
        closing &&
        closing[1][0] === fence.character &&
        closing[1].length >= fence.length
      ) {
        fence = null;
      }
      continue;
    }
    const opening = openingFencePattern.exec(line);
    if (!opening) continue;
    flags[index] = true;
    fence = { character: opening[1][0], length: opening[1].length };
  }
  return flags;
}

function padCells(cells: readonly string[], count: number): string[] {
  return Array.from({ length: count }, (_, index) => cells[index] ?? '');
}

export function markdownCellToPlainText(value: string): string {
  const codeSpans: string[] = [];
  let text = value.replace(/(`+)([\s\S]*?)\1/g, (_match, _ticks, code: string) => {
    codeSpans.push(code.trim());
    return `${inlineCodePlaceholder}${codeSpans.length - 1}${inlineCodePlaceholder}`;
  });
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<[^>]*>/g, '');
  text = text.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1');
  text = text.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');
  text = text.replace(/~~([^~]+)~~/g, '$1');
  text = text.replace(/\*\*([^*]+)\*\*/g, '$1');
  text = text.replace(/(^|[^\w])__([^_]+)__(?=[^\w]|$)/g, '$1$2');
  text = text.replace(/\*([^*]+)\*/g, '$1');
  text = text.replace(/(^|[^\w])_([^_]+)_(?=[^\w]|$)/g, '$1$2');
  text = text.replace(/\\([\\`*_{}\[\]()#+\-.!|>~])/g, '$1');
  text = text.replace(
    new RegExp(`${inlineCodePlaceholder}(\\d+)${inlineCodePlaceholder}`, 'g'),
    (_match, index: string) => codeSpans[Number(index)] ?? '',
  );
  return text.trim();
}

function tableToRows(table: MarkdownTable): string[][] {
  return [table.headers, ...table.rows];
}

export function tableToTsv(table: MarkdownTable): string {
  return tableToRows(table)
    .map((row) => row
      .map((cell) => markdownCellToPlainText(cell)
        .replace(/\r?\n/g, ' ')
        .replace(/\t/g, ' ')
        .trim())
      .join('\t'))
    .join('\n');
}

export function xlsxCellValue(value: string): string | number {
  const plain = markdownCellToPlainText(value);
  if (!plain || !/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(plain)) return plain;
  const number = Number(plain);
  return Number.isFinite(number) && Math.abs(number) < 1e15 ? number : plain;
}

export function sanitizeSheetName(
  value: string,
  fallback: string,
  usedNames: Set<string>,
): string {
  const normalized = (value || fallback)
    .replace(invalidSheetCharacters, ' ')
    .replace(/[\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^'+|'+$/g, '')
    .slice(0, maximumSheetNameLength)
    .trim();
  const root = normalized || fallback.slice(0, maximumSheetNameLength) || '表格';
  let candidate = root;
  let suffix = 2;
  while (usedNames.has(candidate.toLowerCase())) {
    const tag = ` (${suffix})`;
    candidate = `${root.slice(0, maximumSheetNameLength - tag.length).trim()}${tag}`;
    suffix += 1;
  }
  usedNames.add(candidate.toLowerCase());
  return candidate;
}

function alignmentFor(
  table: MarkdownTable,
  column: number,
): XlsxAlignment {
  const alignment = table.alignments[column] ?? 'none';
  if (alignment === 'center') return 'center';
  if (alignment === 'right') return 'right';
  return 'left';
}

export function xlsxColumnWidths(table: MarkdownTable): number[] {
  return Array.from({ length: table.columnCount }, (_, column) => {
    let width = 8;
    for (const cell of tableToRows(table).map((row) => row[column] ?? '')) {
      width = Math.max(width, markdownTableDisplayWidth(markdownCellToPlainText(cell)) + 2);
    }
    return Math.min(48, width);
  });
}

export function buildXlsxSheets(tables: readonly MarkdownTable[]): XlsxSheet[] {
  const usedNames = new Set<string>();
  return tables.map((table) => {
    const fallback = `表格 ${table.index}`;
    const sheet = sanitizeSheetName(table.heading, fallback, usedNames);
    const data: XlsxRow[] = [
      table.headers.map((cell, column) => ({
        value: markdownCellToPlainText(cell),
        fontWeight: 'bold' as const,
        backgroundColor: '#E8F0FE',
        align: alignmentFor(table, column),
        wrap: true,
      })),
      ...table.rows.map((row) => row.map((cell, column) => ({
        value: xlsxCellValue(cell),
        align: alignmentFor(table, column),
        wrap: true,
      }))),
    ];
    return {
      data,
      sheet,
      columns: xlsxColumnWidths(table).map((width) => ({ width })),
      stickyRowsCount: 1,
    };
  });
}

export function extractMarkdownTables(markdown: string): MarkdownTable[] {
  const lines = sourceLines(markdown);
  const fences = fencedLineFlags(lines);
  const blocks = tableBlocks(markdown);
  return blocks.map((block, index) => {
    const startIndex = lineIndexAt(lines, block.from);
    const endIndex = lineIndexAt(lines, block.to);
    const blockLines = lines.slice(startIndex, endIndex + 1);
    const headerRow = splitTableRow(blockLines[0]?.text ?? '');
    const alignments = delimiterAlignments(blockLines[1]?.text ?? '') ?? [];
    const rows = blockLines.slice(2).map((line) => splitTableRow(line.text).cells);
    const columnCount = Math.max(
      headerRow.cells.length,
      ...rows.map((row) => row.length),
      0,
    );
    let heading = '';
    for (let line = startIndex - 1; line >= 0; line -= 1) {
      if (fences[line]) continue;
      const match = headingPattern.exec(lines[line].text);
      if (!match) continue;
      heading = markdownCellToPlainText(match[1]);
      break;
    }
    return {
      id: `table:${block.from}:${block.to}`,
      index: index + 1,
      from: block.from,
      to: block.to,
      startLine: startIndex + 1,
      endLine: endIndex + 1,
      headers: padCells(headerRow.cells, columnCount),
      rows: rows.map((row) => padCells(row, columnCount)),
      alignments: Array.from(
        { length: columnCount },
        (_, column) => alignments[column] ?? 'none',
      ),
      columnCount,
      heading,
      source: markdown.slice(block.from, block.to),
    };
  });
}
