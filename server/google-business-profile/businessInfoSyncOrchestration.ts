import { normalizeText, toJson } from './businessInfoNormalization';
import {
  persistGoogleBusinessProfileRawSnapshot,
  requireGoogleBusinessProfileContentFence,
} from './contentSnapshotPersistence';

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
  const fence = requireGoogleBusinessProfileContentFence(
    params.restaurantId,
    params.externalProfile,
  );
  const rawResponses = params.location.__nabatableRawResponses;
  const rawLocation = { ...params.location };
  delete rawLocation.__nabatableOptionalFetchStatus;
  delete rawLocation.__nabatableRawResponses;
  for (const rawResponse of rawResponses ?? [rawLocation]) {
    await persistGoogleBusinessProfileRawSnapshot({
      client: params.client,
      fence,
      snapshotType: 'location',
      payload: toJson(rawResponse),
      sourceRevision: normalizeText(params.location.name),
      observedAt: params.syncedAt,
    });
  }
  if (params.syncAttributes && params.attributes) {
    await persistGoogleBusinessProfileRawSnapshot({
      client: params.client,
      fence,
      snapshotType: 'attributes',
      payload: toJson(params.attributes),
      sourceRevision: normalizeText(params.attributes.name),
      observedAt: params.syncedAt,
    });
  }
}
