/**
 * Touch hit-target sizing for the floor map.
 *
 * Table tiles render at a fixed content-pixel size and are then visually shrunk by the
 * canvas zoom transform (`scale`). At mobile fit scale a 46px high-top can paint at ~18px —
 * below the 44px touch floor — and the global button-min rule does NOT survive a CSS
 * transform. So on coarse pointers we grow each tile's *hit area* (an unscaled, transparent
 * expander inside the button) until its on-screen size clears 44px, without touching the
 * visible geometry. These pure helpers compute that padding and are unit-tested in isolation.
 */

/** WCAG 2.5.5 / platform touch-target floor, in CSS pixels. */
export const MIN_TOUCH_PX = 44;

/**
 * Content-space padding (per side) to add around a tile of `tileSizePx` so that, after the
 * canvas multiplies it by `scale`, the hit box is at least `minTouchPx` on screen. Returns 0
 * when the scaled tile already clears the floor (or for degenerate input).
 */
export function touchHitPadding(
  tileSizePx: number,
  scale: number,
  minTouchPx: number = MIN_TOUCH_PX,
): number {
  if (!(scale > 0) || !(tileSizePx >= 0)) return 0;
  const targetContentPx = minTouchPx / scale; // content px that scales to exactly minTouchPx
  return Math.max(0, (targetContentPx - tileSizePx) / 2);
}

export type TouchHitBox = {
  /** Per-side content-space padding to apply to the expander (left/right). */
  padX: number;
  /** Per-side content-space padding to apply to the expander (top/bottom). */
  padY: number;
  /** Resulting on-screen hit-box width/height in CSS px (≥ minTouchPx where geometry allows). */
  screenW: number;
  screenH: number;
};

/** On-screen touch hit box for a tile after padding — the proof surface for the ≥44px guarantee. */
export function touchHitBox(
  tile: { w: number; h: number },
  scale: number,
  minTouchPx: number = MIN_TOUCH_PX,
): TouchHitBox {
  const padX = touchHitPadding(tile.w, scale, minTouchPx);
  const padY = touchHitPadding(tile.h, scale, minTouchPx);
  const safeScale = scale > 0 ? scale : 1;
  return {
    padX,
    padY,
    screenW: (tile.w + 2 * padX) * safeScale,
    screenH: (tile.h + 2 * padY) * safeScale,
  };
}
