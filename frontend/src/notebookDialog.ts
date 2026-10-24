export type NotebookDialogMode = 'create' | 'rename';

export interface NotebookDialogSubmission {
  title: string;
  error: string;
  unchanged: boolean;
}

export function prepareNotebookDialogSubmission(
  mode: NotebookDialogMode,
  value: string,
  originalTitle = '',
): NotebookDialogSubmission {
  const title = value.trim();
  if (!title) {
    return { title: '', error: '請輸入筆記本名稱', unchanged: false };
  }
  return {
    title,
    error: '',
    unchanged: mode === 'rename' && title === originalTitle,
  };
}
