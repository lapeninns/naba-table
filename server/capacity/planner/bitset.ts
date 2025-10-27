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
  const startSlot = toSlotIndex(start, "floor");
  const endSlot = toSlotIndex(end, "ceil");
  for (let slot = startSlot; slot < endSlot; slot += 1) {
    bitset.occupied.add(slot);
  }
}

export function isWindowFree(bitset: AvailabilityBitset, start: Dateish, end: Dateish): boolean {
  const startSlot = toSlotIndex(start, "floor");
  const endSlot = toSlotIndex(end, "ceil");
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
