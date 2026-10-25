import { describe, expect, it } from 'vitest';
import {
  defaultNoteInfoFields,
  normalizeNoteInfoFields,
  noteInfoFilledCount,
  NOTE_INFO_LABEL_MAX_LENGTH,
  NOTE_INFO_VALUE_MAX_LENGTH,
} from './noteInfo';

describe('note additional information', () => {
  it('defines the fixed twelve fields in display order', () => {
    const fields = defaultNoteInfoFields();
    expect(fields).toHaveLength(12);
    expect(fields[0]).toEqual({ key: 'companyName', label: '公司名稱', value: '' });
    expect(fields[4].key).toBe('documentTitle');
  });

  it('normalizes labels, values and missing fields', () => {
    const fields = normalizeNoteInfoFields([
      { key: 'companyName', label: '  機構  ', value: ' Puff\n公司 ' },
      { key: 'documentTitle', label: '', value: '' },
      { key: 'unknown', label: '忽略', value: '忽略' },
    ]);
    expect(fields).toHaveLength(12);
    expect(fields[0].label).toBe('機構');
    expect(fields[0].value).toBe('Puff 公司');
    expect(fields[4].label).toBe('文件標題');
    expect(fields.some((field) => field.key === 'unknown')).toBe(false);
  });

  it('enforces Unicode limits and counts filled values', () => {
    const fields = defaultNoteInfoFields();
    fields[0].label = '名'.repeat(NOTE_INFO_LABEL_MAX_LENGTH + 5);
    fields[1].value = '值'.repeat(NOTE_INFO_VALUE_MAX_LENGTH + 5);
    const normalized = normalizeNoteInfoFields(fields);
    expect(Array.from(normalized[0].label)).toHaveLength(NOTE_INFO_LABEL_MAX_LENGTH);
    expect(Array.from(normalized[1].value)).toHaveLength(NOTE_INFO_VALUE_MAX_LENGTH);
    expect(noteInfoFilledCount(normalized)).toBe(1);
  });
});
