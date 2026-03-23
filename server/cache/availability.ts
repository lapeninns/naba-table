export type AvailabilitySnapshotEntry = {
  id: string;
  start_time: string;
  end_time: string;
  status: string;
};

export type AvailabilitySnapshot = AvailabilitySnapshotEntry[];

export type CacheReadResult<T> =
  | { status: "disabled" }
  | { status: "miss" }
  | { status: "hit"; value: T };

export async function readAvailabilitySnapshot(
  _restaurantId: string,
  _bookingDate: string,
): Promise<CacheReadResult<AvailabilitySnapshot>> {
  return { status: "disabled" };
}

export async function writeAvailabilitySnapshot(
  _restaurantId: string,
  _bookingDate: string,
  _snapshot: AvailabilitySnapshot,
  _ttlSeconds: number,
): Promise<void> {
  return Promise.resolve();
}

export async function invalidateAvailabilitySnapshot(
  _restaurantId: string,
  _bookingDate: string,
): Promise<void> {
  return Promise.resolve();
}

export function isAvailabilityCacheEnabled(): boolean {
  return false;
}
