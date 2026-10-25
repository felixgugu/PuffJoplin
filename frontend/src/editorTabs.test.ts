import { describe, expect, it } from 'vitest';
import {
  DEFAULT_EDITOR_MODE,
  EMPTY_EDITOR_TABS,
  activateEditorTab,
  closeEditorTab,
  editorModeForTab,
  loadEditorTabs,
  openEditorNote,
  removeNoteFromEditorTabs,
  toggleEditorTabPin,
  updateEditorTabMode,
  updateEditorTabPreviewMode,
  type EditorTabsState,
} from './editorTabs';

const tab = (id: string, title = id) => ({ id, title });

describe('editor tabs', () => {
  it('defaults new tabs to source mode without replacing saved modes', () => {
    expect(DEFAULT_EDITOR_MODE).toBe('sv');
    expect(editorModeForTab(tab('one'))).toBe('sv');
    expect(editorModeForTab({ ...tab('one'), mode: 'ir' })).toBe('ir');
    expect(editorModeForTab({ ...tab('one'), mode: 'wysiwyg' })).toBe('wysiwyg');
  });

  it('uses one preview tab and activates existing pinned tabs', () => {
    let state = openEditorNote(EMPTY_EDITOR_TABS, tab('one'));
    state = openEditorNote(state, tab('two'));
    expect(state.preview?.id).toBe('two');
    expect(state.activeID).toBe('two');

    state = toggleEditorTabPin(state, 'one');
    expect(state.pinned).toEqual([]);
    state = toggleEditorTabPin(state, 'two');
    state = openEditorNote(state, tab('one'));
    expect(state.preview?.id).toBe('one');
    expect(state.activeID).toBe('one');
    expect(state.pinned[0].id).toBe('two');
  });

  it('pins and unpins through the single preview tab', () => {
    let state = openEditorNote(EMPTY_EDITOR_TABS, tab('one'));
    state = toggleEditorTabPin(state, 'one');
    expect(state.pinned.map((item) => item.id)).toEqual(['one']);
    expect(state.preview).toBeNull();

    state = toggleEditorTabPin(state, 'one');
    expect(state.pinned).toEqual([]);
    expect(state.preview?.id).toBe('one');
  });

  it('closes pinned tabs and restores a valid active tab', () => {
    let state: EditorTabsState = { pinned: [tab('one'), tab('two')], preview: tab('three'), activeID: 'two' };
    state = closeEditorTab(state, 'two');
    expect(state.activeID).toBe('one');
    state = closeEditorTab(state, 'one');
    expect(state.activeID).toBe('three');
  });

  it('removes all traces of a deleted note', () => {
    const state = removeNoteFromEditorTabs({
      pinned: [tab('one')],
      preview: tab('two'),
      activeID: 'two',
    }, 'two');
    expect(state.preview).toBeNull();
    expect(state.activeID).toBe('one');
  });

  it('recovers safely from invalid persisted state', () => {
    expect(loadEditorTabs('not json')).toEqual(EMPTY_EDITOR_TABS);
    const state = loadEditorTabs(JSON.stringify({
      pinned: [tab('one'), tab('one')],
      preview: tab('one'),
      activeID: 'missing',
    }));
    expect(state.pinned).toEqual([tab('one')]);
    expect(state.preview).toBeNull();
    expect(state.activeID).toBe('one');
  });

  it('keeps each tab last editor mode when switching or reopening it', () => {
    let state = openEditorNote(EMPTY_EDITOR_TABS, tab('one'));
    state = updateEditorTabMode(state, 'one', 'sv');
    expect(state.preview?.mode).toBe('sv');

    state = openEditorNote(state, tab('one'));
    expect(state.preview?.mode).toBe('sv');
    state = toggleEditorTabPin(state, 'one');
    state = openEditorNote(state, tab('two'));
    state = activateEditorTab(state, 'one');
    expect(state.pinned[0].mode).toBe('sv');
  });

  it('keeps each tab preview mode through tab changes', () => {
    let state = openEditorNote(EMPTY_EDITOR_TABS, tab('one'));
    state = updateEditorTabPreviewMode(state, 'one', 'both');
    state = toggleEditorTabPin(state, 'one');
    state = openEditorNote(state, tab('two'));
    state = activateEditorTab(state, 'one');
    expect(state.pinned[0].previewMode).toBe('both');
    state = updateEditorTabPreviewMode(state, 'one', 'editor');
    expect(state.pinned[0].previewMode).toBe('editor');
  });
});
