import { DateTime } from 'luxon';

import { buildCanonicalRows } from './businessInfoCanonicalRows';
import {
  mapGoogleBusinessProfileBusinessInfo,
  type GoogleBusinessProfileBusinessInfo,
} from './businessInfoReadModel';
import { projectSnapshotRows } from './businessInfoSnapshotRows';
import {
  snapshotAttributesSchema,
  snapshotLocationSchema,
  snapshotSupplementSchema,
} from './businessInfoSnapshotSchemas';
import {
  GoogleBusinessProfileContentFenceError,
  resolveGoogleBusinessProfileContentFence,
  readCurrentGoogleBusinessProfileRawSnapshots,
} from './contentSnapshotPersistence';
import { GoogleBusinessProfileError } from './errors';

import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

type DbClient = SupabaseClient<Database>;

const observedMillis = (value: string) => DateTime.fromISO(value, { setZone: true }).toMillis();

async function readProviderRows(restaurantId: string, client: DbClient) {
  const empty = {
    details: null,
    addresses: [],
    phoneNumbers: [],
    links: [],
    categories: [],
    serviceAreas: [],
    hours: [],
    attributes: [],
    serviceItems: [],
  };
  let fence;
  try {
    fence = await resolveGoogleBusinessProfileContentFence({ restaurantId, client });
  } catch (error) {
    if (error instanceof GoogleBusinessProfileContentFenceError) return empty;
    throw error;
  }
  const snapshots = await readCurrentGoogleBusinessProfileRawSnapshots({ client, fence });
  const locations = snapshots.filter((row) => row.snapshot_type === 'location');
  if (!locations.length) return empty;
  const latestAt = locations.reduce(
    (latest, row) =>
      observedMillis(row.fetched_at) > observedMillis(latest) ? row.fetched_at : latest,
    locations[0].fetched_at,
  );
  const latest = locations.filter(
    (row) => observedMillis(row.fetched_at) === observedMillis(latestAt),
  );
  const main = latest.find(
    (row) =>
      typeof row.payload === 'object' &&
      row.payload !== null &&
      !Array.isArray(row.payload) &&
      'title' in row.payload,
  );
  const invalid = () =>
    new GoogleBusinessProfileError(
      'Google listing snapshot is unavailable or invalid. Get the latest from Google.',
      { code: 'GBP_SNAPSHOT_INVALID', status: 409 },
    );
  if (!main) throw invalid();
  const parsed = snapshotLocationSchema.safeParse(main.payload);
  const expectedName = 'locations/' + fence.externalLocationId.replace(/^locations\//, '');
  if (!parsed.success || parsed.data.name !== expectedName) throw invalid();
  const location = parsed.data;
  for (const row of latest) {
    if (row === main) continue;
    const supplement = snapshotSupplementSchema.safeParse(row.payload);
    if (!supplement.success || (supplement.data.name && supplement.data.name !== expectedName))
      throw invalid();
    if (supplement.data.serviceItems) location.serviceItems = supplement.data.serviceItems;
  }
  const attributeRow = snapshots
    .filter((row) => row.snapshot_type === 'attributes')
    .sort((a, b) => observedMillis(b.fetched_at) - observedMillis(a.fetched_at))[0];
  const attributes = attributeRow ? snapshotAttributesSchema.safeParse(attributeRow.payload) : null;
  if (
    attributes &&
    (!attributes.success ||
      (attributes.data.name && attributes.data.name !== expectedName + '/attributes'))
  )
    throw invalid();
  return projectSnapshotRows(
    buildCanonicalRows({
      restaurantId,
      location,
      attributes: attributes?.success ? attributes.data : null,
      syncedAt: latestAt,
    }),
    main.id,
    latestAt,
  );
}

export async function readGoogleBusinessProfileBusinessInfo(
  restaurantId: string,
  client: DbClient,
): Promise<GoogleBusinessProfileBusinessInfo> {
  const [providerRows, hours, periods] = await Promise.all([
    readProviderRows(restaurantId, client),
    client.from('restaurant_operating_hours').select('*').eq('restaurant_id', restaurantId),
    client.from('restaurant_service_periods').select('*').eq('restaurant_id', restaurantId),
  ]);
  if (hours.error) throw hours.error;
  if (periods.error) throw periods.error;
  return mapGoogleBusinessProfileBusinessInfo({
    ...providerRows,
    fieldSyncStatuses: [],
    coreOperatingHours: hours.data ?? [],
    coreServicePeriods: periods.data ?? [],
  });
}
