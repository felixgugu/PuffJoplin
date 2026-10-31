import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { EditorTabsState } from './editorTabs';
import UiIcon from './UiIcon';

interface EditorTabBarProps {
  tabs: EditorTabsState;
  directories?: Record<string, string>;
  onActivate: (id: string) => void;
  onTogglePin: (id: string) => void;
  onIntent?: (id: string) => void;
}

interface MenuPosition {
  left: number;
  top: number;
}

const MENU_WIDTH = 480;

export default function EditorTabBar({
  tabs,
  directories = {},
  onActivate,
  onTogglePin,
  onIntent,
}: EditorTabBarProps) {
  const allTabs = tabs.preview ? [...tabs.pinned, tabs.preview] : tabs.pinned;
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);
  const menuOpen = menuPosition !== null;

  const closeMenu = () => setMenuPosition(null);

  const openMenu = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setMenuPosition({
      left: Math.max(8, Math.min(rect.left, window.innerWidth - MENU_WIDTH - 8)),
      top: rect.bottom + 4,
    });
  };

  useEffect(() => {
    if (!menuOpen) return undefined;
    const closeOutside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      closeMenu();
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      closeMenu();
      triggerRef.current?.focus();
    };
    const closeOnViewportChange = () => closeMenu();
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
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const frame = window.requestAnimationFrame(() => {
      const target = menuRef.current?.querySelector<HTMLButtonElement>('[aria-current="true"]') ??
        menuRef.current?.querySelector<HTMLButtonElement>('button');
      target?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [menuOpen]);

  if (allTabs.length === 0) return null;

  return (
    <div className="editor-tabs-bar">
      <button
        ref={triggerRef}
        className={`icon-button editor-tabs-menu ${menuOpen ? 'active' : ''}`}
        type="button"
        aria-label="切換已開啟的筆記"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        title="切換已開啟的筆記"
        onClick={() => (menuOpen ? closeMenu() : openMenu())}
      >
        <UiIcon name="chevron-down" />
      </button>
      <div className="editor-tabs" role="tablist" aria-label="開啟的筆記">
        {allTabs.map((tab) => {
          const pinned = tabs.pinned.some((item) => item.id === tab.id);
          const active = tabs.activeID === tab.id;
          return (
            <div
              className={`editor-tab ${active ? 'active' : ''} ${pinned ? 'is-pinned' : 'is-preview'}`}
              key={tab.id}
            >
              <button
                className="editor-tab-main"
                type="button"
                role="tab"
                aria-selected={active}
                title={tab.title}
                onClick={() => onActivate(tab.id)}
                onPointerEnter={() => onIntent?.(tab.id)}
                onPointerDown={() => onIntent?.(tab.id)}
                onFocus={() => onIntent?.(tab.id)}
              >
                <span>{tab.title}</span>
              </button>
              <button
                className={`icon-button editor-tab-pin ${pinned ? 'active' : ''}`}
                type="button"
                aria-label={pinned ? `取消釘選 ${tab.title}` : `釘選 ${tab.title}`}
                title={pinned ? '取消釘選分頁' : '釘選分頁'}
                onClick={() => onTogglePin(tab.id)}
              >
                <UiIcon name="pin" filled={pinned} />
              </button>
            </div>
          );
        })}
      </div>
      {menuOpen && createPortal(
        <div
          ref={menuRef}
          className="editor-tabs-menu-popover"
          role="menu"
          aria-label="切換已開啟的筆記"
          style={{ left: menuPosition.left, top: menuPosition.top }}
          onPointerDown={(event) => event.stopPropagation()}
        >
          {allTabs.map((tab) => {
            const active = tabs.activeID === tab.id;
            const directory = directories[tab.id]?.trim() ?? '';
            const title = tab.title || '未命名筆記';
            return (
              <button
                key={tab.id}
                className={`editor-tabs-menu-item ${active ? 'active' : ''}`}
                type="button"
                role="menuitem"
                aria-current={active ? 'true' : undefined}
                title={directory ? `${directory} / ${title}` : title}
                onClick={() => {
                  onActivate(tab.id);
                  closeMenu();
                }}
              >
                {directory && (
                  <span className="editor-tabs-menu-directory">{directory} / </span>
                )}
                <span className="editor-tabs-menu-title">{title}</span>
              </button>
            );
          })}
        </div>,
        document.body,
      )}
    </div>
  );
}
