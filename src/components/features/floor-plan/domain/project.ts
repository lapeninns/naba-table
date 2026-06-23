import { MAX_TABLE_H, MAX_TABLE_W, SEED_COL_GAP, SEED_ROW_GAP, tableGeom } from './layout';

import type { LayoutBounds } from './layout';
import type { FloorPlanTable, TableGeom } from './types';

/**
 * Pixel projection for the floor map.
 *
 * The reference design lays tables out in a fixed pixel coordinate space, sized
 * to its content and centred inside a scrollable panel (tables keep a fixed
 * physical size; the room scrolls rather than stretching). Our live data stores
 * positions as bbox-normalised percentages, so this module projects those
 * percentages back into that fixed pixel space — tables at fixed sizes, zone
 * regions hugging their tables, join links/brackets between centres — so the
 * rendered map matches the design 1:1 regardless of viewport width.
 */

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export type ProjectDims = { innerW: number; innerH: number; padX: number; padY: number };

export type ProjectedTable = {
  id: string;
  left: number;
  top: number;
  w: number;
  h: number;
  r: number | string;
  cx: number;
  cy: number;
};

export type ProjectedZone = {
  key: string;
  name: string;
  count: number;
  left: number;
  top: number;
  width: number;
  height: number;
};

export type ProjectedLink = {
  key: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

export type ProjectedBox = {
  key: string;
  left: number;
  top: number;
  width: number;
  height: number;
  capacity: number;
  label: string;
};

export type ProjectInputTable = {
  id: string;
  zoneId: string;
  zoneName: string | null;
  geom: TableGeom;
  /** bbox-normalised centre position, in 0–100 percent (null tables are skipped). */
  xPercent: number;
  yPercent: number;
};

export type ProjectInputGroup = { key: string; tableIds: string[]; capacity: number };

export type ProjectedLayout = {
  dims: ProjectDims;
  contentW: number;
  contentH: number;
  offsetX: number;
  offsetY: number;
  tables: Map<string, ProjectedTable>;
  zones: ProjectedZone[];
  links: ProjectedLink[];
  boxes: ProjectedBox[];
};

/**
 * Size the inner pixel canvas LINEARLY with the venue's coordinate range, so the
 * tightest seeded step always projects to at least the tallest/widest table plus a
 * margin. The previous fixed innerH=440 squashed tall layouts (many rows) until row
 * pitch fell below tile height and tables stacked on top of each other; sizing by a
 * fixed pixels-per-virtual-unit makes spacing grow with the room instead. A floor
 * keeps tiny venues compact; a cap keeps pathological ranges finite (zoom-out frames
 * them). projectCenter/unprojectCenter are unchanged — they read these dims symmetrically.
 */
export function computeProjectDims(bounds: LayoutBounds): ProjectDims {
  const PAD_X = 58;
  const PAD_Y = 50;
  const GAP_MARGIN = 10;
  const scaleY = (MAX_TABLE_H + GAP_MARGIN) / SEED_ROW_GAP; // (82+10)/110 = 0.836
  const scaleX = (MAX_TABLE_W + GAP_MARGIN) / SEED_COL_GAP; // (110+10)/200 = 0.60
  const drawableH = clamp(Math.round(bounds.rangeY * scaleY), 340, 4000);
  const drawableW = clamp(Math.round(bounds.rangeX * scaleX), 340, 3000);
  return { innerW: drawableW + 2 * PAD_X, innerH: drawableH + 2 * PAD_Y, padX: PAD_X, padY: PAD_Y };
}

/** Project a percent centre into the inner pixel area (before clip-offset). */
export function projectCenter(xPercent: number, yPercent: number, d: ProjectDims) {
  return {
    cx: d.padX + (clamp(xPercent, 0, 100) / 100) * (d.innerW - 2 * d.padX),
    cy: d.padY + (clamp(yPercent, 0, 100) / 100) * (d.innerH - 2 * d.padY),
  };
}

/** Invert a pixel centre (relative to the content box) back to a percent centre. */
export function unprojectCenter(
  cx: number,
  cy: number,
  d: ProjectDims,
  offsetX: number,
  offsetY: number,
) {
  return {
    xPercent: clamp(((cx - offsetX - d.padX) / (d.innerW - 2 * d.padX)) * 100, 0, 100),
    yPercent: clamp(((cy - offsetY - d.padY) / (d.innerH - 2 * d.padY)) * 100, 0, 100),
  };
}

/** Build the full pixel projection (tables, zones, join links + brackets, content size). */
export function projectLayout(
  inputs: ProjectInputTable[],
  groups: ProjectInputGroup[],
  bounds: LayoutBounds,
): ProjectedLayout {
  const dims = computeProjectDims(bounds);
  const raw = new Map<string, ProjectedTable>();

  for (const t of inputs) {
    const { cx, cy } = projectCenter(t.xPercent, t.yPercent, dims);
    raw.set(t.id, {
      id: t.id,
      w: t.geom.w,
      h: t.geom.h,
      r: t.geom.r,
      cx,
      cy,
      left: cx - t.geom.w / 2,
      top: cy - t.geom.h / 2,
    });
  }

  // Zone regions: bbox of each zone's table pixel extents, padded to leave room
  // for the corner label (matches the design's -14 / -30 / +28 / +44 padding).
  const byZone = new Map<string, { name: string; ids: string[] }>();
  for (const t of inputs) {
    const entry = byZone.get(t.zoneId) ?? { name: t.zoneName ?? 'Zone', ids: [] };
    entry.ids.push(t.id);
    byZone.set(t.zoneId, entry);
  }
  const zones: Array<ProjectedZone & { _l: number; _t: number; _r: number; _b: number }> = [];
  for (const [key, { name, ids }] of byZone) {
    const ts = ids.map((id) => raw.get(id)).filter((p): p is ProjectedTable => Boolean(p));
    if (ts.length === 0) continue;
    const minL = Math.min(...ts.map((p) => p.left));
    const minT = Math.min(...ts.map((p) => p.top));
    const maxR = Math.max(...ts.map((p) => p.left + p.w));
    const maxB = Math.max(...ts.map((p) => p.top + p.h));
    zones.push({
      key,
      name,
      count: ids.length,
      left: minL - 14,
      top: minT - 30,
      width: maxR - minL + 28,
      height: maxB - minT + 44,
      _l: minL - 14,
      _t: minT - 30,
      _r: maxR + 14,
      _b: maxB + 14,
    });
  }

  // Join brackets + connector lines from effective centres.
  const boxesRaw: Array<ProjectedBox & { _l: number; _t: number; _r: number; _b: number }> = [];
  const links: ProjectedLink[] = [];
  for (const g of groups) {
    const ts = g.tableIds.map((id) => raw.get(id)).filter((p): p is ProjectedTable => Boolean(p));
    if (ts.length < 2) continue;
    for (let i = 1; i < ts.length; i += 1) {
      links.push({
        key: `${g.key}-${i}`,
        x1: ts[i - 1].cx,
        y1: ts[i - 1].cy,
        x2: ts[i].cx,
        y2: ts[i].cy,
      });
    }
    const minL = Math.min(...ts.map((p) => p.left)) - 9;
    const minT = Math.min(...ts.map((p) => p.top)) - 9;
    const maxR = Math.max(...ts.map((p) => p.left + p.w)) + 9;
    const maxB = Math.max(...ts.map((p) => p.top + p.h)) + 9;
    boxesRaw.push({
      key: g.key,
      left: minL,
      top: minT,
      width: maxR - minL,
      height: maxB - minT,
      capacity: g.capacity,
      label: `Joined · ${g.capacity} seats`,
      _l: minL,
      _t: minT,
      _r: maxR,
      _b: maxB,
    });
  }

  // Shift everything so the top-left-most edge sits at a small margin (no clipping
  // of negative zone/label coordinates), then size the content box to contain all.
  const allL = [
    ...Array.from(raw.values()).map((p) => p.left),
    ...zones.map((z) => z._l),
    ...boxesRaw.map((b) => b._l),
  ];
  const allT = [
    ...Array.from(raw.values()).map((p) => p.top),
    ...zones.map((z) => z._t),
    ...boxesRaw.map((b) => b._t),
  ];
  const minX = allL.length ? Math.min(...allL) : 0;
  const minY = allT.length ? Math.min(...allT) : 0;
  const offsetX = minX < 12 ? 12 - minX : 0;
  const offsetY = minY < 12 ? 12 - minY : 0;

  const tables = new Map<string, ProjectedTable>();
  for (const [id, p] of raw) {
    tables.set(id, {
      ...p,
      left: p.left + offsetX,
      top: p.top + offsetY,
      cx: p.cx + offsetX,
      cy: p.cy + offsetY,
    });
  }
  const shiftedZones: ProjectedZone[] = zones.map((z) => ({
    key: z.key,
    name: z.name,
    count: z.count,
    left: z.left + offsetX,
    top: z.top + offsetY,
    width: z.width,
    height: z.height,
  }));
  const shiftedLinks: ProjectedLink[] = links.map((l) => ({
    key: l.key,
    x1: l.x1 + offsetX,
    y1: l.y1 + offsetY,
    x2: l.x2 + offsetX,
    y2: l.y2 + offsetY,
  }));
  const shiftedBoxes: ProjectedBox[] = boxesRaw.map((b) => ({
    key: b.key,
    left: b.left + offsetX,
    top: b.top + offsetY,
    width: b.width,
    height: b.height,
    capacity: b.capacity,
    label: b.label,
  }));

  const allR = [
    ...Array.from(tables.values()).map((p) => p.left + p.w),
    ...shiftedZones.map((z) => z.left + z.width),
    ...shiftedBoxes.map((b) => b.left + b.width),
  ];
  const allB = [
    ...Array.from(tables.values()).map((p) => p.top + p.h),
    ...shiftedZones.map((z) => z.top + z.height),
    ...shiftedBoxes.map((b) => b.top + b.height),
  ];
  const contentW = (allR.length ? Math.max(...allR) : dims.innerW) + 12;
  const contentH = (allB.length ? Math.max(...allB) : dims.innerH) + 12;

  return {
    dims,
    contentW,
    contentH,
    offsetX,
    offsetY,
    tables,
    zones: shiftedZones,
    links: shiftedLinks,
    boxes: shiftedBoxes,
  };
}

/** Convenience: build projection inputs from a table + its percent position. */
export function toProjectInput(
  table: Pick<
    FloorPlanTable,
    'id' | 'zoneId' | 'zoneName' | 'category' | 'seatingType' | 'capacity'
  >,
  xPercent: number,
  yPercent: number,
): ProjectInputTable {
  return {
    id: table.id,
    zoneId: table.zoneId ?? 'unzoned',
    zoneName: table.zoneName,
    geom: tableGeom(table),
    xPercent,
    yPercent,
  };
}

/**
 * Dashed "could-join" connector segments from a selected (party-holding) table to
 * each of its combine candidates — the reference design's adjacency hint, drawn
 * only for the current selection so it stays legible on dense / auto-seeded floors.
 * Candidates not currently projected (and the table itself) are skipped.
 */
export function joinHintLinks(
  tables: Map<string, ProjectedTable>,
  fromId: string,
  toIds: string[],
): ProjectedLink[] {
  const from = tables.get(fromId);
  if (!from) return [];
  const links: ProjectedLink[] = [];
  for (const toId of toIds) {
    if (toId === fromId) continue;
    const to = tables.get(toId);
    if (!to) continue;
    links.push({ key: `hint-${fromId}-${toId}`, x1: from.cx, y1: from.cy, x2: to.cx, y2: to.cy });
  }
  return links;
}
