import { z } from 'zod';

import {
  gbpLiveConnectionSchema,
  type GbpLiveConnection,
  type GbpRetentionStatus,
} from '@/lib/google-business-profile/liveConnection';
import { loadContentRetentionReadiness } from '@/server/dual-sync/retention/supabase-port';

import { GoogleBusinessProfileError } from './errors';
import { createGoogleBusinessProfileLocationNotLinkedError } from './serviceConnectionContext';
import { getLinkedExternalProfileWithLocation } from './serviceLinkedLocationRuntime';
import { findExternalProfile, type DbClient } from './serviceRepository';

const liveLocationSchema = z.object({
  name: z.string(),
  title: z.string().optional(),
  storefrontAddress: z
    .object({
      addressLines: z.array(z.string()).optional(),
      sublocality: z.string().optional(),
      locality: z.string().optional(),
      administrativeArea: z.string().optional(),
      postalCode: z.string().optional(),
      regionCode: z.string().optional(),
    })
    .optional(),
  phoneNumbers: z.object({ primaryPhone: z.string().optional() }).optional(),
  websiteUri: z.string().optional(),
});

export async function readGoogleBusinessProfileRetentionStatus(
  client: DbClient,
  now = new Date(),
): Promise<GbpRetentionStatus> {
  try {
    const readiness = await loadContentRetentionReadiness(client, now);
    return readiness.ready
      ? { status: 'ready', reason: null }
      : { status: 'blocked', reason: 'retention_not_ready' };
  } catch {
    return { status: 'blocked', reason: 'readiness_unavailable' };
  }
}

const FENCE_FIELDS = [
  'id',
  'restaurant_id',
  'external_account_id',
  'external_profile_id',
  'external_location_id',
  'external_resource_name',
  'external_location_name',
  'connection_generation',
  'consent_epoch',
  'connection_status',
  'write_state',
] as const;

export async function readGoogleBusinessProfileLiveConnection(
  restaurantId: string,
  client: DbClient,
  clock: () => Date = () => new Date(),
): Promise<GbpLiveConnection> {
  const profile = await findExternalProfile(restaurantId, client);
  if (
    !profile ||
    profile.restaurant_id !== restaurantId ||
    !['linked', 'sync_error'].includes(profile.connection_status)
  ) {
    throw createGoogleBusinessProfileLocationNotLinkedError();
  }
  const { location: rawLocation, locationResourceName } =
    await getLinkedExternalProfileWithLocation(restaurantId, client, profile);
  const location = liveLocationSchema.parse(rawLocation);
  const retention = await readGoogleBusinessProfileRetentionStatus(client, clock());
  const current = await findExternalProfile(restaurantId, client);
  if (
    !current ||
    FENCE_FIELDS.some((field) => current[field] !== profile[field]) ||
    location.name !== locationResourceName
  ) {
    throw new GoogleBusinessProfileError('The linked Google connection changed. Check again.', {
      code: 'GBP_LIVE_CONNECTION_CHANGED',
      status: 409,
    });
  }
  const address = location.storefrontAddress;
  return gbpLiveConnectionSchema.parse({
    status: 'verified',
    verifiedAt: clock().toISOString(),
    location: {
      title: location.title?.trim() || null,
      address: address
        ? [
            ...(address.addressLines ?? []),
            address.sublocality,
            address.locality,
            address.administrativeArea,
            address.postalCode,
            address.regionCode,
          ]
            .filter(Boolean)
            .join(', ') || null
        : null,
      phone: location.phoneNumbers?.primaryPhone ?? null,
      website: location.websiteUri ?? null,
    },
    retention,
  });
}
