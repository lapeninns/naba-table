import { getOccasionCatalog } from '@/server/occasions/catalog';

import type { OccasionKey } from '@reserve/shared/occasions';

/**
 * Validate that a booking/occasion key exists and is active in the catalog.
 * Booking writes force a fresh read so cross-instance cache staleness cannot
 * admit disabled or deleted occasion keys.
 */
export async function assertActiveOccasionKey(value: string): Promise<OccasionKey> {
  const normalized = (value ?? '').trim();
  if (!normalized) {
    throw new Error('Booking type is required');
  }

  const fresh = await getOccasionCatalog({ forceRefresh: true });
  const freshMatch = fresh.byKey.get(normalized);
  if (freshMatch?.isActive) {
    return freshMatch.key;
  }

  const available =
    fresh.orderedKeys.length > 0 ? fresh.orderedKeys.join(', ') : 'no active occasions configured';
  throw new Error(`Invalid booking type: ${normalized}. Available: ${available}`);
}
