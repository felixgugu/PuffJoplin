import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import {
  normalizeNoteInfoFields,
  NOTE_INFO_LABEL_MAX_LENGTH,
  NOTE_INFO_VALUE_MAX_LENGTH,
} from './noteInfo';
import type { NoteInfoField } from './types';
import UiIcon from './UiIcon';

interface NoteAdditionalInfoDialogProps {
  noteTitle: string;
  fields: readonly NoteInfoField[];
  onCancel: () => void;
  onSave: (fields: NoteInfoField[]) => Promise<void>;
}

export default function NoteAdditionalInfoDialog({
  noteTitle,
  fields,
  onCancel,
  onSave,
}: NoteAdditionalInfoDialogProps) {
  const [draft, setDraft] = useState(() => normalizeNoteInfoFields(fields));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const firstInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    firstInputRef.current?.focus();
  }, []);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError('');
    try {
      await onSave(normalizeNoteInfoFields(draft));
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : String(saveError));
      setSaving(false);
    }
  };

  const updateField = (key: string, changes: Partial<NoteInfoField>) => {
    setDraft((current) => current.map((field) =>
      field.key === key ? { ...field, ...changes } : field));
  };

  return (
    <div className="modal-backdrop" onMouseDown={saving ? undefined : onCancel}>
      <form
        className="modal-card note-info-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="note-info-dialog-title"
        onMouseDown={(event) => event.stopPropagation()}
        onSubmit={(event) => void submit(event)}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && !saving) {
            event.preventDefault();
            onCancel();
          }
        }}
      >
        <header>
          <div>
            <span className="eyebrow">PDF 封面資料</span>
            <h2 id="note-info-dialog-title">筆記附加資訊</h2>
            <p>{noteTitle || '未命名筆記'}</p>
          </div>
          <button
            className="icon-button"
            type="button"
            aria-label="關閉附加資訊"
            disabled={saving}
            onClick={onCancel}
          >
            <UiIcon name="close" />
          </button>
        </header>

        <div className="note-info-dialog-heading" aria-hidden="true">
          <span>參數名稱</span>
          <span>參數值</span>
        </div>
        <div className="note-info-dialog-body">
          {draft.map((field, index) => (
            <div className="note-info-dialog-row" key={field.key}>
              <label>
                <span className="sr-only">{`參數名稱 ${index + 1}`}</span>
                <input
                  ref={index === 0 ? firstInputRef : undefined}
                  type="text"
                  value={field.label}
                  maxLength={NOTE_INFO_LABEL_MAX_LENGTH}
                  disabled={saving}
                  onChange={(event) => updateField(field.key, { label: event.target.value })}
                  onBlur={() => {
                    const normalized = normalizeNoteInfoFields(draft)
                      .find((item) => item.key === field.key);
                    if (normalized) updateField(field.key, { label: normalized.label });
                  }}
                />
              </label>
              <label>
                <span className="sr-only">{field.label}</span>
                <input
                  type="text"
                  value={field.value}
                  maxLength={NOTE_INFO_VALUE_MAX_LENGTH}
                  disabled={saving}
                  placeholder={field.key === 'documentTitle' ? '空白時使用筆記名稱' : '空白時不顯示'}
                  onChange={(event) => updateField(field.key, { value: event.target.value })}
                />
              </label>
            </div>
          ))}
          <p className="note-info-dialog-hint">
            參數值空白時，PDF 封面會同時隱藏名稱與值。文件標題空白時自動使用筆記名稱。
          </p>
          {error && <p className="note-info-dialog-error" role="alert">{error}</p>}
        </div>

        <footer>
          <span>{draft.filter((field) => field.value.trim()).length} / {draft.length} 已填寫</span>
          <div>
            <button type="button" disabled={saving} onClick={onCancel}>取消</button>
            <button className="primary" type="submit" disabled={saving}>
              {saving ? '儲存中…' : '儲存'}
            </button>
          </div>
        </footer>
      </form>
    </div>
  );
}
