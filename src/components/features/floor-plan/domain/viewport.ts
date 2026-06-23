/**
 * Pure pan/zoom transform math for the floor map — no DOM — so the canvas viewport
 * (a single `translate(tx, ty) scale(scale)` on a wrapper) and the drag-handoff
 * inverse are unit-testable in isolation. `screenToContent` assumes the wrapper sits
 * at the viewport's top-left with `transform-origin: 0 0`; keep that in lockstep.
 */
export type ViewTransform = { scale: number; tx: number; ty: number };

export const MIN_SCALE = 0.4;
export const MAX_SCALE = 3;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export const clampScale = (scale: number) => clamp(scale, MIN_SCALE, MAX_SCALE);

/** Zoom by `factor`, keeping the viewport-local point (px, py) stationary on screen. */
export function zoomAtPoint(
  view: ViewTransform,
  factor: number,
  px: number,
  py: number,
): ViewTransform {
  const scale = clampScale(view.scale * factor);
  const k = scale / view.scale;
  return { scale, tx: px - (px - view.tx) * k, ty: py - (py - view.ty) * k };
}

/**
 * Inverse of the view transform: a screen (client) coordinate → the unscaled
 * content-box pixel it sits over. This is what the table drag handoff feeds to
 * `unprojectCenter`, so a drag stays pixel-accurate at any zoom/pan.
 */
export function screenToContent(
  view: ViewTransform,
  clientX: number,
  clientY: number,
  viewport: { left: number; top: number },
): { x: number; y: number } {
  return {
    x: (clientX - viewport.left - view.tx) / view.scale,
    y: (clientY - viewport.top - view.ty) / view.scale,
  };
}

/** Fit the content box inside the viewport and centre it (never upscales past 1:1). */
export function fitToViewport(
  contentW: number,
  contentH: number,
  viewportW: number,
  viewportH: number,
): ViewTransform {
  const scale = clampScale(Math.min(viewportW / contentW, viewportH / contentH, 1));
  return { scale, tx: (viewportW - contentW * scale) / 2, ty: (viewportH - contentH * scale) / 2 };
}

export type ContentFrame = { frameW: number; frameH: number; padX: number; padY: number };

/**
 * Expand a tight content bounding box so its aspect ratio matches the viewport,
 * centring the original content inside the frame. When this frame is passed to
 * `fitToViewport`, the map fills the viewport with equal inset around the tables.
 */
export function expandContentFrame(
  contentW: number,
  contentH: number,
  viewportW: number,
  viewportH: number,
): ContentFrame {
  if (viewportW <= 0 || viewportH <= 0 || contentW <= 0 || contentH <= 0) {
    return { frameW: contentW, frameH: contentH, padX: 0, padY: 0 };
  }
  const targetAR = viewportW / viewportH;
  const contentAR = contentW / contentH;
  let frameW: number;
  let frameH: number;
  if (contentAR > targetAR) {
    frameW = contentW;
    frameH = contentW / targetAR;
  } else {
    frameH = contentH;
    frameW = contentH * targetAR;
  }
  return { frameW, frameH, padX: (frameW - contentW) / 2, padY: (frameH - contentH) / 2 };
}
