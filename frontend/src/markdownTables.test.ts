import { describe, expect, it } from 'vitest';
import {
  buildXlsxSheets,
  extractMarkdownTables,
  markdownCellToPlainText,
  sanitizeSheetName,
  tableToTsv,
  xlsxCellValue,
} from './markdownTables';

const markdown = [
  '# 銷售報表',
  '',
  '| 品項 | 數量 | 金額 |',
  '| :--- | ---: | :---: |',
  '| Apple | 10 | 1,200 |',
  '| 中文 | 2 | 007 |',
  '',
  '```md',
  '| 不應抓到 | 這裡 |',
  '| --- | --- |',
  '| x | y |',
  '```',
  '',
  '## 第二區',
  '',
  '| A | B |',
  '| --- | --- |',
  '| x | y |',
].join('\n');

describe('markdown table extraction', () => {
  it('collects pipe tables and skips fenced code blocks', () => {
    const tables = extractMarkdownTables(markdown);

    expect(tables).toHaveLength(2);
    expect(tables[0].index).toBe(1);
    expect(tables[0].heading).toBe('銷售報表');
    expect(tables[0].startLine).toBe(3);
    expect(tables[0].endLine).toBe(6);
    expect(tables[0].headers).toEqual(['品項', '數量', '金額']);
    expect(tables[0].rows).toEqual([
      ['Apple', '10', '1,200'],
      ['中文', '2', '007'],
    ]);
    expect(tables[0].alignments).toEqual(['left', 'right', 'center']);
    expect(tables[1].heading).toBe('第二區');
    expect(tables[1].columnCount).toBe(2);
  });

  it('returns no tables for plain text', () => {
    expect(extractMarkdownTables('# 筆記\n\n沒有表格')).toEqual([]);
  });

  it('keeps escaped pipes and inline code pipes inside cells', () => {
    const tables = extractMarkdownTables([
      '| A | B |',
      '| --- | --- |',
      '| a \\| b | `x | y` |',
    ].join('\n'));

    expect(tables[0].rows).toEqual([['a \\| b', '`x | y`']]);
    expect(markdownCellToPlainText(tables[0].rows[0][0])).toBe('a | b');
    expect(markdownCellToPlainText(tables[0].rows[0][1])).toBe('x | y');
  });

  it('pads rows and alignments to the widest row', () => {
    const tables = extractMarkdownTables([
      '| A | B | C |',
      '| --- | --- | --- |',
      '| 1 |',
    ].join('\n'));

    expect(tables[0].rows).toEqual([['1', '', '']]);
    expect(tables[0].alignments).toEqual(['none', 'none', 'none']);
  });
});

describe('table text formats', () => {
  it('builds TSV with normalized line breaks and tabs', () => {
    const tables = extractMarkdownTables([
      '| A | B |',
      '| --- | --- |',
      '| **粗體** | [連結](https://example.com) |',
      '| 第一行<br>第二行 | 含\tTab |',
    ].join('\n'));

    expect(tableToTsv(tables[0])).toBe([
      'A\tB',
      '粗體\t連結',
      '第一行 第二行\t含 Tab',
    ].join('\n'));
  });

  it('converts safe numbers and keeps leading zeros as text', () => {
    expect(xlsxCellValue('12')).toBe(12);
    expect(xlsxCellValue('-3.5')).toBe(-3.5);
    expect(xlsxCellValue('0.5')).toBe(0.5);
    expect(xlsxCellValue('007')).toBe('007');
    expect(xlsxCellValue('1,234')).toBe('1,234');
    expect(xlsxCellValue('2026-10-31')).toBe('2026-10-31');
    expect(xlsxCellValue('**12**')).toBe(12);
  });

  it('strips inline Markdown without breaking inline code contents', () => {
    expect(markdownCellToPlainText('**bold** and `a*b*c` and [link](x)'))
      .toBe('bold and a*b*c and link');
  });
});

describe('xlsx workbook data', () => {
  it('uses headings as sheet names and deduplicates them', () => {
    const used = new Set<string>();
    expect(sanitizeSheetName('銷售/報表', '表格 1', used)).toBe('銷售 報表');
    expect(sanitizeSheetName('銷售/報表', '表格 2', used)).toBe('銷售 報表 (2)');
    expect(sanitizeSheetName('[bad]:name?*', '表格 3', used)).toBe('bad name');
    expect(sanitizeSheetName('', '表格 4', used)).toBe('表格 4');
  });

  it('builds one styled sheet per table', () => {
    const tables = extractMarkdownTables(markdown);
    const sheets = buildXlsxSheets(tables);

    expect(sheets).toHaveLength(2);
    expect(sheets[0].sheet).toBe('銷售報表');
    expect(sheets[0].stickyRowsCount).toBe(1);
    expect(sheets[0].columns).toHaveLength(3);
    expect(sheets[0].data[0][0]).toMatchObject({
      value: '品項',
      fontWeight: 'bold',
      align: 'left',
    });
    expect(sheets[0].data[1][1]).toMatchObject({ value: 10, align: 'right' });
    expect(sheets[0].data[2][2]).toMatchObject({ value: '007', align: 'center' });
    expect(sheets[1].sheet).toBe('第二區');
  });
});
