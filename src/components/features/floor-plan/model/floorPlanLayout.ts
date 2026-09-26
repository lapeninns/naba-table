import type { FloorPosition, FloorTable, FloorZone } from './floorPlanTypes';

/**
 * Canvas geometry for the floor plan.
 *
 * Zones have no stored geometry, so each zone is drawn as a panel sized to fit
 * its tables and panels are packed into rows by sort order. Table positions are
 * stored relative to their zone's top-left corner, so re-ordering or resizing
 * zones never scrambles a saved layout.
 */

export const ZONE_HEADER = 40;
export const ZONE_PAD = 8;
export const ZONE_GAP = 16;
export const CANVAS_PAD = 16;
export const CANVAS_ROW_WIDTH = 1280;
export const SNAP = 8;
/** Saved positions beyond these bounds are treated as legacy data and auto-placed. */
export const MAX_ZONE_WIDTH = 2400;
export const MAX_ZONE_HEIGHT = 1600;

const CELL_W = 176;
const CELL_H = 148;
const MIN_ZONE_W = 296;
const MIN_ZONE_H = 208;
const PLACE_MARGIN = 24;

export type Size = { w: number; h: number };
export type Box = { x1: number; y1: number; x2: number; y2: number };

export type ZoneRect = { id: string; name: string; x: number; y: number; w: number; h: number };

export type PlacedTable = {
  tableId: string;
  zoneId: string;
  /** Canvas coordinates of the table centre. */
  x: number;
  y: number;
  rotation: number;
  /** Zone-relative position, as stored. */
  relative: FloorPosition;
  auto: boolean;
};

export type FloorPlanLayout = {
  width: number;
  height: number;
  zones: ZoneRect[];
  zoneById: Map<string, ZoneRect>;
  tables: Map<string, PlacedTable>;
};

export function tableSize(table: Pick<FloorTable, 'shape' | 'capacity'>): Size {
  const cap = table.capacity;
  if (table.shape === 'round') {
    const d = cap <= 8 ? 128 : 148;
    return { w: d, h: d };
  }
  const w = cap <= 2 ? 116 : cap <= 4 ? 128 : cap <= 6 ? 156 : 200;
  const h = cap > 6 ? 96 : cap <= 2 ? 80 : 84;
  return { w, h };
}

/** Axis-aligned bounding box of a rotated table. */
export function rotatedSize(table: Pick<FloorTable, 'shape' | 'capacity'>, rotation: number): Size {
  const { w, h } = tableSize(table);
  if (table.shape === 'round') return { w, h };
  const a = (rotation * Math.PI) / 180;
  const c = Math.abs(Math.cos(a));
  const s = Math.abs(Math.sin(a));
  return { w: Math.round(w * c + h * s), h: Math.round(w * s + h * c) };
}

export function boxAround(x: number, y: number, size: Size): Box {
  return { x1: x - size.w / 2, y1: y - size.h / 2, x2: x + size.w / 2, y2: y + size.h / 2 };
}

function overlaps(a: Box, b: Box, margin: number): boolean {
  return (
    a.x1 < b.x2 + margin && b.x1 < a.x2 + margin && a.y1 < b.y2 + margin && b.y1 < a.y2 + margin
  );
}

export function normalizeRotation(rotation: number): number {
  return ((Math.round(rotation) % 360) + 360) % 360;
}

export function isStoredPositionUsable(position: FloorPosition | null): position is FloorPosition {
  if (!position) return false;
  const { x, y, rotation } = position;
  return (
    Number.isFinite(x) &&
    Number.isFinite(y) &&
    Number.isFinite(rotation) &&
    x >= 0 &&
    y >= ZONE_HEADER &&
    x <= MAX_ZONE_WIDTH &&
    y <= MAX_ZONE_HEIGHT
  );
}

export function compareTableNumbers(a: { number: string }, b: { number: string }): number {
  return a.number.localeCompare(b.number, 'en', { numeric: true });
}

