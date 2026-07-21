export function responsivePageWidth(containerWidth: number, viewportWidth: number): number {
  const horizontalPadding = viewportWidth < 640 ? 16 : viewportWidth < 1024 ? 32 : 48;
  return Math.max(160, Math.min(840, Math.floor(containerWidth - horizontalPadding)));
}
