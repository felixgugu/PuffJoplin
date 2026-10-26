export type SourcePreviewResizeHandle =
  | 'n'
  | 'ne'
  | 'e'
  | 'se'
  | 's'
  | 'sw'
  | 'w'
  | 'nw';

export interface SourcePreviewBounds {
  left: number;
  top: number;
  width: number;
  height: number;
}

export const SOURCE_PREVIEW_MIN_WIDTH = 360;
export const SOURCE_PREVIEW_MIN_HEIGHT = 280;
export const SOURCE_PREVIEW_WINDOW_MARGIN = 8;

export function resizeSourcePreviewBounds(
  start: SourcePreviewBounds,
  handle: SourcePreviewResizeHandle,
  deltaX: number,
  deltaY: number,
  viewportWidth: number,
  viewportHeight: number,
): SourcePreviewBounds {
  let { left, top, width, height } = start;
  if (handle.includes('e')) {
    width = Math.max(
      SOURCE_PREVIEW_MIN_WIDTH,
      Math.min(
        start.width + deltaX,
        viewportWidth - start.left - SOURCE_PREVIEW_WINDOW_MARGIN,
      ),
    );
  }
  if (handle.includes('w')) {
    const right = start.left + start.width;
    left = Math.max(
      SOURCE_PREVIEW_WINDOW_MARGIN,
      Math.min(
        start.left + deltaX,
        right - SOURCE_PREVIEW_MIN_WIDTH,
      ),
    );
    width = right - left;
  }
  if (handle.includes('s')) {
    height = Math.max(
      SOURCE_PREVIEW_MIN_HEIGHT,
      Math.min(
        start.height + deltaY,
        viewportHeight - start.top - SOURCE_PREVIEW_WINDOW_MARGIN,
      ),
    );
  }
  if (handle.includes('n')) {
    const bottom = start.top + start.height;
    top = Math.max(
      SOURCE_PREVIEW_WINDOW_MARGIN,
      Math.min(
        start.top + deltaY,
        bottom - SOURCE_PREVIEW_MIN_HEIGHT,
      ),
    );
    height = bottom - top;
  }
  return { left, top, width, height };
}
