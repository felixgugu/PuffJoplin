import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import UiIcon from './UiIcon';
import type { SearchField, SearchScope } from './types';

interface GlobalSearchProps {
  query: string;
  scope: SearchScope;
  field: SearchField;
  caseSensitive: boolean;
  wholeWord: boolean;
  hasCurrentNotebook: boolean;
  onQueryChange: (value: string) => void;
  onScopeChange: (value: SearchScope) => void;
  onFieldChange: (value: SearchField) => void;
  onCaseSensitiveChange: (value: boolean) => void;
  onWholeWordChange: (value: boolean) => void;
}

interface MenuPosition {
  left: number;
  top: number;
}

const MENU_WIDTH = 286;

export default function GlobalSearch({
  query,
  scope,
  field,
  caseSensitive,
  wholeWord,
  hasCurrentNotebook,
  onQueryChange,
  onScopeChange,
  onFieldChange,
  onCaseSensitiveChange,
  onWholeWordChange,
}: GlobalSearchProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);
  const optionsOpen = menuPosition !== null;
  const scopeLabel = scope === 'current' ? '目前目錄' : '全部';
  const fieldLabel = field === 'title' ? '只搜尋標題' : '標題＋內文';
  const placeholder = scope === 'current' ? '搜尋目前目錄…' : '搜尋全部筆記本…';
  const optionSummary = `搜尋選項：${scope === 'current' ? '目前目錄與子目錄' : '全部筆記本'} · ${fieldLabel}${caseSensitive ? ' · 區分大小寫' : ''}${wholeWord ? ' · 完整單詞' : ''}`;

  const closeOptions = () => setMenuPosition(null);

  useEffect(() => {
    if (!optionsOpen) return undefined;
    const closeOutside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      closeOptions();
    };
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      closeOptions();
      triggerRef.current?.focus();
    };
    const closeOnViewportChange = () => closeOptions();
    window.addEventListener('pointerdown', closeOutside);
    window.addEventListener('keydown', closeOnEscape);
    window.addEventListener('resize', closeOnViewportChange);
    document.addEventListener('scroll', closeOnViewportChange, true);
    return () => {
      window.removeEventListener('pointerdown', closeOutside);
      window.removeEventListener('keydown', closeOnEscape);
      window.removeEventListener('resize', closeOnViewportChange);
      document.removeEventListener('scroll', closeOnViewportChange, true);
    };
  }, [optionsOpen]);

  useEffect(() => {
    if (!optionsOpen) return undefined;
    const frame = window.requestAnimationFrame(() => {
      menuRef.current
        ?.querySelector<HTMLButtonElement>('[role="menuitemradio"][aria-checked="true"]')
        ?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [optionsOpen]);

  const openOptions = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - MENU_WIDTH - 8));
    setMenuPosition({ left, top: rect.bottom + 7 });
  };

  const chooseScope = (value: SearchScope) => {
    onScopeChange(value);
    closeOptions();
  };

  const chooseField = (value: SearchField) => {
    onFieldChange(value);
    closeOptions();
  };

  return (
    <div className="titlebar-search window-control">
      <UiIcon name="search" className="titlebar-search-icon" />
      <div className="search-options-picker">
        <button
          ref={triggerRef}
          className={`search-options-trigger ${optionsOpen ? 'active' : ''}`}
          type="button"
          aria-label={optionSummary}
          aria-haspopup="menu"
          aria-expanded={optionsOpen}
          title={optionSummary}
          onClick={() => optionsOpen ? closeOptions() : openOptions()}
        >
          <span>{scopeLabel}</span>
          <UiIcon name="chevron-down" />
        </button>
      </div>
      <input
        ref={inputRef}
        id="search-input"
        value={query}
        aria-label={`${optionSummary}；${placeholder}`}
        placeholder={placeholder}
        onChange={(event) => onQueryChange(event.target.value)}
      />
      <button
        className={`search-filter-toggle ${caseSensitive ? 'active' : ''}`}
        type="button"
        aria-label="區分大小寫"
        aria-pressed={caseSensitive}
        title="區分大小寫"
        onClick={() => onCaseSensitiveChange(!caseSensitive)}
      >
        Aa
      </button>
      <button
        className={`search-filter-toggle search-whole-word ${wholeWord ? 'active' : ''}`}
        type="button"
        aria-label="完整單詞"
        aria-pressed={wholeWord}
        title="完整單詞"
        onClick={() => onWholeWordChange(!wholeWord)}
      >
        ab
      </button>
      {query && (
        <button
          className="search-clear-button"
          type="button"
          aria-label="清除搜尋"
          title="清除搜尋"
          onClick={() => {
            onQueryChange('');
            window.requestAnimationFrame(() => inputRef.current?.focus());
          }}
        >
          <UiIcon name="close" />
        </button>
      )}
      {optionsOpen && createPortal(
        <div
          ref={menuRef}
          className="search-options-menu"
          role="menu"
          aria-label="全域搜尋選項"
          style={{ left: menuPosition.left, top: menuPosition.top }}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <div className="search-options-section" role="group" aria-label="筆記本範圍">
            <div className="search-options-heading">筆記本範圍</div>
            <button
              className={scope === 'all' ? 'active' : ''}
              type="button"
              role="menuitemradio"
              aria-checked={scope === 'all'}
              onClick={() => chooseScope('all')}
            >
              <span className="search-option-check" aria-hidden="true">{scope === 'all' ? '✓' : ''}</span>
              <span>
                <strong>全部筆記本</strong>
                <small>搜尋所有未刪除的筆記</small>
              </span>
            </button>
            <button
              className={scope === 'current' ? 'active' : ''}
              type="button"
              role="menuitemradio"
              aria-checked={scope === 'current'}
              disabled={!hasCurrentNotebook}
              onClick={() => chooseScope('current')}
            >
              <span className="search-option-check" aria-hidden="true">{scope === 'current' ? '✓' : ''}</span>
              <span>
                <strong>目前目錄與子目錄</strong>
                <small>{hasCurrentNotebook ? '限制在目前筆記本及其子目錄' : '目前沒有可搜尋的筆記本'}</small>
              </span>
            </button>
          </div>
          <div className="search-options-divider" />
          <div className="search-options-section" role="group" aria-label="搜尋欄位">
            <div className="search-options-heading">搜尋欄位</div>
            <button
              className={field === 'all' ? 'active' : ''}
              type="button"
              role="menuitemradio"
              aria-checked={field === 'all'}
              onClick={() => chooseField('all')}
            >
              <span className="search-option-check" aria-hidden="true">{field === 'all' ? '✓' : ''}</span>
              <span>
                <strong>標題＋內文</strong>
                <small>在筆記標題與 Markdown 內容中搜尋</small>
              </span>
            </button>
            <button
              className={field === 'title' ? 'active' : ''}
              type="button"
              role="menuitemradio"
              aria-checked={field === 'title'}
              onClick={() => chooseField('title')}
            >
              <span className="search-option-check" aria-hidden="true">{field === 'title' ? '✓' : ''}</span>
              <span>
                <strong>只搜尋標題</strong>
                <small>忽略筆記內文，結果更精準</small>
              </span>
            </button>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
