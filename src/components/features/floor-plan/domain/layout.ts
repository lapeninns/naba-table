import type { FloorPlanTable, NormalizedPosition, RawPosition, TableGeom } from './types';

/** Fixed virtual coordinate space for auto-seeded layouts (keeps coords stable as tables move). */
export const VIRTUAL_WIDTH = 1000;
export const VIRTUAL_HEIGHT = 700;

/**
 * Seed-grid spacing (virtual units), shared by the seeder and the projector so the
 * de-overlap sizing in computeProjectDims tracks the exact grid the seeder lays down.
 */
export const SEED_COL_GAP = VIRTUAL_WIDTH / 5; // cols=4 → VIRTUAL_WIDTH/(cols+1) = 200
export const SEED_ROW_GAP = 110;
/**
 * Largest table footprint (the private-room geom, see {@link tableGeom}) — the worst
 * case the projection must keep row/column spacing clear of so tiles never overlap.
 */
export const MAX_TABLE_W = 110;
export const MAX_TABLE_H = 82;

/** Safely read a stored position record ({x,y,rotation?}) → RawPosition | null. */
export function readRawPosition(
  position: Record<string, unknown> | null | undefined,
): RawPosition | null {
  if (!position || typeof position !== 'object') return null;
  const x = (position as { x?: unknown }).x;
  const y = (position as { y?: unknown }).y;
  if (
    typeof x !== 'number' ||
    typeof y !== 'number' ||
    !Number.isFinite(x) ||
    !Number.isFinite(y)
  ) {
    return null;
  }
  const rawRotation = (position as { rotation?: unknown }).rotation;
  const rotation =
    typeof rawRotation === 'number' && Number.isFinite(rawRotation) ? rawRotation : 0;
  return { x, y, rotation };
}

/** Count tables that already have a real stored position. */
export function countPositioned(tables: FloorPlanTable[]): number {
  return tables.reduce((n, table) => (readRawPosition(table.position) ? n + 1 : n), 0);
}

/**
 * Auto-arrange tables into a tidy grid grouped by zone, in the virtual coordinate
 * space. Used (display-only) when a venue has not placed its tables yet; real
 * positions materialise when an admin drags in Edit-layout mode.
 */
export function seedRawPositions(tables: FloorPlanTable[]): Map<string, RawPosition> {
  const byZone = new Map<string, FloorPlanTable[]>();
  for (const table of tables) {
    const key = table.zoneId ?? 'unzoned';
    const list = byZone.get(key) ?? [];
    list.push(table);
    byZone.set(key, list);
  }

  const result = new Map<string, RawPosition>();
  const cols = 4;
  const colGap = SEED_COL_GAP;
  const rowGap = SEED_ROW_GAP;
  let row = 0;
  for (const zoneTables of byZone.values()) {
    let col = 0;
    for (const table of zoneTables) {
      result.set(table.id, { x: colGap * (col + 1), y: 80 + row * rowGap, rotation: 0 });
      col += 1;
      if (col >= cols) {
        col = 0;
        row += 1;
      }
    }
    if (col !== 0) row += 1;
    row += 1; // blank row between zones
  }
  return result;
}

export type LayoutBounds = { minX: number; minY: number; rangeX: number; rangeY: number };

/** Min/max bounding box over raw coordinates (ranges floored at 1 to avoid /0). */
export function computeBounds(raw: Map<string, RawPosition>): LayoutBounds {
  if (raw.size === 0) return { minX: 0, minY: 0, rangeX: 1, rangeY: 1 };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of raw.values()) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  return { minX, minY, rangeX: Math.max(1, maxX - minX), rangeY: Math.max(1, maxY - minY) };
}

/**
 * Normalise raw coordinates into canvas percentages via a min/max bounding box,
 * so the room scales to fit regardless of the venue's coordinate units.
 */
export function normalizePositions(raw: Map<string, RawPosition>): Map<string, NormalizedPosition> {
  const result = new Map<string, NormalizedPosition>();
  if (raw.size === 0) return result;
  const { minX, minY, rangeX, rangeY } = computeBounds(raw);
  for (const [id, p] of raw) {
    result.set(id, {
      xPercent: ((p.x - minX) / rangeX) * 100,
      yPercent: ((p.y - minY) / rangeY) * 100,
      rotation: p.rotation,
    });
  }
  return result;
}

/** Invert the bbox transform: a canvas percent → a raw coordinate in the layout's own space. */
export function percentToRaw(
  bounds: LayoutBounds,
  xPercent: number,
  yPercent: number,
  rotation = 0,
): RawPosition {
  return {
    x: bounds.minX + (xPercent / 100) * bounds.rangeX,
    y: bounds.minY + (yPercent / 100) * bounds.rangeY,
    rotation,
  };
}

export type FloorPlanLayout = {
  /** id → percent position used for rendering. */
  positions: Map<string, NormalizedPosition>;
  /** id → raw coordinate backing each rendered table (stored, seeded, or dragged). */
  raw: Map<string, RawPosition>;
  /** Bounding box of the raw coordinates — used to invert drops back to raw space. */
  bounds: LayoutBounds;
  /** True when at least one table fell back to an auto-seeded grid slot (venue hasn't placed every table yet). */
  seeded: boolean;
};

/**
 * Build the render layout. Every table gets a coordinate so the whole inventory
 * always renders: stored positions win where present, and any table still
 * missing one falls back to the auto-seeded grid (in the same virtual coordinate
 * space, so stored and seeded tables sit at comparable scale). Drag overrides
 * sit on top of both. `seeded` reports whether any table used a grid fallback.
 *
 * The grid is seeded for the *full* table set (not just the unplaced ones) so a
 * table's fallback slot stays put as the venue places its neighbours one by one,
 * rather than re-packing on every save.
 */
export function buildLayout(
  tables: FloorPlanTable[],
  overrides?: Map<string, RawPosition>,
): FloorPlanLayout {
  const stored = new Map<string, RawPosition>();
  for (const table of tables) {
    const raw = readRawPosition(table.position);
    if (raw) stored.set(table.id, raw);
  }

  const seeded = stored.size < tables.length;
  const seededPositions = seeded ? seedRawPositions(tables) : null;

  const raw = new Map<string, RawPosition>();
  for (const table of tables) {
    const pos = stored.get(table.id) ?? seededPositions?.get(table.id);
    if (pos) raw.set(table.id, pos);
  }
  if (overrides) {
    for (const [id, pos] of overrides) raw.set(id, pos);
  }

  return { positions: normalizePositions(raw), raw, bounds: computeBounds(raw), seeded };
}

/**
 * Table geometry (size + corner radius), shaped by category/seating type/capacity.
 * Ported from the reference design's geom(): high-tops round, booths wider, private
 * rooms large; standard tables grow with capacity.
 */
export function tableGeom(
  table: Pick<FloorPlanTable, 'category' | 'seatingType' | 'capacity'>,
): TableGeom {
  const { category, seatingType, capacity } = table;
  if (category === 'private') return { w: 110, h: 82, r: 14, round: false };
  if (seatingType === 'high_top') return { w: 46, h: 46, r: '50%', round: true };
  if (seatingType === 'booth') {
    return capacity <= 4
      ? { w: 74, h: 54, r: 11, round: false }
      : { w: 92, h: 58, r: 11, round: false };
  }
  if (capacity <= 2) return { w: 52, h: 52, r: 11, round: false };
  if (capacity <= 4) return { w: 62, h: 58, r: 11, round: false };
  return { w: 80, h: 66, r: 11, round: false };
}
