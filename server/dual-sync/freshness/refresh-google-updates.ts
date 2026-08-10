import { z } from 'zod';

import { createGoogleUpdatesClient } from '@/server/google-business-profile/googleUpdates';
import {
  getUsableGoogleBusinessProfileAccessToken,
  persistGoogleProviderAccessFailure,
} from '@/server/google-business-profile/serviceAccessRuntime';

import {
  buildGoogleUpdateOverlay,
  type GoogleUpdateOverlay,
  type GoogleUpdateOverlayInput,
} from './google-update-overlay';

import type { GoogleNotificationParticipationFence } from '../notifications/participation';
import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

type GoogleUpdateMaskSet = GoogleUpdateOverlayInput['location'];
const GOOGLE_UPDATE_MASK_TTL_MS = 28 * 24 * 60 * 60 * 1000;

export interface GoogleUpdatesReadPort {
  readLocationMasks(locationId: string): Promise<GoogleUpdateMaskSet>;
  readAttributeMasks(locationId: string): Promise<GoogleUpdateMaskSet>;
}

export interface GoogleUpdateOverlayPersistencePort {
  persist(input: {
    readonly fence: GoogleNotificationParticipationFence;
    readonly eventId: string;
    readonly observedAt: string;
    readonly expiresAt: string;
    readonly overlay: GoogleUpdateOverlay;
    readonly locationMasks: readonly string[];
    readonly attributePaths: readonly string[];
  }): Promise<void>;
}

export async function refreshGoogleUpdateMasks(input: {
  readonly fence: GoogleNotificationParticipationFence;
  readonly eventId: string;
  readonly observedAt: string;
  readonly provider: GoogleUpdatesReadPort;
  readonly persistence: GoogleUpdateOverlayPersistencePort;
}): Promise<GoogleUpdateOverlay> {
  const observedAt = new Date(input.observedAt);
  if (Number.isNaN(observedAt.getTime())) throw new RangeError('Invalid observation timestamp.');
  const [location, attributes] = await Promise.all([
    input.provider.readLocationMasks(input.fence.externalLocationId),
    input.provider.readAttributeMasks(input.fence.externalLocationId),
  ]);
  const overlay = buildGoogleUpdateOverlay({ location, attributes });
  await input.persistence.persist({
    fence: input.fence,
    eventId: input.eventId,
    observedAt: input.observedAt,
    expiresAt: new Date(observedAt.getTime() + GOOGLE_UPDATE_MASK_TTL_MS).toISOString(),
    overlay,
    locationMasks: [
      ...new Set([
        ...location.diffMasks,
        ...location.pendingMasks,
        ...(location.unknownPaths ?? []),
      ]),
    ].sort(),
    attributePaths: [
      ...new Set([
        ...attributes.diffMasks,
        ...attributes.pendingMasks,
        ...(attributes.unknownPaths ?? []),
      ]),
    ].sort(),
  });
  return overlay;
}

type GoogleUpdateOverlaySource = {
  readonly sourceJobId?: string | null;
  readonly sourceReceiptSubscription?: string | null;
  readonly sourceReceiptMessageId?: string | null;
};

function fenceArgs(fence: GoogleNotificationParticipationFence) {
  return {
    p_restaurant_id: fence.restaurantId,
    p_external_profile_row_id: fence.externalProfileRowId,
    p_external_account_id: fence.externalAccountId,
    p_external_profile_id: fence.externalProfileId,
    p_external_location_id: fence.externalLocationId,
    p_connection_generation: fence.connectionGeneration,
    p_consent_epoch: fence.consentEpoch,
  };
}

export function createSupabaseGoogleUpdateOverlayPersistence(
  client: SupabaseClient<Database>,
  source: GoogleUpdateOverlaySource = {},
): GoogleUpdateOverlayPersistencePort {
  return {
    async persist(input) {
      if (input.locationMasks.length + input.attributePaths.length === 0) return;
      const result = await client.rpc('upsert_gbp_pending_update_masks_v1', {
        ...fenceArgs(input.fence),
        p_event_id: input.eventId,
        p_location_masks: [...input.locationMasks],
        p_attribute_paths: [...input.attributePaths],
        p_source_receipt_subscription: source.sourceReceiptSubscription ?? null,
        p_source_receipt_message_id: source.sourceReceiptMessageId ?? null,
        p_source_job_id: source.sourceJobId ?? null,
        p_observed_at: input.observedAt,
        p_expires_at: input.expiresAt,
      });
      if (result.error) throw result.error;
    },
  };
}

export async function readGoogleUpdateOverlays(input: {
  readonly client: SupabaseClient<Database>;
  readonly fence: GoogleNotificationParticipationFence;
  readonly now: string;
}) {
  const result = await input.client.rpc('read_gbp_pending_update_masks_v1', {
    ...fenceArgs(input.fence),
    p_now: input.now,
  });
  if (result.error) throw result.error;
  return result.data;
}