function naturalZoneSize(count: number): Size {
  const cols = Math.min(6, Math.max(1, Math.ceil(Math.sqrt(count * 1.5))));
  const rows = Math.max(1, Math.ceil(count / cols));
  return {
    w: Math.max(MIN_ZONE_W, cols * CELL_W + ZONE_PAD * 2),
    h: Math.max(MIN_ZONE_H, ZONE_HEADER + rows * CELL_H + ZONE_PAD),
  };
}

/** First free slot scanning rows top-to-bottom, left-to-right, or null if the zone is full. */
function firstFit(size: Size, zone: Size, placed: Box[]): { x: number; y: number } | null {
  for (let y = ZONE_HEADER + 14; y + size.h <= zone.h - 16; y += SNAP) {
    for (let x = 16; x + size.w <= zone.w - 16; x += SNAP) {
      const box = { x1: x, y1: y, x2: x + size.w, y2: y + size.h };
      if (!placed.some((p) => overlaps(p, box, PLACE_MARGIN))) {
        return { x: x + size.w / 2, y: y + size.h / 2 };
      }
    }
  }
  return null;
}

/** Tidy grid positions for every table in a zone, in table-number order. */
export function gridPositions(tables: FloorTable[], zone: Size): Map<string, FloorPosition> {
  const out = new Map<string, FloorPosition>();
  const placed: Box[] = [];
  let height = zone.h;
  for (const table of [...tables].sort(compareTableNumbers)) {
    const size = tableSize(table);
    let spot = firstFit(size, { w: zone.w, h: height }, placed);
    while (!spot) {
      height += CELL_H;
      spot = firstFit(size, { w: zone.w, h: height }, placed);
    }
    out.set(table.id, { x: spot.x, y: spot.y, rotation: 0 });
    placed.push(boxAround(spot.x, spot.y, size));
  }
  return out;
}

type ZoneContent = {
  zone: FloorZone;
  size: Size;
  positions: Map<string, { pos: FloorPosition; auto: boolean }>;
};

function buildZoneContent(zone: FloorZone, tables: FloorTable[]): ZoneContent {
  const natural = naturalZoneSize(tables.length);
  let w = natural.w;
  let h = natural.h;
  const saved = tables.filter((t) => isStoredPositionUsable(t.savedPosition));
  for (const table of saved) {
    const pos = table.savedPosition as FloorPosition;
    const size = rotatedSize(table, pos.rotation);
    w = Math.max(w, pos.x + size.w / 2 + 16);
    h = Math.max(h, pos.y + size.h / 2 + 16);
  }

  const positions = new Map<string, { pos: FloorPosition; auto: boolean }>();
  const placed: Box[] = [];
  for (const table of saved) {
    const pos = table.savedPosition as FloorPosition;
    positions.set(table.id, {
      pos: { ...pos, rotation: normalizeRotation(pos.rotation) },
      auto: false,
    });
    placed.push(boxAround(pos.x, pos.y, rotatedSize(table, pos.rotation)));
  }

  const unplaced = tables
    .filter((t) => !isStoredPositionUsable(t.savedPosition))
    .sort(compareTableNumbers);
  for (const table of unplaced) {
    const size = tableSize(table);
    let spot = firstFit(size, { w, h }, placed);
    while (!spot) {
      h += CELL_H;
      spot = firstFit(size, { w, h }, placed);
    }
    positions.set(table.id, { pos: { x: spot.x, y: spot.y, rotation: 0 }, auto: true });
    placed.push(boxAround(spot.x, spot.y, size));
  }

  return { zone, size: { w: Math.round(w), h: Math.round(h) }, positions };
}

/**
 * Lays out zones and tables. `drafts` override positions (Arrange mode) but never
 * resize zones, so dragging stays stable: drafts are clamped inside their zone.
 */
