export interface NoteDirectorySource {
  notebookTitle: string;
}

export function noteDirectoryLabel(
  note: NoteDirectorySource,
  isSubdirectoryNote: boolean,
): string {
  if (!isSubdirectoryNote) return '';
  return note.notebookTitle.trim();
}