export async function terminalizeGoogleUpdateOverlay(input: {
  readonly client: SupabaseClient<Database>;
  readonly fence: GoogleNotificationParticipationFence;
  readonly eventId: string;
  readonly status: 'applied' | 'stale' | 'failed';
  readonly terminalAt: string;
}) {
  const result = await input.client.rpc('terminalize_gbp_pending_update_masks_v1', {
    ...fenceArgs(input.fence),
    p_event_id: input.eventId,
    p_terminal_status: input.status,
    p_terminal_at: input.terminalAt,
  });
  if (result.error) throw result.error;
  return result.data;
}

export type ScheduledGoogleUpdateRefreshExecutorInput = {
  readonly client: SupabaseClient<Database>;
  readonly jobId: string;
  readonly restaurantId: string;
  readonly observedAt: string;
};

export type ScheduledGoogleUpdateRefreshExecutor = (
  input: ScheduledGoogleUpdateRefreshExecutorInput,
) => Promise<void>;

const scheduledJobPayloadSchema = z
  .object({
    eventId: z.string().min(1).optional(),
    sourceReceiptSubscription: z.string().min(1).optional(),
    sourceReceiptMessageId: z.string().min(1).optional(),
  })
  .passthrough();

const GOOGLE_UPDATE_LOCATION_READ_MASK = [
  'categories',
  'moreHours',
  'phoneNumbers',
  'profile',
  'regularHours',
  'serviceArea',
  'serviceItems',
  'specialHours',
  'storefrontAddress',
  'title',
] as const;

function maskSet(input: {
  readonly diffMask:
    | { readonly kind: 'known'; readonly masks: readonly string[] }
    | {
        readonly kind: 'unknown';
        readonly masks: readonly [];
        readonly unknownPaths: readonly string[];
      };
  readonly pendingMask:
    | { readonly kind: 'known'; readonly masks: readonly string[] }
    | {
        readonly kind: 'unknown';
        readonly masks: readonly [];
        readonly unknownPaths: readonly string[];
      };
}): GoogleUpdateMaskSet {
  return {
    diffMasks: input.diffMask.masks,
    pendingMasks: input.pendingMask.masks,
    unknownPaths: [
      ...(input.diffMask.kind === 'unknown' ? input.diffMask.unknownPaths : []),
      ...(input.pendingMask.kind === 'unknown' ? input.pendingMask.unknownPaths : []),
    ],
  };
}

export const executeScheduledGoogleUpdateRefresh: ScheduledGoogleUpdateRefreshExecutor = async (
  input,
) => {
  const jobResult = await input.client
    .from('dual_sync_jobs')
    .select(
      'id,restaurant_id,external_profile_id,external_account_id,external_location_id,connection_generation,consent_epoch,payload',
    )
    .eq('id', input.jobId)
    .eq('restaurant_id', input.restaurantId)
    .single();
  if (jobResult.error) throw jobResult.error;
  const job = jobResult.data;
  if (
    !job.external_profile_id ||
    !job.external_account_id ||
    !job.external_location_id ||
    job.connection_generation === null ||
    job.consent_epoch === null
  ) {
    throw new Error('Scheduled Google update job is missing its exact connection fence.');
  }
  const profileResult = await input.client
    .from('restaurant_external_profiles')
    .select('*')
    .eq('restaurant_id', job.restaurant_id)
    .eq('provider', 'google_business_profile')
    .eq('external_profile_id', job.external_profile_id)
    .eq('external_account_id', job.external_account_id)
    .eq('external_location_id', job.external_location_id)
    .eq('connection_generation', job.connection_generation)
    .eq('consent_epoch', job.consent_epoch)
    .eq('connection_status', 'linked')
    .single();
  if (profileResult.error) throw profileResult.error;
  const profile = profileResult.data;
  const payload = scheduledJobPayloadSchema.safeParse(job.payload);
  const source = payload.success ? payload.data : {};
  const { accessToken } = await getUsableGoogleBusinessProfileAccessToken(profile, input.client);
  const providerClient = createGoogleUpdatesClient({ accessToken });
  try {
    await refreshGoogleUpdateMasks({
      fence: {
        restaurantId: profile.restaurant_id,
        externalProfileRowId: profile.id,
        externalAccountId: job.external_account_id,
        externalProfileId: job.external_profile_id,
        externalLocationId: job.external_location_id,
        connectionGeneration: job.connection_generation,
        consentEpoch: job.consent_epoch,
      },
      eventId: source.eventId ?? input.jobId,
      observedAt: input.observedAt,
      provider: {
        async readLocationMasks(locationId) {
          return maskSet(
            await providerClient.getLocation(locationId, GOOGLE_UPDATE_LOCATION_READ_MASK),
          );
        },
        async readAttributeMasks(locationId) {
          return maskSet(await providerClient.getAttributes(locationId));
        },
      },
      persistence: createSupabaseGoogleUpdateOverlayPersistence(input.client, {
        sourceJobId: input.jobId,
        sourceReceiptSubscription: source.sourceReceiptSubscription,
        sourceReceiptMessageId: source.sourceReceiptMessageId,
      }),
    });
  } catch (error) {
    await persistGoogleProviderAccessFailure(error, profile, input.client);
    throw error;
  }
};