export function layoutFloorPlan(
  zones: FloorZone[],
  tables: FloorTable[],
  drafts: Readonly<Record<string, FloorPosition>> = {},
): FloorPlanLayout {
  const sortedZones = [...zones].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
  );
  const byZone = new Map<string, FloorTable[]>();
  for (const table of tables) {
    const list = byZone.get(table.zoneId) ?? [];
    list.push(table);
    byZone.set(table.zoneId, list);
  }

  const contents = sortedZones
    .map((zone) => buildZoneContent(zone, byZone.get(zone.id) ?? []))
    .filter((content) => content.positions.size > 0 || content.zone.active);

  const rowWidth = Math.max(CANVAS_ROW_WIDTH, ...contents.map((c) => c.size.w));
  const rects: ZoneRect[] = [];
  let cursorX = CANVAS_PAD;
  let cursorY = CANVAS_PAD;
  let rowHeight = 0;
  for (const content of contents) {
    if (cursorX > CANVAS_PAD && cursorX + content.size.w > CANVAS_PAD + rowWidth) {
      cursorX = CANVAS_PAD;
      cursorY += rowHeight + ZONE_GAP;
      rowHeight = 0;
    }
    rects.push({
      id: content.zone.id,
      name: content.zone.name,
      x: cursorX,
      y: cursorY,
      w: content.size.w,
      h: content.size.h,
    });
    cursorX += content.size.w + ZONE_GAP;
    rowHeight = Math.max(rowHeight, content.size.h);
  }

  const zoneById = new Map(rects.map((rect) => [rect.id, rect]));
  const tableById = new Map(tables.map((t) => [t.id, t]));
  const placedTables = new Map<string, PlacedTable>();
  for (const content of contents) {
    const rect = zoneById.get(content.zone.id);
    if (!rect) continue;
    for (const [tableId, entry] of content.positions) {
      const table = tableById.get(tableId);
      if (!table) continue;
      const draft = drafts[tableId];
      const relative = draft ? clampToZone(table, draft, rect) : entry.pos;
      placedTables.set(tableId, {
        tableId,
        zoneId: rect.id,
        x: rect.x + relative.x,
        y: rect.y + relative.y,
        rotation: relative.rotation,
        relative,
        auto: entry.auto && !draft,
      });
    }
  }

  const width = Math.max(...rects.map((r) => r.x + r.w), CANVAS_PAD * 2) + CANVAS_PAD;
  const height = Math.max(...rects.map((r) => r.y + r.h), CANVAS_PAD * 2) + CANVAS_PAD;
  return { width, height, zones: rects, zoneById, tables: placedTables };
}

/** Keeps a zone-relative position fully inside the zone, below its header. */
export function clampToZone(
  table: Pick<FloorTable, 'shape' | 'capacity'>,
  position: FloorPosition,
  zone: Size,
): FloorPosition {
  const rotation = normalizeRotation(position.rotation);
  const size = rotatedSize(table, rotation);
  const minX = size.w / 2 + ZONE_PAD;
  const maxX = Math.max(minX, zone.w - size.w / 2 - ZONE_PAD);
  const minY = ZONE_HEADER + size.h / 2;
  const maxY = Math.max(minY, zone.h - size.h / 2 - ZONE_PAD);
  return {
    x: Math.round(Math.min(Math.max(position.x, minX), maxX)),
    y: Math.round(Math.min(Math.max(position.y, minY), maxY)),
    rotation,
  };
}

export function snapToGrid(value: number): number {
  return Math.round(value / SNAP) * SNAP;
}

export function samePosition(
  a: FloorPosition | null | undefined,
  b: FloorPosition | null | undefined,
): boolean {
  if (!a || !b) return false;
  return (
    Math.round(a.x) === Math.round(b.x) &&
    Math.round(a.y) === Math.round(b.y) &&
    normalizeRotation(a.rotation) === normalizeRotation(b.rotation)
  );
}

export function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
