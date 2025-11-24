import { getCachedOccasionCatalog, getOccasionCatalog } from '@/server/occasions/catalog';

import type { OccasionKey } from '@reserve/shared/occasions';

/**
 * Validate that a booking/occasion key exists and is active in the catalog.
 * Falls back to a forced refresh when the cached catalog misses the key.
 */
export async function assertActiveOccasionKey(value: string): Promise<OccasionKey> {
  const normalized = (value ?? '').trim();
  if (!normalized) {
    throw new Error('Booking type is required');
  }

  const cached = getCachedOccasionCatalog();
  const cachedMatch = cached.byKey.get(normalized);
  if (cachedMatch?.isActive) {
    return cachedMatch.key;
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
