import { describe, expect, it } from 'vitest';
import {
  resizeSourcePreviewBounds,
  SOURCE_PREVIEW_MIN_HEIGHT,
  SOURCE_PREVIEW_MIN_WIDTH,
} from './sourcePreviewGeometry';

const start = {
  left: 100,
  top: 80,
  width: 600,
  height: 450,
};

describe('source preview resize geometry', () => {
  it('expands from the southeast within the viewport', () => {
    expect(resizeSourcePreviewBounds(start, 'se', 120, 80, 1200, 900)).toEqual({
      left: 100,
      top: 80,
      width: 720,
      height: 530,
    });
  });

  it('keeps the opposite edge fixed when resizing from the northwest', () => {
    const resized = resizeSourcePreviewBounds(start, 'nw', 150, 100, 1200, 900);

    expect(resized.left).toBe(250);
    expect(resized.top).toBe(180);
    expect(resized.left + resized.width).toBe(start.left + start.width);
    expect(resized.top + resized.height).toBe(start.top + start.height);
  });

  it('enforces minimum size and viewport limits', () => {
    expect(resizeSourcePreviewBounds(start, 'se', -1000, -1000, 1200, 900)).toEqual({
      left: 100,
      top: 80,
      width: SOURCE_PREVIEW_MIN_WIDTH,
      height: SOURCE_PREVIEW_MIN_HEIGHT,
    });
    expect(resizeSourcePreviewBounds(start, 'se', 1000, 1000, 900, 700)).toEqual({
      left: 100,
      top: 80,
      width: 792,
      height: 612,
    });
  });
});
