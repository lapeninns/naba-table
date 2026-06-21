import { DateTime } from "luxon";

type Dateish = DateTime | string | number | Date;

const SLOT_MINUTES = 5;
const SLOT_DURATION_MS = SLOT_MINUTES * 60 * 1000;

export type AvailabilityBitset = {
  /**
   * Set of slot indices that are occupied. The index is derived from
   * `Math.floor(epochMillis / SLOT_DURATION_MS)`.
   */
  occupied: Set<number>;
};

function toDateTime(value: Dateish): DateTime {
  if (value instanceof DateTime) {
    return value;
  }
  if (value instanceof Date) {
    return DateTime.fromJSDate(value, { zone: "utc" });
  }
  if (typeof value === "number") {
    return DateTime.fromMillis(value, { zone: "utc" });
  }
  return DateTime.fromISO(value, { zone: "utc" });
}

function toSlotIndex(date: Dateish, round: "floor" | "ceil" = "floor"): number {
  const millis = toDateTime(date).toMillis();
  const quotient = millis / SLOT_DURATION_MS;
  return round === "floor" ? Math.floor(quotient) : Math.ceil(quotient);
}

/**
 * Computes the half-open slot range [startSlot, endSlot) covered by a window.
 *
 * The start floors and the end ceils, so a window that touches a slot only
 * partially still occupies that whole slot. A window that ends exactly on a slot
 * boundary stops before the next slot, so it never collides with a truly
 * non-overlapping window that starts on that same boundary.
 *
 * Boundary guard: a window with positive duration must always cover at least one
 * slot. When upstream millisecond suppression collapses both endpoints into the
 * same slot (e.g. start/end snapped to the boundary), `floor(start)` can equal
 * `ceil(end)`, yielding an empty range. Left unguarded, `markWindow` would mark
 * ZERO slots and `isWindowFree` would report a truly-busy table as free, causing
 * a double-booking at the boundary. We force `endSlot` one past `startSlot` in
 * that case so the slot containing the start is always covered. Both `markWindow`
 * and `isWindowFree` derive their range from this helper, keeping marking and the
 * freeness check aligned. A zero-duration window keeps its empty range and marks
 * nothing, preserving existing behavior.
 */
function toSlotRange(start: Dateish, end: Dateish): { startSlot: number; endSlot: number } {
  const startSlot = toSlotIndex(start, "floor");
  let endSlot = toSlotIndex(end, "ceil");
  const positiveDuration = toDateTime(end).toMillis() > toDateTime(start).toMillis();
  if (positiveDuration && endSlot <= startSlot) {
    endSlot = startSlot + 1;
  }
  return { startSlot, endSlot };
}

export function createAvailabilityBitset(
  windows?: Array<{ start: Dateish; end: Dateish }>,
): AvailabilityBitset {
  const occupied = new Set<number>();
  if (windows) {
    for (const window of windows) {
      markWindow({ occupied }, window.start, window.end);
    }
  }
  return { occupied };
}

export function markWindow(bitset: AvailabilityBitset, start: Dateish, end: Dateish): void {
  const { startSlot, endSlot } = toSlotRange(start, end);
  for (let slot = startSlot; slot < endSlot; slot += 1) {
    bitset.occupied.add(slot);
  }
}

export function isWindowFree(bitset: AvailabilityBitset, start: Dateish, end: Dateish): boolean {
  const { startSlot, endSlot } = toSlotRange(start, end);
  for (let slot = startSlot; slot < endSlot; slot += 1) {
    if (bitset.occupied.has(slot)) {
      return false;
    }
  }
  return true;
}

export function mergeBitsets(bitsets: AvailabilityBitset[]): AvailabilityBitset {
  const merged = createAvailabilityBitset();
  for (const bitset of bitsets) {
    for (const slot of bitset.occupied) {
      merged.occupied.add(slot);
    }
  }
  return merged;
}
