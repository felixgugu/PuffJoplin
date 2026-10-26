import type { ResourceCleanupReport } from './types';

const byteUnits = ['B', 'KB', 'MB', 'GB', 'TB'] as const;

export function formatResourceBytes(value: number): string {
  const bytes = Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
  if (bytes < 1024) return `${bytes} B`;
  let scaled = bytes;
  let unitIndex = 0;
  while (scaled >= 1024 && unitIndex < byteUnits.length - 1) {
    scaled /= 1024;
    unitIndex++;
  }
  return `${new Intl.NumberFormat('zh-TW', {
    maximumFractionDigits: 1,
  }).format(scaled)} ${byteUnits[unitIndex]}`;
}

export function resourceCleanupMessage(report: ResourceCleanupReport): string {
  const parts = report.removedCount > 0
    ? [`已清理 ${report.removedCount} 個資源，釋放 ${formatResourceBytes(report.freedBytes)}。`]
    : ['沒有可清理的資源。'];
  if (report.skippedRecent > 0) {
    parts.push(`另有 ${report.skippedRecent} 個近期資源已保留。`);
  }
  if (report.failedCount > 0) {
    parts.push(`有 ${report.failedCount} 個項目無法刪除。`);
  }
  return parts.join('');
}
