import { describe, expect, it } from 'vitest';
import { placeSidebarActionMenu } from './floatingMenu';

describe('sidebar floating menu placement', () => {
  it('moves a right-aligned menu back inside a narrow sidebar', () => {
    expect(placeSidebarActionMenu({
      triggerRight: 217,
      triggerBottom: 136,
      sidebarLeft: 22,
      sidebarRight: 282,
      preferredWidth: 224,
      viewportWidth: 1280,
    })).toEqual({
      left: 30,
      top: 142,
      width: 224,
    });
  });

  it('shrinks below the sidebar inner width on a narrow layout', () => {
    expect(placeSidebarActionMenu({
      triggerRight: 172,
      triggerBottom: 90,
      sidebarLeft: 8,
      sidebarRight: 218,
      preferredWidth: 224,
      viewportWidth: 900,
    })).toEqual({
      left: 16,
      top: 96,
      width: 194,
    });
  });
});
