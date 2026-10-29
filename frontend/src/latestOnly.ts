export interface LatestOnlyGuard {
  begin: () => number;
  isCurrent: (token: number) => boolean;
}

/**
 * Guards async UI work against out-of-order completion: every new request
 * invalidates the ones that started before it, so only the latest can apply
 * its result. Used when switching notes while large files are still loading.
 */
export function createLatestOnlyGuard(): LatestOnlyGuard {
  let current = 0;
  return {
    begin: () => {
      current += 1;
      return current;
    },
    isCurrent: (token: number) => token === current,
  };
}
