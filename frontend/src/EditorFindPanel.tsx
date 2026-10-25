import type { KeyboardEventHandler, RefObject } from 'react';
import UiIcon from './UiIcon';

interface EditorFindPanelProps {
  query: string;
  replacement: string;
  matchCase: boolean;
  wholeWord: boolean;
  matchCount: number;
  activeIndex: number;
  queryInputRef: RefObject<HTMLInputElement | null>;
  replaceInputRef: RefObject<HTMLInputElement | null>;
  onQueryChange: (value: string) => void;
  onReplacementChange: (value: string) => void;
  onMatchCaseChange: (value: boolean) => void;
  onWholeWordChange: (value: boolean) => void;
  onPrevious: () => void;
  onNext: () => void;
  onReplace: () => void;
  onReplaceAll: () => void;
  onClose: () => void;
}

export default function EditorFindPanel({
  query,
  replacement,
  matchCase,
  wholeWord,
  matchCount,
  activeIndex,
  queryInputRef,
  replaceInputRef,
  onQueryChange,
  onReplacementChange,
  onMatchCaseChange,
  onWholeWordChange,
  onPrevious,
  onNext,
  onReplace,
  onReplaceAll,
  onClose,
}: EditorFindPanelProps) {
  const handleQueryKeyDown: KeyboardEventHandler<HTMLInputElement> = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      if (event.shiftKey) onPrevious();
      else onNext();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
    }
  };
  const handleReplacementKeyDown: KeyboardEventHandler<HTMLInputElement> = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      if (event.ctrlKey || event.metaKey) onReplaceAll();
      else onReplace();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
    }
  };
  const status = `${matchCount === 0 ? 0 : activeIndex + 1}/${matchCount}`;

  return (
    <section className="editor-find-panel" role="search" aria-label="筆記內搜尋與取代">
      <div className="editor-find-row">
        <label className="editor-find-field">
          <UiIcon name="search" />
          <input
            ref={queryInputRef}
            value={query}
            placeholder="搜尋目前筆記"
            aria-label="搜尋目前筆記"
            onChange={(event) => onQueryChange(event.target.value)}
            onKeyDown={handleQueryKeyDown}
          />
        </label>
        <span className="editor-find-count" aria-live="polite">{status}</span>
        <button
          type="button"
          className={`editor-find-toggle ${matchCase ? 'active' : ''}`}
          aria-pressed={matchCase}
          title="大小寫敏感"
          onClick={() => onMatchCaseChange(!matchCase)}
        >
          Aa
        </button>
        <button
          type="button"
          className={`editor-find-toggle whole-word ${wholeWord ? 'active' : ''}`}
          aria-pressed={wholeWord}
          title="全字匹配"
          onClick={() => onWholeWordChange(!wholeWord)}
        >
          ab
        </button>
        <button
          type="button"
          className="editor-find-icon-button"
          title="上一個"
          aria-label="上一個結果"
          disabled={matchCount === 0}
          onClick={onPrevious}
        >
          <UiIcon name="chevron-up" />
        </button>
        <button
          type="button"
          className="editor-find-icon-button"
          title="下一個"
          aria-label="下一個結果"
          disabled={matchCount === 0}
          onClick={onNext}
        >
          <UiIcon name="chevron-down" />
        </button>
        <button
          type="button"
          className="editor-find-icon-button close"
          title="關閉"
          aria-label="關閉搜尋與取代"
          onClick={onClose}
        >
          <UiIcon name="close" />
        </button>
      </div>
      <div className="editor-find-row replace-row">
        <label className="editor-find-field replacement">
          <input
            ref={replaceInputRef}
            value={replacement}
            placeholder="取代為"
            aria-label="取代文字"
            onChange={(event) => onReplacementChange(event.target.value)}
            onKeyDown={handleReplacementKeyDown}
          />
        </label>
        <button
          type="button"
          className="editor-find-text-button"
          disabled={matchCount === 0}
          onClick={onReplace}
        >
          取代
        </button>
        <button
          type="button"
          className="editor-find-text-button"
          disabled={matchCount === 0}
          onClick={onReplaceAll}
        >
          全部取代
        </button>
      </div>
    </section>
  );
}
