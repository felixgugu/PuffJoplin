import { describe, expect, it } from 'vitest';
import { pageScrollDistance, pageScrollState } from './pageNavigation';

describe('editor page navigation', () => {
  it('keeps a contextual overlap when moving one page', () => {
    expect(pageScrollDistance(900)).toBe(852);
    expect(pageScrollDistance(100)).toBe(160);
  });

  it('reports top and bottom button availability', () => {
    expect(pageScrollState({ scrollTop: 0, clientHeight: 500, scrollHeight: 1800 }))
      .toEqual({ canPrevious: false, canNext: true });
    expect(pageScrollState({ scrollTop: 700, clientHeight: 500, scrollHeight: 1200 }))
      .toEqual({ canPrevious: true, canNext: false });
    expect(pageScrollState({ scrollTop: 40, clientHeight: 500, scrollHeight: 1800 }))
      .toEqual({ canPrevious: true, canNext: true });
  });

  it('disables navigation in both directions when content does not scroll', () => {
    expect(pageScrollState({ scrollTop: 0, clientHeight: 500, scrollHeight: 500 }))
      .toEqual({ canPrevious: false, canNext: false });
  });
});
