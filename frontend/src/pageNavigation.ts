export const pageScrollOverlap = 48;
export const minimumPageScroll = 160;

export interface ScrollMetrics {
  scrollTop: number;
  clientHeight: number;
  scrollHeight: number;
}

export function pageScrollDistance(clientHeight: number): number {
  return Math.max(minimumPageScroll, Math.round(clientHeight - pageScrollOverlap));
}

export function pageScrollState(metrics: ScrollMetrics): {
  canPrevious: boolean;
  canNext: boolean;
} {
  const maximum = Math.max(0, metrics.scrollHeight - metrics.clientHeight);
  return {
    canPrevious: maximum > 0 && metrics.scrollTop > 1,
    canNext: maximum > 0 && metrics.scrollTop < maximum - 1,
  };
}
