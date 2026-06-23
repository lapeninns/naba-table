import { describe, expect, it } from 'vitest';

import {
  buildLayout,
  countPositioned,
  normalizePositions,
  readRawPosition,
  tableGeom,
} from '@/components/features/floor-plan/domain/layout';
import type { FloorPlanTable, RawPosition } from '@/components/features/floor-plan/domain/types';

function makeTable(overrides: Partial<FloorPlanTable> = {}): FloorPlanTable {
  return {
    id: 't1',
    restaurantId: 'r1',
    tableNumber: '1',
    capacity: 4,
    minPartySize: 1,
    maxPartySize: null,
    section: null,
    category: 'dining',
    seatingType: 'standard',
    mobility: 'movable',
    zoneId: 'z1',
    zoneName: 'Main Dining',
    zoneActive: true,
    active: true,
    status: 'available' as FloorPlanTable['status'],
    position: null,
    notes: null,
    segments: [],
    ...overrides,
  };
}

describe('readRawPosition', () => {
  it('reads a valid {x,y,rotation} record', () => {
    expect(readRawPosition({ x: 10, y: 20, rotation: 15 })).toEqual({ x: 10, y: 20, rotation: 15 });
  });
  it('defaults rotation to 0', () => {
    expect(readRawPosition({ x: 10, y: 20 })).toEqual({ x: 10, y: 20, rotation: 0 });
  });
  it('rejects null / non-numeric coordinates', () => {
    expect(readRawPosition(null)).toBeNull();
    expect(readRawPosition({ x: 'a', y: 20 } as unknown as Record<string, unknown>)).toBeNull();
    expect(readRawPosition({ y: 20 })).toBeNull();
  });
});

describe('normalizePositions', () => {
  it('maps the bounding-box corners to 0% and 100%', () => {
    const raw = new Map<string, RawPosition>([
      ['a', { x: 100, y: 50, rotation: 0 }],
      ['b', { x: 300, y: 250, rotation: 0 }],
    ]);
    const out = normalizePositions(raw);
    expect(out.get('a')).toEqual({ xPercent: 0, yPercent: 0, rotation: 0 });
    expect(out.get('b')).toEqual({ xPercent: 100, yPercent: 100, rotation: 0 });
  });

  it('clamps a degenerate (single-point) range without dividing by zero', () => {
    const raw = new Map<string, RawPosition>([['a', { x: 5, y: 5, rotation: 0 }]]);
    expect(normalizePositions(raw).get('a')).toEqual({ xPercent: 0, yPercent: 0, rotation: 0 });
  });
});

describe('buildLayout', () => {
  it('uses stored positions, without seeding, when every table is placed', () => {
    const tables = [
      makeTable({ id: 'a', position: { x: 0, y: 0 } }),
      makeTable({ id: 'b', position: { x: 100, y: 100 } }),
    ];
    const layout = buildLayout(tables);
    expect(layout.seeded).toBe(false);
    expect(layout.positions.size).toBe(2);
  });

  it('seeds a grid when no tables are placed yet', () => {
    const tables = [makeTable({ id: 'a' }), makeTable({ id: 'b' }), makeTable({ id: 'c' })];
    const layout = buildLayout(tables);
    expect(layout.seeded).toBe(true);
    expect(layout.positions.size).toBe(3);
  });

  it('merges stored positions with seeded ones so the whole inventory renders', () => {
    // The real-world bug: two tables saved → the rest must NOT vanish.
    const tables = [
      makeTable({ id: 'a', position: { x: 300, y: 200 } }),
      makeTable({ id: 'b', position: { x: 500, y: 400 } }),
      makeTable({ id: 'c', position: null }),
      makeTable({ id: 'd', position: null }),
    ];
    const layout = buildLayout(tables);
    // Every table reaches the canvas, not just the two placed ones.
    expect(layout.positions.size).toBe(4);
    expect(['a', 'b', 'c', 'd'].every((id) => layout.raw.has(id))).toBe(true);
    // Placed tables keep their exact stored coordinates…
    expect(layout.raw.get('a')).toEqual({ x: 300, y: 200, rotation: 0 });
    expect(layout.raw.get('b')).toEqual({ x: 500, y: 400, rotation: 0 });
    // …while the unplaced ones get a grid fallback, so the layout is flagged seeded.
    expect(layout.seeded).toBe(true);
  });

  it('keeps a seeded fallback slot stable as neighbours get placed', () => {
    // Seeding the full set (not just unplaced tables) means c's grid slot is the
    // same whether or not b has been placed — no re-packing on each save.
    const base = [
      makeTable({ id: 'a', position: { x: 300, y: 200 } }),
      makeTable({ id: 'b', position: null }),
      makeTable({ id: 'c', position: null }),
    ];
    const before = buildLayout(base);
    const after = buildLayout([
      base[0],
      makeTable({ id: 'b', position: { x: 500, y: 400 } }),
      base[2],
    ]);
    expect(after.raw.get('c')).toEqual(before.raw.get('c'));
  });

  it('applies drag overrides on top of the base coordinates', () => {
    const tables = [
      makeTable({ id: 'a', position: { x: 0, y: 0 } }),
      makeTable({ id: 'b', position: { x: 100, y: 100 } }),
    ];
    const overrides = new Map<string, RawPosition>([['a', { x: 100, y: 100, rotation: 0 }]]);
    const layout = buildLayout(tables, overrides);
    // 'a' now shares 'b' coordinates → both at the same normalised corner.
    expect(layout.raw.get('a')).toEqual({ x: 100, y: 100, rotation: 0 });
  });
});

describe('countPositioned', () => {
  it('counts only tables with a real stored position', () => {
    expect(
      countPositioned([
        makeTable({ id: 'a', position: { x: 1, y: 2 } }),
        makeTable({ id: 'b', position: null }),
      ]),
    ).toBe(1);
  });
});

describe('tableGeom', () => {
  it('renders high-tops as round', () => {
    expect(tableGeom({ category: 'bar', seatingType: 'high_top', capacity: 2 }).round).toBe(true);
  });
  it('renders private rooms large', () => {
    expect(tableGeom({ category: 'private', seatingType: 'standard', capacity: 10 }).w).toBe(110);
  });
  it('renders booths wider as capacity grows', () => {
    expect(tableGeom({ category: 'dining', seatingType: 'booth', capacity: 4 }).w).toBe(74);
    expect(tableGeom({ category: 'dining', seatingType: 'booth', capacity: 6 }).w).toBe(92);
  });
  it('grows standard tables with capacity', () => {
    expect(tableGeom({ category: 'dining', seatingType: 'standard', capacity: 2 }).w).toBe(52);
    expect(tableGeom({ category: 'dining', seatingType: 'standard', capacity: 4 }).w).toBe(62);
    expect(tableGeom({ category: 'dining', seatingType: 'standard', capacity: 8 }).w).toBe(80);
  });
});
