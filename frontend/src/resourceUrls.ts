const storedResourcePattern = /:\/([A-Za-z0-9]{32})(?![A-Za-z0-9])/g;
const localResourcePattern = /(?<![\w.:/-])\/resources\/([A-Za-z0-9]{32})(?![A-Za-z0-9/])/g;
const markdownDestinationPattern = /(!?\[[^\]]*\]\(\s*)(<)?([^)>\n]+?)(>)?(\s*(?:["'][^"']*["'])?\s*\))/g;

export interface EditableResource {
  id: string;
  storageKind?: 'database' | 'directory';
  storagePath?: string;
}

function normalizeManagedPath(path: string): string {
  let decoded = path;
  try {
    decoded = decodeURIComponent(path);
  } catch {
    // Keep the original path when it contains malformed percent encoding.
  }
  const segments: string[] = [];
  for (const segment of decoded.replaceAll('\\', '/').split('/')) {
    if (!segment || segment === '.') continue;
    if (segment === '..') {
      segments.pop();
      continue;
    }
    segments.push(segment);
  }
  return segments.join('/').toLocaleLowerCase();
}

function formatManagedPath(path: string): string {
  return path
    .replaceAll('\\', '/')
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

function externalPathLookup(resources: EditableResource[]): Map<string, string> {
  const items = new Map<string, string>();
  for (const resource of resources) {
    if (resource.storageKind !== 'directory' || !resource.storagePath) continue;
    items.set(normalizeManagedPath(resource.storagePath), resource.id);
  }
  return items;
}

function mapMarkdownDestinations(
  markdown: string,
  mapper: (destination: string) => string,
): string {
  return markdown.replace(
    markdownDestinationPattern,
    (_match, prefix: string, open: string, destination: string, close: string, suffix: string) =>
      `${prefix}${open || ''}${mapper(destination)}${close || ''}${suffix}`,
  );
}

export function toEditorMarkdown(markdown: string, resources: EditableResource[] = []): string {
  const external = externalPathLookup(resources);
  return mapMarkdownDestinations(
    markdown.replace(storedResourcePattern, '/resources/$1'),
    (destination) => {
      const path = normalizeManagedPath(destination);
      return external.get(path) ? `/resources/${external.get(path)}` : destination;
    },
  );
}

export function toStoredMarkdown(
  markdown: string,
  resources: EditableResource[] = [],
  storageKind: 'database' | 'directory' = 'database',
): string {
  const external = new Map(
    resources
      .filter((resource) => resource.storageKind === 'directory' && resource.storagePath)
      .map((resource) => [resource.id, formatManagedPath(resource.storagePath as string)]),
  );
  return markdown.replace(localResourcePattern, (_match, id: string) => {
    if (storageKind === 'directory') {
      return external.get(id) || `/resources/${id}`;
    }
    return `:/${id}`;
  });
}
