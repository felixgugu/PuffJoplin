import type { EditorTabsState } from './editorTabs';
import UiIcon from './UiIcon';

interface EditorTabBarProps {
  tabs: EditorTabsState;
  onActivate: (id: string) => void;
  onTogglePin: (id: string) => void;
  onClose: (id: string) => void;
  onIntent?: (id: string) => void;
}

export default function EditorTabBar({
  tabs,
  onActivate,
  onTogglePin,
  onClose,
  onIntent,
}: EditorTabBarProps) {
  const allTabs = tabs.preview ? [...tabs.pinned, tabs.preview] : tabs.pinned;
  if (allTabs.length === 0) return null;
  return (
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
            {pinned && (
              <button
                className="icon-button editor-tab-close"
                type="button"
                aria-label={`關閉 ${tab.title}`}
                title="關閉分頁"
                onClick={() => onClose(tab.id)}
              >
                <UiIcon name="close" />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
