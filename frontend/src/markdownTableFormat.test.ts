import { describe, expect, it } from 'vitest';
import {
  formatMarkdownTableText,
  formatMarkdownTables,
  markdownTableDisplayWidth,
} from './markdownTableFormat';

function applyChanges(
  markdown: string,
  changes: ReturnType<typeof formatMarkdownTables>['changes'],
) {
  let output = markdown;
  for (const change of [...changes].reverse()) {
    output = output.slice(0, change.from) + change.text + output.slice(change.to);
  }
  return output;
}

describe('Markdown table formatter', () => {
  it('aligns columns, CJK widths, and declared alignment', () => {
    const table = [
      '|Name|Qty|',
      '|:--- | ---:|',
      '|Apple|10|',
      '|中文|2|',
    ].join('\n');

    expect(formatMarkdownTableText(table)).toBe([
      '| Name  |  Qty |',
      '| :---- | ---: |',
      '| Apple |   10 |',
      '| 中文  |    2 |',
    ].join('\n'));
  });

  it('does not split escaped pipes or pipes inside code spans', () => {
    const table = [
      '| Expr | Description |',
      '|---|---|',
      '| `a | b` | left \\| right |',
    ].join('\n');
    const formatted = formatMarkdownTableText(table);

    expect(formatted).toContain('| `a | b` | left \\| right |');
  });

  it('formats the table at the cursor and skips fenced examples', () => {
    const markdown = [
      '```md',
      '| Fake | Table |',
      '| --- | --- |',
      '| no | format |',
      '```',
      '',
      '| Real | Table |',
      '| --- | --- |',
      '| yes | format |',
    ].join('\n');
    const realStart = markdown.indexOf('| Real');
    const result = formatMarkdownTables(markdown, realStart + 3, realStart + 3);

    expect(result.formattedCount).toBe(1);
    expect(applyChanges(markdown, result.changes)).toContain([
      '| Real | Table  |',
      '| ---- | ------ |',
      '| yes  | format |',
    ].join('\n'));
    expect(applyChanges(markdown, result.changes)).toContain('| Fake | Table |');
  });

  it('formats every table intersecting a selection', () => {
    const markdown = [
      '| A | B |',
      '| --- | --- |',
      '| 1 | 2 |',
      '',
      'Text',
      '',
      '| C | D |',
      '| --- | --- |',
      '| 3 | 4 |',
    ].join('\n');
    const result = formatMarkdownTables(markdown, 0, markdown.length);

    expect(result.formattedCount).toBe(2);
    const output = applyChanges(markdown, result.changes);
    expect(output).toContain('| A   | B   |');
    expect(output).toContain('| C   | D   |');
  });

  it('measures CJK characters as two display columns', () => {
    expect(markdownTableDisplayWidth('ABC')).toBe(3);
    expect(markdownTableDisplayWidth('中文')).toBe(4);
    expect(markdownTableDisplayWidth('A中')).toBe(3);
  });
});
