import { describe, expect, it } from 'vitest';
import {
  addManagedExclusionName,
  emptyManagedDirectoryExclusions,
  managedDirectoryExclusionMessage,
  managedDirectoryExclusionsEqual,
  removeManagedExclusionName,
} from './managedDirectoryExclusions';

describe('managed directory exclusions', () => {
  it('adds exact case-sensitive names and rejects paths', () => {
    let value = emptyManagedDirectoryExclusions();
    const lower = addManagedExclusionName(value, 'markdown', 'draft.md');
    expect(lower.error).toBe('');
    value = lower.exclusions;
    const upper = addManagedExclusionName(value, 'markdown', 'Draft.md');
    expect(upper.error).toBe('');
    expect(upper.exclusions.markdownFileNames).toEqual(['Draft.md', 'draft.md']);

    expect(addManagedExclusionName(value, 'folder', 'nested/archive').error).not.toBe('');
    expect(addManagedExclusionName(value, 'markdown', 'draft').error).not.toBe('');
    expect(addManagedExclusionName(value, 'markdown', 'draft.md').error).not.toBe('');
  });

  it('removes one exact entry without affecting other case variants', () => {
    const value = {
      folderNames: ['archive', 'Archive'],
      markdownFileNames: [],
    };
    const next = removeManagedExclusionName(value, 'folder', 'archive');
    expect(next.folderNames).toEqual(['Archive']);
    expect(managedDirectoryExclusionsEqual(next, value)).toBe(false);
  });

  it('formats hidden, restored, and warning counts', () => {
    const message = managedDirectoryExclusionMessage({
      exclusions: emptyManagedDirectoryExclusions(),
      rootCount: 2,
      hiddenNotebooks: 1,
      hiddenNotes: 3,
      restoredNotebooks: 0,
      restoredNotes: 1,
      hiddenNoteIds: [],
      warnings: [{ item: 'Vault', message: 'warning' }],
    });
    expect(message).toContain('已套用到 2 個直接管理筆記本');
    expect(message).toContain('隱藏 3 篇筆記、1 個資料夾');
    expect(message).toContain('恢復 1 篇筆記');
    expect(message).toContain('1 個根目錄');
  });
});
