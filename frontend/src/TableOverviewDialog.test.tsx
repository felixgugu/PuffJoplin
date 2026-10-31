// @vitest-environment happy-dom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import TableOverviewDialog from './TableOverviewDialog';
import { api } from './api';
import { extractMarkdownTables } from './markdownTables';
import { convertTablesToXlsxBase64 } from './tableExport';

vi.mock('./api', () => ({
  api: {
    copyText: vi.fn(async () => undefined),
    saveXlsxAs: vi.fn(async () => 'C:\\export\\note-表格.xlsx'),
    openFilePath: vi.fn(async () => undefined),
  },
}));

vi.mock('./tableExport', () => ({
  convertTablesToXlsxBase64: vi.fn(async () => 'UEsDBA=='),
  xlsxExportFilename: (title: string) => `${title}-表格.xlsx`,
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let container: HTMLDivElement | null = null;

const tables = extractMarkdownTables([
  '# 第一區',
  '| A | B |',
  '| --- | --- |',
  '| 1 | 2 |',
  '',
  '# 第二區',
  '| C |',
  '| --- |',
  '| 3 |',
].join('\n'));

function renderDialog() {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  const onClose = vi.fn();
  const onLocate = vi.fn();
  act(() => {
    root?.render(
      <TableOverviewDialog
        tables={tables}
        noteTitle="測試筆記"
        onClose={onClose}
        onLocate={onLocate}
      />,
    );
  });
  const dialog = document.body.querySelector<HTMLElement>('.table-overview-dialog');
  if (!dialog) throw new Error('table overview dialog was not rendered');
  return { dialog, onClose, onLocate };
}

function headerButton(dialog: HTMLElement, label: string): HTMLButtonElement {
  const button = Array.from(
    dialog.querySelectorAll<HTMLButtonElement>('.table-overview-header-actions button'),
  ).find((item) => item.getAttribute('aria-label') === label);
  if (!button) throw new Error(`header button not found: ${label}`);
  return button;
}

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  container?.remove();
  container = null;
  vi.clearAllMocks();
});

describe('TableOverviewDialog', () => {
  it('shows one table at a time and switches with the next button', () => {
    const { dialog } = renderDialog();
    const headers = () => Array.from(dialog.querySelectorAll('th'))
      .map((cell) => cell.textContent);
    const cells = () => Array.from(dialog.querySelectorAll('td'))
      .map((cell) => cell.textContent);

    expect(headers()).toEqual(['A', 'B']);
    expect(cells()).toEqual(['1', '2']);

    const next = dialog.querySelector<HTMLButtonElement>('.table-overview-nav.next');
    act(() => next?.click());

    expect(headers()).toEqual(['C']);
    expect(cells()).toEqual(['3']);
    expect(dialog.querySelectorAll('.table-overview-switcher-item')[1]
      ?.getAttribute('aria-selected')).toBe('true');
  });

  it('copies the active table as TSV', async () => {
    const { dialog } = renderDialog();
    await act(async () => {
      headerButton(dialog, '複製目前表格 TSV').click();
      await Promise.resolve();
    });

    expect(api.copyText).toHaveBeenCalledWith('A\tB\n1\t2');
    expect(dialog.querySelector('footer [role="status"]')?.textContent)
      .toContain('已複製表格 1 的 TSV');
  });

  it('exports every table to xlsx and opens the saved file', async () => {
    const { dialog } = renderDialog();
    await act(async () => {
      headerButton(dialog, '匯出全部表格為 Excel').click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(convertTablesToXlsxBase64).toHaveBeenCalledWith(tables);
    expect(api.saveXlsxAs).toHaveBeenCalledWith('測試筆記-表格.xlsx', 'UEsDBA==');
    expect(api.openFilePath).toHaveBeenCalledWith('C:\\export\\note-表格.xlsx');
    expect(dialog.querySelector('footer [role="status"]')?.textContent)
      .toContain('已匯出至');
  });

  it('toggles the maximized state from the header', () => {
    const { dialog } = renderDialog();
    act(() => headerButton(dialog, '放到最大').click());
    expect(dialog.classList.contains('is-maximized')).toBe(true);

    act(() => headerButton(dialog, '還原表格總覽大小').click());
    expect(dialog.classList.contains('is-maximized')).toBe(false);
  });

  it('locates the active table in the note', () => {
    const { dialog, onLocate } = renderDialog();
    act(() => headerButton(dialog, '定位到內文').click());

    expect(onLocate).toHaveBeenCalledWith(tables[0]);
  });
});
