import { describe, expect, it } from 'vitest';
import {
  clampPreviewSplitRatio,
  defaultPreviewSplitRatio,
  previewSplitRatioAt,
  scrollbarGeometry,
  scrollTopFromThumbTop,
} from './editorViewport';

describe('editor viewport helpers', () => {
  it('clamps preview split ratios and preserves minimum pane width', () => {
    expect(clampPreviewSplitRatio(0.1, 1000)).toBe(0.25);
    expect(clampPreviewSplitRatio(0.9, 1000)).toBe(0.75);
    expect(clampPreviewSplitRatio(0.5, 400)).toBe(defaultPreviewSplitRatio);
    expect(previewSplitRatioAt(250, 100, 1000)).toBe(0.75);
  });

  it('enforces a minimum scrollbar thumb length', () => {
    const geometry = scrollbarGeometry(0, 10000, 600, 500);
    expect(geometry.thumbHeight).toBe(52);
    expect(geometry.thumbTop).toBe(0);
    expect(geometry.maximumThumbTop).toBe(448);
  });

  it('maps thumb and scroll positions at both ends', () => {
    const top = scrollbarGeometry(0, 2000, 500, 400);
    const bottom = scrollbarGeometry(1500, 2000, 500, 400);
    expect(top.thumbTop).toBe(0);
    expect(bottom.thumbTop).toBe(bottom.maximumThumbTop);
    expect(scrollTopFromThumbTop(bottom.thumbTop, bottom.thumbHeight, 2000, 500, 400))
      .toBe(1500);
  });
});
