import type {
  ManagedDirectoryExclusionReport,
  ManagedDirectoryExclusions,
} from './types';

export type ManagedExclusionKind = 'folder' | 'markdown';

export function emptyManagedDirectoryExclusions(): ManagedDirectoryExclusions {
  return { folderNames: [], markdownFileNames: [] };
}

export function addManagedExclusionName(
  value: ManagedDirectoryExclusions,
  kind: ManagedExclusionKind,
  rawName: string,
): { exclusions: ManagedDirectoryExclusions; error: string } {
  const name = rawName.trim();
  if (!name) return { exclusions: value, error: '請輸入名稱。' };
  if (name === '.' || name === '..' || /[\\/]/.test(name)) {
    return { exclusions: value, error: '只輸入名稱，不可包含路徑分隔符號。' };
  }
  if (/[\u0000-\u001f\u007f]/.test(name)) {
    return { exclusions: value, error: '名稱包含不支援的控制字元。' };
  }
  if (Array.from(name).length > 255) {
    return { exclusions: value, error: '名稱不可超過 255 個字元。' };
  }
  if (kind === 'markdown' && !name.endsWith('.md')) {
    return { exclusions: value, error: 'Markdown 檔名必須以 .md 結尾。' };
  }
  const field = kind === 'folder' ? 'folderNames' : 'markdownFileNames';
  if (value[field].length >= 500) {
    return { exclusions: value, error: '每種排除清單最多可有 500 個名稱。' };
  }
  if (value[field].includes(name)) {
    return { exclusions: value, error: '清單中已有完全相同且大小寫一致的名稱。' };
  }
  return {
    exclusions: {
      ...value,
      [field]: [...value[field], name].sort(),
    },
    error: '',
  };
}

export function removeManagedExclusionName(
  value: ManagedDirectoryExclusions,
  kind: ManagedExclusionKind,
  name: string,
): ManagedDirectoryExclusions {
  const field = kind === 'folder' ? 'folderNames' : 'markdownFileNames';
  return {
    ...value,
    [field]: value[field].filter((item) => item !== name),
  };
}

export function managedDirectoryExclusionsEqual(
  left: ManagedDirectoryExclusions,
  right: ManagedDirectoryExclusions,
): boolean {
  return left.folderNames.length === right.folderNames.length &&
    left.markdownFileNames.length === right.markdownFileNames.length &&
    left.folderNames.every((name, index) => name === right.folderNames[index]) &&
    left.markdownFileNames.every((name, index) => name === right.markdownFileNames[index]);
}

export function managedDirectoryExclusionMessage(
  report: ManagedDirectoryExclusionReport,
): string {
  const applied = `已套用到 ${report.rootCount} 個直接管理筆記本。`;
  const changes = report.hiddenNotes || report.hiddenNotebooks ||
    report.restoredNotes || report.restoredNotebooks
    ? `本次隱藏 ${report.hiddenNotes} 篇筆記、${report.hiddenNotebooks} 個資料夾；` +
      `恢復 ${report.restoredNotes} 篇筆記、${report.restoredNotebooks} 個資料夾。`
    : '目前沒有索引項目受到影響。';
  const warnings = report.warnings.length > 0
    ? ` ${report.warnings.length} 個根目錄重新整理時發生警告，詳情已寫入記錄。`
    : '';
  return `${applied}${changes}${warnings}`;
}
