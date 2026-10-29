import { describe, expect, it } from 'vitest';
import { noteDirectoryLabel } from './noteListLabel';

describe('note list directory labels', () => {
  it('labels notes that come from a subdirectory', () => {
    expect(noteDirectoryLabel({ notebookTitle: 'Child' }, true)).toBe('Child');
    expect(noteDirectoryLabel({ notebookTitle: '  Child  ' }, true)).toBe('Child');
  });

  it('leaves notes from the current notebook unlabelled', () => {
    expect(noteDirectoryLabel({ notebookTitle: 'Parent' }, false)).toBe('');
  });

  it('ignores blank notebook titles', () => {
    expect(noteDirectoryLabel({ notebookTitle: '  ' }, true)).toBe('');
  });
});
