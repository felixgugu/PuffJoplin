import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import {
  addTagValues,
  removeTagValue,
  visibleTagCount,
} from './tagEditing';
import UiIcon from './UiIcon';

interface NoteTagsProps {
  tags: string[];
  disabled: boolean;
  onChange: (tags: string[]) => void;
}

export default function NoteTags({ tags, disabled, onChange }: NoteTagsProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const barRef = useRef<HTMLButtonElement | null>(null);
  const measureRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [renderedCount, setRenderedCount] = useState(tags.length);

  const measure = useCallback(() => {
    const bar = barRef.current;
    const measureRow = measureRef.current;
    if (!bar || !measureRow) return;
    const style = window.getComputedStyle(bar);
    const padding = Number.parseFloat(style.paddingLeft) + Number.parseFloat(style.paddingRight);
    const gap = Number.parseFloat(window.getComputedStyle(measureRow).columnGap) || 4;
    const widths = Array.from(
      measureRow.querySelectorAll<HTMLElement>('[data-measure-tag]'),
      (element) => element.offsetWidth,
    );
    const counter = measureRow.querySelector<HTMLElement>('[data-measure-counter]');
    const next = visibleTagCount(
      widths,
      Math.max(0, bar.clientWidth - padding),
      counter?.offsetWidth ?? 0,
      gap,
    );
    setRenderedCount((current) => current === next ? current : next);
  }, []);

  useLayoutEffect(() => {
    measure();
    const bar = barRef.current;
    if (!bar || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(bar);
    return () => observer.disconnect();
  }, [measure, tags]);

  const commitDraft = useCallback(() => {
    const next = addTagValues(tags, draft);
    setDraft('');
    if (next.length !== tags.length || next.some((tag, index) => tag !== tags[index])) {
      onChange(next);
    }
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }, [draft, onChange, tags]);

  const closeAndCommit = useCallback(() => {
    if (!disabled && draft.trim()) commitDraft();
    else setDraft('');
    setOpen(false);
  }, [commitDraft, disabled, draft]);

  useEffect(() => {
    if (!open) return undefined;
    const closeOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) closeAndCommit();
    };
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        setDraft('');
        setOpen(false);
      }
    };
    const closeOnBlur = () => closeAndCommit();
    window.addEventListener('pointerdown', closeOutside);
    window.addEventListener('keydown', closeOnEscape);
    window.addEventListener('blur', closeOnBlur);
    return () => {
      window.removeEventListener('pointerdown', closeOutside);
      window.removeEventListener('keydown', closeOnEscape);
      window.removeEventListener('blur', closeOnBlur);
    };
  }, [closeAndCommit, open]);

  const handleInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing) return;
    if (event.key === 'Enter' || event.key === ',' || event.key === '，') {
      event.preventDefault();
      if (!disabled) commitDraft();
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      setDraft('');
      setOpen(false);
    }
  };

  const visibleTags = tags.slice(0, renderedCount);
  const hiddenCount = tags.length - visibleTags.length;

  return (
    <div className="note-tags" ref={rootRef}>
      <button
        ref={barRef}
        className="tag-capsule-bar"
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={tags.length > 0 ? `管理 ${tags.length} 個標籤` : '新增標籤'}
        onClick={() => {
          if (open) closeAndCommit();
          else setOpen(true);
        }}
      >
        {visibleTags.map((tag) => (
          <span className="tag-capsule" key={tag}>#{tag}</span>
        ))}
        {hiddenCount > 0 && <span className="tag-capsule-count">+{hiddenCount}</span>}
        {tags.length === 0 && <span className="tag-capsule-empty"># 新增標籤</span>}
      </button>

      <div ref={measureRef} className="tag-measure" aria-hidden="true">
        {tags.map((tag) => (
          <span className="tag-capsule" data-measure-tag key={tag}>#{tag}</span>
        ))}
        {tags.length > 0 && (
          <span className="tag-capsule-count" data-measure-counter>+{tags.length}</span>
        )}
      </div>

      {open && (
        <div className="tag-editor-popover" role="dialog" aria-label="管理筆記標籤">
          <div className="tag-editor-title">筆記標籤</div>
          <div className="tag-editor-list">
            {tags.map((tag) => (
              <div className="tag-editor-item" key={tag}>
                <span className="tag-editor-name">#{tag}</span>
                <button
                  className="icon-button tag-editor-remove"
                  type="button"
                  aria-label={`移除標籤 ${tag}`}
                  title={`移除 #${tag}`}
                  disabled={disabled}
                  onClick={() => onChange(removeTagValue(tags, tag))}
                >
                  <UiIcon name="close" />
                </button>
              </div>
            ))}
          </div>
          <label className="tag-editor-new">
            <span aria-hidden="true">#</span>
            <input
              ref={inputRef}
              value={draft}
              placeholder="輸入新的標籤"
              disabled={disabled}
              autoFocus
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={handleInputKeyDown}
            />
          </label>
        </div>
      )}
    </div>
  );
}
