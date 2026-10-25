export const defaultPreviewSplitRatio = 0.5;
export const minimumPreviewPane = 240;
export const minimumScrollbarThumb = 52;

export function clampPreviewSplitRatio(ratio: number, width: number): number {
  if (!Number.isFinite(ratio) || width <= 0) return defaultPreviewSplitRatio;
  if (width <= minimumPreviewPane * 2) return defaultPreviewSplitRatio;
  const minimum = Math.max(0.25, minimumPreviewPane / width);
  return Math.max(minimum, Math.min(1 - minimum, ratio));
}

export function previewSplitRatioAt(clientX: number, left: number, width: number): number {
  if (width <= 0) return defaultPreviewSplitRatio;
  const editorRatio = clampPreviewSplitRatio((clientX - left) / width, width);
  return 1 - editorRatio;
}

export interface ScrollbarGeometry {
  thumbHeight: number;
  thumbTop: number;
  maximumScrollTop: number;
  maximumThumbTop: number;
}

export function scrollbarGeometry(
  scrollTop: number,
  scrollHeight: number,
  clientHeight: number,
  trackHeight: number,
): ScrollbarGeometry {
  if (clientHeight <= 0 || trackHeight <= 0 || scrollHeight <= clientHeight) {
    return {
      thumbHeight: trackHeight,
      thumbTop: 0,
      maximumScrollTop: 0,
      maximumThumbTop: 0,
    };
  }
  const thumbHeight = Math.min(
    trackHeight,
    Math.max(minimumScrollbarThumb, trackHeight * clientHeight / scrollHeight),
  );
  const maximumScrollTop = scrollHeight - clientHeight;
  const maximumThumbTop = Math.max(0, trackHeight - thumbHeight);
  const clampedScrollTop = Math.max(0, Math.min(maximumScrollTop, scrollTop));
  return {
    thumbHeight,
    thumbTop: maximumScrollTop > 0
      ? clampedScrollTop / maximumScrollTop * maximumThumbTop
      : 0,
    maximumScrollTop,
    maximumThumbTop,
  };
}

export function scrollTopFromThumbTop(
  thumbTop: number,
  thumbHeight: number,
  scrollHeight: number,
  clientHeight: number,
  trackHeight: number,
): number {
  const maximumScrollTop = Math.max(0, scrollHeight - clientHeight);
  const maximumThumbTop = Math.max(0, trackHeight - thumbHeight);
  if (maximumScrollTop === 0 || maximumThumbTop === 0) return 0;
  return Math.max(0, Math.min(1, thumbTop / maximumThumbTop)) * maximumScrollTop;
}
