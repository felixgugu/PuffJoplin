import {
  Fragment,
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
import type { NoteSummary } from './types';
import UiIcon from './UiIcon';

export interface TagNotesResult {
  items: NoteSummary[];
  total: number;
}

interface NoteTagsProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  onLoadTagNotes?: (tag: string) => Promise<TagNotesResult>;
  onOpenNote?: (noteId: string) => void;
}

interface TagNotesState {
  tag: string;
  loading: boolean;
  failed: boolean;
  items: NoteSummary[];
  total: number;
}

export default function NoteTags({
  tags,
  onChange,
  onLoadTagNotes,
  onOpenNote,
}: NoteTagsProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const barRef = useRef<HTMLDivElement | null>(null);
  const measureRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const notesRequestRef = useRef(0);
  const [open, setOpen] = useState(false);
  const [selectedTag, setSelectedTag] = useState('');
  const [tagNotes, setTagNotes] = useState<TagNotesState | null>(null);
  const [draft, setDraft] = useState('');
  const [renderedCount, setRenderedCount] = useState(tags.length);
  const tagKey = tags.join('\u0000');

  const measure = useCallback(() => {
    const bar = barRef.current;
    const measureRow = measureRef.current;
    if (!bar || !measureRow || bar.clientWidth === 0) return;
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
    if (draft.trim()) commitDraft();
    else setDraft('');
    setOpen(false);
    setSelectedTag('');
  }, [commitDraft, draft]);

  const openMenu = useCallback((tag = '') => {
    setOpen(true);
    setSelectedTag(tag);
  }, []);

  const activateTag = useCallback((tag: string) => {
    if (open && selectedTag === tag) {
      closeAndCommit();
      return;
    }
    openMenu(tag);
  }, [closeAndCommit, open, openMenu, selectedTag]);

  const loadTagNotes = useCallback(async (tag: string) => {
    if (!onLoadTagNotes || !tag) return;
    const requestID = ++notesRequestRef.current;
    setTagNotes({ tag, loading: true, failed: false, items: [], total: 0 });
    try {
      const result = await onLoadTagNotes(tag);
      if (requestID !== notesRequestRef.current) return;
      setTagNotes({
        tag,
        loading: false,
        failed: false,
        items: result.items,
        total: result.total,
      });
    } catch {
      if (requestID !== notesRequestRef.current) return;
      setTagNotes({ tag, loading: false, failed: true, items: [], total: 0 });
    }
  }, [onLoadTagNotes]);

  useEffect(() => {
    if (!open || !selectedTag) {
      notesRequestRef.current += 1;
      setTagNotes(null);
      return;
    }
    void loadTagNotes(selectedTag);
  }, [loadTagNotes, open, selectedTag, tagKey]);

  useEffect(() => {
    if (!open) return undefined;
    const closeOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) closeAndCommit();
    };
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        setDraft('');
        setOpen(false);
        setSelectedTag('');
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

  const removeTag = (tag: string) => {
    if (selectedTag === tag) setSelectedTag('');
    onChange(removeTagValue(tags, tag));
  };

  const openTagNote = (noteID: string) => {
    closeAndCommit();
    onOpenNote?.(noteID);
  };

  const handleInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing) return;
    if (event.key === 'Enter' || event.key === ',' || event.key === '，') {
      event.preventDefault();
      commitDraft();
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      setDraft('');
      setOpen(false);
      setSelectedTag('');
    }
  };

  const visibleTags = tags.slice(0, renderedCount);
  const hiddenCount = tags.length - visibleTags.length;
  const selectedNotes = selectedTag && tagNotes?.tag === selectedTag ? tagNotes : null;

  return (
    <div className="note-tags" ref={rootRef}>
      <div ref={barRef} className="tag-capsule-bar">
        {visibleTags.map((tag) => (
          <button
            className={`tag-capsule ${open && selectedTag === tag ? 'is-active' : ''}`}
            type="button"
            key={tag}
            aria-haspopup="dialog"
            aria-expanded={open && selectedTag === tag}
            onClick={() => activateTag(tag)}
          >
            #{tag}
          </button>
        ))}
        {hiddenCount > 0 && (
          <button
            className="tag-capsule-count"
            type="button"
            aria-haspopup="dialog"
            aria-expanded={open && selectedTag === ''}
            aria-label={`還有 ${hiddenCount} 個標籤`}
            onClick={() => openMenu()}
          >
            +{hiddenCount}
          </button>
        )}
        {tags.length === 0 && (
          <button
            className="tag-capsule-empty"
            type="button"
            aria-haspopup="dialog"
            aria-expanded={open}
            onClick={() => openMenu()}
          >
            # 新增標籤
          </button>
        )}
      </div>

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
            {tags.map((tag) => {
              const selected = selectedTag === tag;
              return (
                <Fragment key={tag}>
                  <div className={`tag-editor-item ${selected ? 'is-selected' : ''}`}>
                    <button
                      className="tag-editor-select"
                      type="button"
                      aria-pressed={selected}
                      onClick={() => activateTag(tag)}
                    >
                      <span className="tag-editor-name">#{tag}</span>
                    </button>
                    <button
                      className="icon-button tag-editor-remove"
                      type="button"
                      aria-label={`移除標籤 ${tag}`}
                      title={`移除 #${tag}`}
                      onClick={() => removeTag(tag)}
                    >
                      <UiIcon name="close" />
                    </button>
                  </div>
                  {selected && (
                    <div className="tag-editor-notes">
                      {selectedNotes?.loading && (
                        <p className="tag-editor-note-status">搜尋這個標籤的筆記…</p>
                      )}
                      {selectedNotes?.failed && (
                        <p className="tag-editor-note-status">無法載入這個標籤的筆記</p>
                      )}
                      {selectedNotes && !selectedNotes.loading && !selectedNotes.failed &&
                        selectedNotes.items.length === 0 && (
                          <p className="tag-editor-note-status">沒有其他筆記使用這個標籤</p>
                        )}
                      {selectedNotes && !selectedNotes.loading &&
                        selectedNotes.items.map((note) => (
                          <button
                            className="tag-editor-note"
                            type="button"
                            key={note.id}
                            title={`${note.title || '未命名筆記'} · ${note.notebookTitle}`}
                            onClick={() => openTagNote(note.id)}
                          >
                            <span className="tag-editor-note-title">
                              {note.title || '未命名筆記'}
                            </span>
                            <span className="tag-editor-note-meta">{note.notebookTitle}</span>
                          </button>
                        ))}
                      {selectedNotes && !selectedNotes.loading &&
                        selectedNotes.total > selectedNotes.items.length && (
                          <p className="tag-editor-note-status">
                            共 {selectedNotes.total} 篇，僅顯示前 {selectedNotes.items.length} 篇
                          </p>
                        )}
                    </div>
                  )}
                </Fragment>
              );
            })}
          </div>
          <label className="tag-editor-new">
            <span aria-hidden="true">#</span>
            <input
              ref={inputRef}
              value={draft}
              placeholder="輸入新的標籤"
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
