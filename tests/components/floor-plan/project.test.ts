import { describe, expect, it } from 'vitest';

import {
  computeProjectDims,
  joinHintLinks,
  projectCenter,
  projectLayout,
  toProjectInput,
  unprojectCenter,
} from '@/components/features/floor-plan/domain/project';

import { MAX_TABLE_H, SEED_ROW_GAP } from '@/components/features/floor-plan/domain/layout';
import type { LayoutBounds } from '@/components/features/floor-plan/domain/layout';

const bounds: LayoutBounds = { minX: 0, minY: 0, rangeX: 600, rangeY: 400 };

const input = (id: string, xp: number, yp: number) =>
  toProjectInput(
    { id, zoneId: 'z', zoneName: 'Z', category: 'dining', seatingType: 'standard', capacity: 4 },
    xp,
    yp,
  );

/**
 * The floor-map drag handoff persists a table's position by inverting the pixel
 * cursor back to bbox percent (FloorPlanCanvas → unprojectCenter → previewDrag →
 * percentToRaw). These tests guard that percent↔pixel inversion, since drag is a
 * preserved feature with no other coverage and the canvas rebinds this handoff.
 */
describe('project geometry', () => {
  it('projectCenter ↔ unprojectCenter round-trips percent (no clip offset)', () => {
    const dims = computeProjectDims(bounds);
    for (const [xp, yp] of [
      [0, 0],
      [50, 50],
      [100, 100],
      [25, 75],
      [80, 10],
    ]) {
      const { cx, cy } = projectCenter(xp, yp, dims);
      const back = unprojectCenter(cx, cy, dims, 0, 0);
      expect(back.xPercent).toBeCloseTo(xp, 4);
      expect(back.yPercent).toBeCloseTo(yp, 4);
    }
  });

  it('round-trips a projected table centre with the layout clip-offset applied', () => {
    const inputs = [
      toProjectInput(
        {
          id: 'A',
          zoneId: 'z',
          zoneName: 'Z',
          category: 'dining',
          seatingType: 'standard',
          capacity: 4,
        },
        20,
        30,
      ),
      toProjectInput(
        {
          id: 'B',
          zoneId: 'z',
          zoneName: 'Z',
          category: 'dining',
          seatingType: 'standard',
          capacity: 4,
        },
        80,
        70,
      ),
    ];
    const layout = projectLayout(inputs, [], bounds);
    const a = layout.tables.get('A');
    expect(a).toBeTruthy();
    const back = unprojectCenter(a!.cx, a!.cy, layout.dims, layout.offsetX, layout.offsetY);
    expect(back.xPercent).toBeCloseTo(20, 3);
    expect(back.yPercent).toBeCloseTo(30, 3);
  });

  it('clamps out-of-range cursor positions to 0–100 percent', () => {
    const dims = computeProjectDims(bounds);
    const below = unprojectCenter(-9999, -9999, dims, 0, 0);
    const above = unprojectCenter(9999, 9999, dims, 0, 0);
    expect(below.xPercent).toBe(0);
    expect(below.yPercent).toBe(0);
    expect(above.xPercent).toBe(100);
    expect(above.yPercent).toBe(100);
  });
});

describe('joinHintLinks', () => {
  it('links the selected table centre to each candidate, dropping self + unprojected ids', () => {
    const layout = projectLayout(
      [input('A', 20, 30), input('B', 80, 70), input('C', 50, 50)],
      [],
      bounds,
    );
    const links = joinHintLinks(layout.tables, 'A', ['B', 'C', 'A', 'ZZZ']);
    // self ('A') and the unprojected id ('ZZZ') are skipped.
    expect(links.map((l) => l.key)).toEqual(['hint-A-B', 'hint-A-C']);
    const a = layout.tables.get('A')!;
    const b = layout.tables.get('B')!;
    expect(links[0]).toMatchObject({ x1: a.cx, y1: a.cy, x2: b.cx, y2: b.cy });
  });

  it('returns nothing when the selected table is not projected', () => {
    const layout = projectLayout([input('A', 20, 30)], [], bounds);
    expect(joinHintLinks(layout.tables, 'missing', ['A'])).toEqual([]);
  });
});

describe('computeProjectDims (de-overlap sizing)', () => {
  it('grows the canvas so adjacent seeded rows never project closer than the tallest table', () => {
    // A tall seeded layout (rangeY≈1100 ≈ 24 tables) used to squash row pitch to ~34px;
    // now the drawable height grows with the range so the pitch clears the 82px private room.
    const dims = computeProjectDims({ minX: 0, minY: 0, rangeX: 600, rangeY: 1100 });
    const a = projectCenter(0, 0, dims);
    const b = projectCenter(0, (SEED_ROW_GAP / 1100) * 100, dims);
    expect(b.cy - a.cy).toBeGreaterThanOrEqual(MAX_TABLE_H);
  });

  it('keeps tiny venues compact via the drawable floor', () => {
    const dims = computeProjectDims({ minX: 0, minY: 0, rangeX: 1, rangeY: 1 });
    expect(dims.innerH).toBe(440); // 340 floor + 2 × padY(50)
  });
});
