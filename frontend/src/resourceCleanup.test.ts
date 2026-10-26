import { describe, expect, it } from 'vitest';
import { formatResourceBytes, resourceCleanupMessage } from './resourceCleanup';

describe('resource cleanup formatting', () => {
  it('formats byte sizes with stable binary units', () => {
    expect(formatResourceBytes(0)).toBe('0 B');
    expect(formatResourceBytes(1023)).toBe('1023 B');
    expect(formatResourceBytes(1024)).toBe('1 KB');
    expect(formatResourceBytes(1536)).toBe('1.5 KB');
    expect(formatResourceBytes(5 * 1024 * 1024)).toBe('5 MB');
    expect(formatResourceBytes(-10)).toBe('0 B');
  });

  it('summarizes removed, recent, and failed resources', () => {
    expect(resourceCleanupMessage({
      removedCount: 3,
      removedIndexed: 2,
      removedOrphans: 1,
      freedBytes: 1536,
      failedCount: 1,
      skippedRecent: 2,
    })).toBe(
      '已清理 3 個資源，釋放 1.5 KB。另有 2 個近期資源已保留。有 1 個項目無法刪除。',
    );
    expect(resourceCleanupMessage({
      removedCount: 0,
      removedIndexed: 0,
      removedOrphans: 0,
      freedBytes: 0,
      failedCount: 0,
      skippedRecent: 1,
    })).toBe('沒有可清理的資源。另有 1 個近期資源已保留。');
  });
});
