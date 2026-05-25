import { buildCanonicalRows } from './businessInfoCanonicalRows';
import { buildFieldSyncStatuses } from './businessInfoFieldSyncStatus';
import { normalizeText } from './businessInfoNormalization';
import { shouldSyncLocationServiceItems } from './businessInfoServiceItemNormalization';
import {
  buildProfileChangeLogRows,
  linkAttributeDefinitions,
  replaceGoogleBusinessProfileCanonicalBusinessInfo,
} from './businessInfoSyncPersistence';

import type {
  GoogleBusinessProfileAttributesResponse,
  GoogleBusinessProfileLocationProfile,
} from './client';
import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

type DbClient = SupabaseClient<Database>;
type ExternalProfileRow = Database['public']['Tables']['restaurant_external_profiles']['Row'];

export async function syncGoogleBusinessProfileCanonicalBusinessInfo(params: {
  restaurantId: string;
  externalProfile: ExternalProfileRow;
  location: GoogleBusinessProfileLocationProfile;
  attributes: GoogleBusinessProfileAttributesResponse | null;
  client: DbClient;
  syncedAt: string;
  syncAttributes: boolean;
}) {
  const rows = buildCanonicalRows({
    restaurantId: params.restaurantId,
    location: params.location,
    attributes: params.syncAttributes ? params.attributes : null,
    syncedAt: params.syncedAt,
  });
  if (params.syncAttributes) {
    rows.attributes = await linkAttributeDefinitions(rows.attributes, params.client);
  }
  const syncServiceItems = shouldSyncLocationServiceItems(params.location);
  const fieldSyncStatuses = buildFieldSyncStatuses({
    restaurantId: params.restaurantId,
    rows,
    syncedAt: params.syncedAt,
    syncServiceItems,
  });
  const fieldSyncEntityTables = [
    'restaurant_business_details',
    'restaurant_addresses',
    'restaurant_phone_numbers',
    'restaurant_links',
    'restaurant_categories',
    'restaurant_service_areas',
    'restaurant_hours',
    ...(syncServiceItems ? ['restaurant_service_items'] : []),
    ...(params.syncAttributes ? ['restaurant_attributes'] : []),
  ];
  const profileChangeLogRows = buildProfileChangeLogRows({
    restaurantId: params.restaurantId,
    externalProfileId: params.externalProfile.id,
    syncedAt: params.syncedAt,
    rows,
    syncAttributes: params.syncAttributes,
    syncServiceItems,
  });

  await replaceGoogleBusinessProfileCanonicalBusinessInfo({
    restaurantId: params.restaurantId,
    externalProfileId: params.externalProfile.id,
    locationSnapshot: params.location,
    locationSourceRevision: normalizeText(params.location.name),
    attributesSnapshot: params.attributes,
    attributesSourceRevision: normalizeText(params.attributes?.name),
    rows,
    fieldSyncStatuses,
    fieldSyncEntityTables,
    profileChangeLogRows,
    syncAttributes: params.syncAttributes,
    syncServiceItems,
    client: params.client,
  });
}
