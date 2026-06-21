import { resolveTableState } from './serviceState';

import type { FloorPlanTable, NormalizedPosition } from './types';

export type JoinGroup = {
  bookingId: string;
  tableIds: string[];
  capacity: number;
};

export type JoinLink = {
  key: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

export type JoinBox = {
  bookingId: string;
  left: number;
  top: number;
  width: number;
  height: number;
  capacity: number;
};

/**
 * Derive joined-table groups from bookings spanning multiple tables at scrub time T.
 * A booking ref carries tableIds; tables sharing a bookingId form a joined party.
 * This reflects the real merge concept (booking_table_assignments.merge_group_id)
 * with no extra data.
 */
export function computeJoinGroups(tables: FloorPlanTable[], tMs: number): JoinGroup[] {
  const tableById = new Map(tables.map((table) => [table.id, table]));
  const byBooking = new Map<string, Set<string>>();

  for (const table of tables) {
    const { booking } = resolveTableState(table, tMs);
    if (!booking) continue;
    const ids = booking.tableIds && booking.tableIds.length > 0 ? booking.tableIds : [table.id];
    const set = byBooking.get(booking.id) ?? new Set<string>();
    for (const id of ids) {
      if (tableById.has(id)) set.add(id);
    }
    byBooking.set(booking.id, set);
  }

  const groups: JoinGroup[] = [];
  for (const [bookingId, set] of byBooking) {
    if (set.size < 2) continue;
    const tableIds = Array.from(set);
    const capacity = tableIds.reduce((sum, id) => sum + (tableById.get(id)?.capacity ?? 0), 0);
    groups.push({ bookingId, tableIds, capacity });
  }
  return groups;
}

/** SVG link segments connecting the centres of each joined group's tables (percent space). */
export function computeJoinLinks(
  groups: JoinGroup[],
  positions: Map<string, NormalizedPosition>,
): JoinLink[] {
  const links: JoinLink[] = [];
  for (const group of groups) {
    const pts = group.tableIds
      .map((id) => positions.get(id))
      .filter((pos): pos is NormalizedPosition => Boolean(pos));
    for (let i = 1; i < pts.length; i += 1) {
      links.push({
        key: `${group.bookingId}-${i}`,
        x1: pts[i - 1].xPercent,
        y1: pts[i - 1].yPercent,
        x2: pts[i].xPercent,
        y2: pts[i].yPercent,
      });
    }
  }
  return links;
}

/** Bracket boxes around each joined group (percent space, padded). */
export function computeJoinBoxes(
  groups: JoinGroup[],
  positions: Map<string, NormalizedPosition>,
  pad = 3,
): JoinBox[] {
  const boxes: JoinBox[] = [];
  for (const group of groups) {
    const pts = group.tableIds
      .map((id) => positions.get(id))
      .filter((pos): pos is NormalizedPosition => Boolean(pos));
    if (pts.length < 2) continue;
    const xs = pts.map((p) => p.xPercent);
    const ys = pts.map((p) => p.yPercent);
    const left = Math.min(...xs) - pad;
    const top = Math.min(...ys) - pad;
    const right = Math.max(...xs) + pad;
    const bottom = Math.max(...ys) + pad;
    boxes.push({
      bookingId: group.bookingId,
      left,
      top,
      width: right - left,
      height: bottom - top,
      capacity: group.capacity,
    });
  }
  return boxes;
}
