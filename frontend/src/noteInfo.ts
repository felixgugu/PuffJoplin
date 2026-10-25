import type { NoteInfoField } from './types';

export interface NoteInfoDefinition {
  key: string;
  defaultLabel: string;
  weight: number;
}

export const NOTE_INFO_DEFINITIONS: readonly NoteInfoDefinition[] = [
  { key: 'companyName', defaultLabel: '公司名稱', weight: 600 },
  { key: 'documentNumber', defaultLabel: '文件編號', weight: 400 },
  { key: 'version', defaultLabel: '版本', weight: 400 },
  { key: 'classification', defaultLabel: '機密等級', weight: 400 },
  { key: 'documentTitle', defaultLabel: '文件標題', weight: 700 },
  { key: 'subtitle', defaultLabel: '副標題或專案名稱', weight: 400 },
  { key: 'scope', defaultLabel: '適用範圍或報告期間', weight: 400 },
  { key: 'preparedByUnit', defaultLabel: '編製單位', weight: 400 },
  { key: 'preparedBy', defaultLabel: '編製人員', weight: 400 },
  { key: 'submittedTo', defaultLabel: '提交對象', weight: 400 },
  { key: 'issueDate', defaultLabel: '發行日期', weight: 400 },
  { key: 'footerText', defaultLabel: '頁尾文字', weight: 400 },
] as const;

export const NOTE_INFO_LABEL_MAX_LENGTH = 30;
export const NOTE_INFO_VALUE_MAX_LENGTH = 200;

export function sanitizeNoteInfoText(value: unknown, maxLength: number): string {
  if (typeof value !== 'string') return '';
  return Array.from(
    value
      .replace(/[\u0000-\u001f\u007f]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim(),
  ).slice(0, maxLength).join('');
}

export function defaultNoteInfoFields(): NoteInfoField[] {
  return NOTE_INFO_DEFINITIONS.map((definition) => ({
    key: definition.key,
    label: definition.defaultLabel,
    value: '',
  }));
}

export function normalizeNoteInfoFields(fields: readonly NoteInfoField[] | undefined): NoteInfoField[] {
  const byKey = new Map((fields ?? []).map((field) => [field.key, field]));
  return NOTE_INFO_DEFINITIONS.map((definition) => {
    const field = byKey.get(definition.key);
    return {
      key: definition.key,
      label: sanitizeNoteInfoText(field?.label, NOTE_INFO_LABEL_MAX_LENGTH)
        || definition.defaultLabel,
      value: sanitizeNoteInfoText(field?.value, NOTE_INFO_VALUE_MAX_LENGTH),
    };
  });
}

export function noteInfoFilledCount(fields: readonly NoteInfoField[] | undefined): number {
  return normalizeNoteInfoFields(fields).filter((field) => field.value !== '').length;
}
