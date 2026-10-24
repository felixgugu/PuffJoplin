import { describe, expect, it } from 'vitest';
import { prepareNotebookDialogSubmission } from './notebookDialog';

describe('notebook dialog submission', () => {
  it('rejects an empty notebook name', () => {
    expect(prepareNotebookDialogSubmission('create', '   ')).toEqual({
      title: '',
      error: '請輸入筆記本名稱',
      unchanged: false,
    });
  });

  it('trims a new notebook name', () => {
    expect(prepareNotebookDialogSubmission('create', '  工作筆記  ')).toEqual({
      title: '工作筆記',
      error: '',
      unchanged: false,
    });
  });

  it('recognizes an unchanged rename', () => {
    expect(prepareNotebookDialogSubmission('rename', ' 專案 ', '專案')).toEqual({
      title: '專案',
      error: '',
      unchanged: true,
    });
  });
});
