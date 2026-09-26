import { describe, expect, it } from 'vitest';

import {
  CANVAS_PAD,
  ZONE_HEADER,
  clampToZone,
  isStoredPositionUsable,
  layoutFloorPlan,
  rotatedSize,
} from '@/components/features/floor-plan/model/floorPlanLayout';
import {
  dirtyTableIds,
  layoutDraftReducer,
} from '@/components/features/floor-plan/model/layoutDraft';

import { snapshot, table } from './floorPlanFixtures';

describe('layoutFloorPlan', () => {
  it('packs zones by sort order and keeps every table inside its zone without overlaps', () => {
    const snap = snapshot();
    const layout = layoutFloorPlan(snap.zones, snap.tables);
    expect(layout.zones.map((z) => z.id)).toEqual(['main', 'snug']);
    expect(layout.zones[0]).toMatchObject({ x: CANVAS_PAD, y: CANVAS_PAD });

    const boxes = snap.tables.map((t) => {
      const placed = layout.tables.get(t.id)!;
      const zone = layout.zoneById.get(t.zoneId)!;
      const size = rotatedSize(t, placed.rotation);
      const box = {
        x1: placed.x - size.w / 2,
        y1: placed.y - size.h / 2,
        x2: placed.x + size.w / 2,
        y2: placed.y + size.h / 2,
      };
      expect(box.x1).toBeGreaterThanOrEqual(zone.x);
      expect(box.x2).toBeLessThanOrEqual(zone.x + zone.w);
      expect(box.y1).toBeGreaterThanOrEqual(zone.y + ZONE_HEADER);
      expect(box.y2).toBeLessThanOrEqual(zone.y + zone.h);
      expect(placed.auto).toBe(true);
      return box;
    });
    for (let i = 0; i < boxes.length; i += 1) {
      for (let j = i + 1; j < boxes.length; j += 1) {
        const a = boxes[i]!;
        const b = boxes[j]!;
        const overlap = a.x1 < b.x2 && b.x1 < a.x2 && a.y1 < b.y2 && b.y1 < a.y2;
        expect(overlap).toBe(false);
      }
    }
  });

  it('uses saved zone-relative positions and ignores legacy out-of-range ones', () => {
    const tables = [
      table('A', 'main', 2, { savedPosition: { x: 400, y: 300, rotation: 90 } }),
      table('B', 'main', 2, { savedPosition: { x: 99_999, y: -40, rotation: 0 } }),
    ];
    const layout = layoutFloorPlan(
      [{ id: 'main', name: 'Main', sortOrder: 0, active: true }],
      tables,
    );
    const zone = layout.zoneById.get('main')!;
    expect(layout.tables.get('A')).toMatchObject({
      x: zone.x + 400,
      y: zone.y + 300,
      rotation: 90,
      auto: false,
    });
    expect(layout.tables.get('B')?.auto).toBe(true);
    expect(zone.w).toBeGreaterThanOrEqual(400 + rotatedSize(tables[0]!, 90).w / 2);
  });

  it('applies drafts without resizing zones, clamped inside the zone', () => {
    const snap = snapshot();
    const base = layoutFloorPlan(snap.zones, snap.tables);
    const drafted = layoutFloorPlan(snap.zones, snap.tables, {
      T1: { x: 10_000, y: 10_000, rotation: 15 },
    });
    expect(drafted.zones).toEqual(base.zones);
    const zone = drafted.zoneById.get('main')!;
    const t1 = drafted.tables.get('T1')!;
    expect(t1.auto).toBe(false);
    expect(t1.x).toBeLessThanOrEqual(zone.x + zone.w);
    expect(t1.y).toBeLessThanOrEqual(zone.y + zone.h);
  });

  it('validates stored positions', () => {
    expect(isStoredPositionUsable({ x: 100, y: 100, rotation: 0 })).toBe(true);
    expect(isStoredPositionUsable({ x: 100, y: 10, rotation: 0 })).toBe(false);
    expect(isStoredPositionUsable({ x: Number.NaN, y: 100, rotation: 0 })).toBe(false);
    expect(isStoredPositionUsable(null)).toBe(false);
  });

  it('clamps below the zone header and normalises rotation', () => {
    const t = table('A', 'main', 2);
    expect(clampToZone(t, { x: -50, y: 0, rotation: -360 }, { w: 400, h: 300 })).toEqual({
      x: 66,
      y: ZONE_HEADER + 40,
      rotation: 0,
    });
  });
});

describe('layout drafts', () => {
  it('tracks only positions that differ from what is stored', () => {
    const saved = table('A', 'main', 2, { savedPosition: { x: 200, y: 200, rotation: 0 } });
    const auto = table('B', 'main', 2);
    const zone = { w: 600, h: 400 };
    let drafts = layoutDraftReducer(
      {},
      { type: 'place', table: saved, position: { x: 200, y: 200, rotation: 0 }, zone },
    );
    drafts = layoutDraftReducer(drafts, {
      type: 'place',
      table: auto,
      position: { x: 300, y: 200, rotation: 0 },
      zone,
    });
    expect(dirtyTableIds(drafts, [saved, auto])).toEqual(['B']);

    drafts = layoutDraftReducer(drafts, {
      type: 'place',
      table: saved,
      position: { x: 240, y: 200, rotation: 0 },
      zone,
    });
    expect(dirtyTableIds(drafts, [saved, auto]).sort()).toEqual(['A', 'B']);

    drafts = layoutDraftReducer(drafts, { type: 'keep-only', tableIds: ['B'] });
    expect(Object.keys(drafts)).toEqual(['B']);
    expect(layoutDraftReducer(drafts, { type: 'discard' })).toEqual({});
  });

  it('composes rapid nudges and rotations from the latest draft', () => {
    const t = table('A', 'main', 2);
    const zone = { w: 600, h: 400 };
    const base = { x: 200, y: 200, rotation: 0 };
    let drafts = layoutDraftReducer(
      {},
      { type: 'nudge', table: t, base, dx: 40, dy: 0, rotate: 0, zone },
    );
    drafts = layoutDraftReducer(drafts, {
      type: 'nudge',
      table: t,
      base,
      dx: 0,
      dy: 8,
      rotate: 0,
      zone,
    });
    drafts = layoutDraftReducer(drafts, {
      type: 'nudge',
      table: t,
      base,
      dx: 0,
      dy: 0,
      rotate: -15,
      zone,
    });
    expect(drafts.A).toEqual({ x: 240, y: 208, rotation: 345 });
  });

  it('resets a zone to a tidy grid', () => {
    const tables = [table('A', 'main', 2), table('B', 'main', 4), table('C', 'main', 6)];
    const drafts = layoutDraftReducer({}, { type: 'reset-zone', tables, zone: { w: 600, h: 400 } });
    expect(Object.keys(drafts).sort()).toEqual(['A', 'B', 'C']);
    expect(new Set(Object.values(drafts).map((p) => `${p.x},${p.y}`)).size).toBe(3);
  });
});
