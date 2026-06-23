import { describe, expect, it } from 'vitest';

import {
  MIN_TOUCH_PX,
  touchHitBox,
  touchHitPadding,
} from '@/components/features/floor-plan/domain/touchTargets';

describe('touchHitPadding', () => {
  it('adds no padding when the scaled tile already clears the 44px floor', () => {
    expect(touchHitPadding(46, 1)).toBe(0); // 46px ≥ 44
    expect(touchHitPadding(110, 0.5)).toBe(0); // 55px ≥ 44
  });

  it('pads a transform-shrunk tile up to the 44px floor on screen', () => {
    const scale = 0.4;
    const pad = touchHitPadding(46, scale); // need 44/0.4 = 110 content → (110-46)/2 = 32
    expect(pad).toBeCloseTo(32, 6);
    expect((46 + 2 * pad) * scale).toBeCloseTo(MIN_TOUCH_PX, 6);
  });

  it('returns 0 once the tile clears the floor on screen, and never goes negative', () => {
    expect(touchHitPadding(200, 1)).toBe(0); // 200px on screen, well over 44
    expect(touchHitPadding(0, 0)).toBe(0); // degenerate scale
    expect(touchHitPadding(-5, 1)).toBe(0); // degenerate size
    // A large content tile can still be tiny on screen at deep zoom-out → it DOES need padding.
    expect(touchHitPadding(200, 0.1)).toBeGreaterThan(0);
  });
});

describe('touchHitBox', () => {
  it('produces an on-screen hit box of at least 44px for tiny fit-scaled tiles', () => {
    const box = touchHitBox({ w: 46, h: 46 }, 0.4);
    expect(box.screenW).toBeGreaterThanOrEqual(MIN_TOUCH_PX - 1e-6);
    expect(box.screenH).toBeGreaterThanOrEqual(MIN_TOUCH_PX - 1e-6);
    expect(box.padX).toBeGreaterThan(0);
  });

  it('leaves already-large tiles unpadded (no distortion of the visible geometry)', () => {
    const box = touchHitBox({ w: 110, h: 82 }, 1);
    expect(box.padX).toBe(0);
    expect(box.padY).toBe(0);
    expect(box.screenW).toBe(110);
    expect(box.screenH).toBe(82);
  });

  it('covers every audited tile geometry at the mobile fit floor (scale 0.4)', () => {
    const geoms = [
      { w: 46, h: 46 }, // high-top
      { w: 52, h: 52 }, // 2-top
      { w: 62, h: 58 }, // 4-top
      { w: 74, h: 54 }, // booth
      { w: 110, h: 82 }, // private room
    ];
    for (const g of geoms) {
      const box = touchHitBox(g, 0.4);
      expect(box.screenW).toBeGreaterThanOrEqual(MIN_TOUCH_PX - 1e-6);
      expect(box.screenH).toBeGreaterThanOrEqual(MIN_TOUCH_PX - 1e-6);
    }
  });
});
