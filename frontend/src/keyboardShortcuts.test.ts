import { describe, expect, it } from 'vitest';
import { KEYBOARD_SHORTCUT_GROUPS } from './keyboardShortcuts';

describe('keyboard shortcut reference', () => {
  it('groups every shortcut with a unique identifier and non-empty content', () => {
    const ids = KEYBOARD_SHORTCUT_GROUPS.map((group) => group.id);
    expect(new Set(ids).size).toBe(ids.length);

    for (const group of KEYBOARD_SHORTCUT_GROUPS) {
      expect(group.title.trim()).not.toBe('');
      expect(group.description.trim()).not.toBe('');
      expect(group.shortcuts.length).toBeGreaterThan(0);
      for (const shortcut of group.shortcuts) {
        expect(shortcut.keys.length).toBeGreaterThan(0);
        expect(shortcut.keys.every((key) => key.trim() !== '')).toBe(true);
        expect(shortcut.action.trim()).not.toBe('');
      }
    }
  });

  it('includes PuffJoplin and editor-specific shortcut groups', () => {
    expect(KEYBOARD_SHORTCUT_GROUPS.map((group) => group.id)).toEqual([
      'application',
      'note-search',
      'markdown-formatting',
      'editor-navigation',
      'source-editor',
      'text-editing',
    ]);
  });
});
