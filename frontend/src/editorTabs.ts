export const EDITOR_TABS_KEY = 'puffjoplin.editorTabs.v1';

export interface EditorTab {
  id: string;
  title: string;
}

export interface EditorTabsState {
  pinned: EditorTab[];
  preview: EditorTab | null;
  activeID: string;
}

export const EMPTY_EDITOR_TABS: EditorTabsState = {
  pinned: [],
  preview: null,
  activeID: '',
};

function tabTitle(tab: EditorTab): EditorTab {
  return { id: tab.id, title: tab.title.trim() || '未命名筆記' };
}

export function normalizeEditorTabs(state: EditorTabsState): EditorTabsState {
  const seen = new Set<string>();
  const pinned: EditorTab[] = [];
  for (const tab of state.pinned) {
    if (!tab.id || seen.has(tab.id)) continue;
    seen.add(tab.id);
    pinned.push(tabTitle(tab));
  }
  let preview = state.preview && state.preview.id && !seen.has(state.preview.id)
    ? tabTitle(state.preview)
    : null;
  const activeExists = pinned.some((tab) => tab.id === state.activeID) ||
    preview?.id === state.activeID;
  const activeID = activeExists
    ? state.activeID
    : preview?.id || pinned[0]?.id || '';
  return { pinned, preview, activeID };
}

export function openEditorNote(state: EditorTabsState, tab: EditorTab): EditorTabsState {
  const normalizedTab = tabTitle(tab);
  const pinnedIndex = state.pinned.findIndex((item) => item.id === tab.id);
  if (pinnedIndex >= 0) {
    const pinned = state.pinned.map((item, index) => index === pinnedIndex ? normalizedTab : item);
    return normalizeEditorTabs({ ...state, pinned, activeID: tab.id });
  }
  return normalizeEditorTabs({ ...state, preview: normalizedTab, activeID: tab.id });
}

export function activateEditorTab(state: EditorTabsState, id: string): EditorTabsState {
  return normalizeEditorTabs({ ...state, activeID: id });
}

export function toggleEditorTabPin(state: EditorTabsState, id: string): EditorTabsState {
  const pinnedIndex = state.pinned.findIndex((tab) => tab.id === id);
  if (pinnedIndex >= 0) {
    const pinned = state.pinned.filter((tab) => tab.id !== id);
    return normalizeEditorTabs({
      pinned,
      preview: state.pinned[pinnedIndex],
      activeID: state.activeID === id ? id : state.activeID,
    });
  }
  if (state.preview?.id !== id) return state;
  return normalizeEditorTabs({
    pinned: [...state.pinned, state.preview],
    preview: null,
    activeID: state.activeID,
  });
}

export function closeEditorTab(state: EditorTabsState, id: string): EditorTabsState {
  const index = state.pinned.findIndex((tab) => tab.id === id);
  if (index < 0) return state;
  const pinned = state.pinned.filter((tab) => tab.id !== id);
  let activeID = state.activeID;
  if (activeID === id) {
    activeID = pinned[index]?.id || pinned[index - 1]?.id || state.preview?.id || '';
  }
  return normalizeEditorTabs({ pinned, preview: state.preview, activeID });
}

export function removeNoteFromEditorTabs(state: EditorTabsState, id: string): EditorTabsState {
  const pinned = state.pinned.filter((tab) => tab.id !== id);
  const preview = state.preview?.id === id ? null : state.preview;
  return normalizeEditorTabs({
    pinned,
    preview,
    activeID: state.activeID === id ? '' : state.activeID,
  });
}

export function updateEditorTabTitle(state: EditorTabsState, id: string, title: string): EditorTabsState {
  let changed = false;
  const pinned = state.pinned.map((tab) => {
    if (tab.id !== id || tab.title === title) return tab;
    changed = true;
    return { ...tab, title };
  });
  const preview = state.preview?.id === id && state.preview.title !== title
    ? (changed = true, { ...state.preview, title })
    : state.preview;
  return changed ? { pinned, preview, activeID: state.activeID } : state;
}

export function loadEditorTabs(raw: string | null): EditorTabsState {
  if (!raw) return EMPTY_EDITOR_TABS;
  try {
    const parsed = JSON.parse(raw) as Partial<EditorTabsState>;
    return normalizeEditorTabs({
      pinned: Array.isArray(parsed.pinned) ? parsed.pinned : [],
      preview: parsed.preview && typeof parsed.preview === 'object' ? parsed.preview : null,
      activeID: typeof parsed.activeID === 'string' ? parsed.activeID : '',
    });
  } catch {
    return EMPTY_EDITOR_TABS;
  }
}
