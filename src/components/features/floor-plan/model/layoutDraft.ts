import {
  clampToZone,
  gridPositions,
  isStoredPositionUsable,
  samePosition,
} from './floorPlanLayout';

import type { FloorPosition, FloorTable } from './floorPlanTypes';

export type LayoutDrafts = Readonly<Record<string, FloorPosition>>;

export type LayoutDraftAction =
  | { type: 'place'; table: FloorTable; position: FloorPosition; zone: { w: number; h: number } }
  | {
      type: 'nudge';
      table: FloorTable;
      /** Position to start from when the table has no draft yet. */
      base: FloorPosition;
      dx: number;
      dy: number;
      rotate: number;
      zone: { w: number; h: number };
    }
  | { type: 'reset-zone'; tables: FloorTable[]; zone: { w: number; h: number } }
  | { type: 'keep-only'; tableIds: readonly string[] }
  | { type: 'discard' };

export function layoutDraftReducer(state: LayoutDrafts, action: LayoutDraftAction): LayoutDrafts {
  switch (action.type) {
    case 'place':
      return {
        ...state,
        [action.table.id]: clampToZone(action.table, action.position, action.zone),
      };
    case 'nudge': {
      // Relative to the latest draft, so rapid key repeats compose instead of racing.
      const from = state[action.table.id] ?? action.base;
      const next = {
        x: from.x + action.dx,
        y: from.y + action.dy,
        rotation: from.rotation + action.rotate,
      };
      return { ...state, [action.table.id]: clampToZone(action.table, next, action.zone) };
    }
    case 'reset-zone': {
      const next = { ...state };
      for (const [id, position] of gridPositions(action.tables, action.zone)) next[id] = position;
      return next;
    }
    case 'keep-only': {
      const keep = new Set(action.tableIds);
      return Object.fromEntries(Object.entries(state).filter(([id]) => keep.has(id)));
    }
    case 'discard':
      return Object.keys(state).length ? {} : state;
  }
}

/**
 * Drafts that differ from what is stored. An auto-placed table counts as dirty
 * once touched, so saving pins it where the manager left it.
 */
export function dirtyTableIds(drafts: LayoutDrafts, tables: readonly FloorTable[]): string[] {
  const byId = new Map(tables.map((t) => [t.id, t]));
  return Object.keys(drafts).filter((id) => {
    const table = byId.get(id);
    if (!table) return false;
    if (!isStoredPositionUsable(table.savedPosition)) return true;
    return !samePosition(drafts[id], table.savedPosition);
  });
}
