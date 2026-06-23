import { describe, expect, it } from 'vitest';

import {
  MAX_SCALE,
  MIN_SCALE,
  clampScale,
  expandContentFrame,
  fitToViewport,
  screenToContent,
  zoomAtPoint,
} from '@/components/features/floor-plan/domain/viewport';

describe('clampScale', () => {
  it('bounds scale to [MIN_SCALE, MAX_SCALE]', () => {
    expect(clampScale(0.01)).toBe(MIN_SCALE);
    expect(clampScale(99)).toBe(MAX_SCALE);
    expect(clampScale(1)).toBe(1);
  });
});

describe('screenToContent', () => {
  it('inverts a forward transform exactly (the drag-accuracy guarantee)', () => {
    const view = { scale: 2, tx: 30, ty: 10 };
    const cx = 120;
    const cy = 80;
    // Forward: screen = viewport.left + tx + scale × content.
    const clientX = 5 + view.tx + view.scale * cx;
    const clientY = 7 + view.ty + view.scale * cy;
    const out = screenToContent(view, clientX, clientY, { left: 5, top: 7 });
    expect(out.x).toBeCloseTo(cx, 6);
    expect(out.y).toBeCloseTo(cy, 6);
  });

  it('reduces to the un-zoomed offset at the identity transform', () => {
    const out = screenToContent({ scale: 1, tx: 0, ty: 0 }, 200, 140, { left: 12, top: 8 });
    expect(out).toEqual({ x: 188, y: 132 });
  });
});

describe('zoomAtPoint', () => {
  it('keeps the content point under the cursor stationary', () => {
    const view = { scale: 1, tx: 0, ty: 0 };
    const cursor = { x: 200, y: 140 };
    const before = screenToContent(view, cursor.x, cursor.y, { left: 0, top: 0 });
    const zoomed = zoomAtPoint(view, 1.5, cursor.x, cursor.y);
    const after = screenToContent(zoomed, cursor.x, cursor.y, { left: 0, top: 0 });
    expect(after.x).toBeCloseTo(before.x, 6);
    expect(after.y).toBeCloseTo(before.y, 6);
  });

  it('clamps scale at the bounds', () => {
    expect(zoomAtPoint({ scale: MAX_SCALE, tx: 0, ty: 0 }, 2, 0, 0).scale).toBe(MAX_SCALE);
    expect(zoomAtPoint({ scale: MIN_SCALE, tx: 0, ty: 0 }, 0.1, 0, 0).scale).toBe(MIN_SCALE);
  });
});

describe('fitToViewport', () => {
  it('never upscales past 1 and centres the content', () => {
    const v = fitToViewport(200, 100, 1000, 1000);
    expect(v.scale).toBe(1);
    expect(v.tx).toBe((1000 - 200) / 2);
    expect(v.ty).toBe((1000 - 100) / 2);
  });

  it('scales down to fit a content box larger than the viewport', () => {
    const v = fitToViewport(2000, 1000, 1000, 1000);
    expect(v.scale).toBeCloseTo(0.5, 6);
  });
});

describe('expandContentFrame', () => {
  it('expands height when content is wider than the viewport aspect ratio', () => {
    const frame = expandContentFrame(400, 200, 300, 600);
    expect(frame.frameW).toBe(400);
    expect(frame.frameH).toBeCloseTo(800, 6);
    expect(frame.padX).toBe(0);
    expect(frame.padY).toBeCloseTo(300, 6);
  });

  it('expands width when content is taller than the viewport aspect ratio', () => {
    const frame = expandContentFrame(492, 1047, 339, 597);
    expect(frame.frameH).toBe(1047);
    expect(frame.frameW / frame.frameH).toBeCloseTo(339 / 597, 6);
    expect(frame.padX).toBeGreaterThan(0);
    expect(frame.padY).toBe(0);
  });

  it('fills the viewport edge-to-edge when the expanded frame is fitted', () => {
    const viewportW = 339;
    const viewportH = 597;
    const frame = expandContentFrame(492, 1047, viewportW, viewportH);
    const v = fitToViewport(frame.frameW, frame.frameH, viewportW, viewportH);
    expect(v.tx).toBeCloseTo(0, 6);
    expect(v.ty).toBeCloseTo(0, 6);
    expect(frame.frameW * v.scale).toBeCloseTo(viewportW, 4);
    expect(frame.frameH * v.scale).toBeCloseTo(viewportH, 4);
  });
});
