const storedResourcePattern = /:\/([A-Za-z0-9]{32})(?![A-Za-z0-9])/g;
const localResourcePattern = /(?<![\w.:/-])\/resources\/([A-Za-z0-9]{32})(?![A-Za-z0-9/])/g;

export function toEditorMarkdown(markdown: string): string {
  return markdown.replace(storedResourcePattern, '/resources/$1');
}

export function toStoredMarkdown(markdown: string): string {
  return markdown.replace(localResourcePattern, ':/$1');
}
