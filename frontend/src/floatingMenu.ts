export interface SidebarMenuPlacementInput {
  triggerRight: number;
  triggerBottom: number;
  sidebarLeft: number;
  sidebarRight: number;
  preferredWidth: number;
  viewportWidth: number;
}

export interface FloatingMenuPosition {
  left: number;
  top: number;
  width: number;
}

export function placeSidebarActionMenu({
  triggerRight,
  triggerBottom,
  sidebarLeft,
  sidebarRight,
  preferredWidth,
  viewportWidth,
}: SidebarMenuPlacementInput): FloatingMenuPosition {
  const viewportPadding = 8;
  const menuGap = 6;
  const minimumWidth = 180;
  const availableSidebarWidth = Math.max(minimumWidth, sidebarRight - sidebarLeft - 16);
  const width = Math.min(preferredWidth, availableSidebarWidth, viewportWidth - 16);
  const rightLimit = Math.min(sidebarRight - viewportPadding, viewportWidth - viewportPadding);
  const leftLimit = Math.max(viewportPadding, sidebarLeft + viewportPadding);
  const preferredLeft = triggerRight - width;
  const left = Math.max(
    leftLimit,
    Math.min(rightLimit - width, preferredLeft),
  );

  return {
    left: Math.max(viewportPadding, left),
    top: triggerBottom + menuGap,
    width,
  };
}
