import { resolveTableState } from './serviceState';
import { SERVICE_STATE_META } from './types';

import type { FloorPlanTable, NormalizedPosition } from './types';

export type ZoneRegion = {
  key: string;
  name: string;
  count: number;
  /** Percent-space bounding box (already padded) for the dashed region. */
  left: number;
  top: number;
  width: number;
  height: number;
  seatedCovers: number;
  capacity: number;
  occupancyPct: number;
};

/**
 * Compute dashed zone regions + occupancy from normalised (percent) positions.
 * Occupied covers count only tables whose live state holds the floor (seated/
 * finishing/walkin/overdue) with a booking attached.
 */
export function computeZones(
  tables: FloorPlanTable[],
  positions: Map<string, NormalizedPosition>,
  tMs: number,
  pad = 5,
): ZoneRegion[] {
  const byZone = new Map<string, FloorPlanTable[]>();
  for (const table of tables) {
    const key = table.zoneId ?? 'unzoned';
    const list = byZone.get(key) ?? [];
    list.push(table);
    byZone.set(key, list);
  }

  const regions: ZoneRegion[] = [];
  for (const [key, zoneTables] of byZone) {
    const pts = zoneTables
      .map((table) => positions.get(table.id))
      .filter((pos): pos is NormalizedPosition => Boolean(pos));
    if (pts.length === 0) continue;

    const xs = pts.map((p) => p.xPercent);
    const ys = pts.map((p) => p.yPercent);
    const left = Math.max(0, Math.min(...xs) - pad);
    const top = Math.max(0, Math.min(...ys) - pad);
    const right = Math.min(100, Math.max(...xs) + pad);
    const bottom = Math.min(100, Math.max(...ys) + pad);

    let seatedCovers = 0;
    let capacity = 0;
    for (const table of zoneTables) {
      capacity += table.capacity;
      const { state, booking } = resolveTableState(table, tMs);
      if (SERVICE_STATE_META[state].occupied && booking) {
        seatedCovers += booking.partySize;
      }
    }

    regions.push({
      key,
      name: zoneTables[0].zoneName ?? 'Zone',
      count: zoneTables.length,
      left,
      top,
      width: right - left,
      height: bottom - top,
      seatedCovers,
      capacity,
      occupancyPct: capacity > 0 ? Math.min(100, Math.round((seatedCovers / capacity) * 100)) : 0,
    });
  }
  return regions;
}
