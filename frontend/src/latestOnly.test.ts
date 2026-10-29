import { describe, expect, it } from 'vitest';
import { createLatestOnlyGuard } from './latestOnly';

describe('latest-only guard', () => {
  it('keeps only the most recent token valid', () => {
    const guard = createLatestOnlyGuard();
    const first = guard.begin();
    const second = guard.begin();

    expect(guard.isCurrent(first)).toBe(false);
    expect(guard.isCurrent(second)).toBe(true);
  });

  it('invalidates a pending request when a newer one begins', () => {
    const guard = createLatestOnlyGuard();
    const first = guard.begin();
    expect(guard.isCurrent(first)).toBe(true);

    guard.begin();
    expect(guard.isCurrent(first)).toBe(false);
  });

  it('treats unknown tokens as stale', () => {
    const guard = createLatestOnlyGuard();
    guard.begin();
    expect(guard.isCurrent(0)).toBe(false);
    expect(guard.isCurrent(99)).toBe(false);
  });
});
