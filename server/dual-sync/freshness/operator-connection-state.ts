import {
  gbpConnectionStateResponseV1Schema,
  gbpPendingUpdatesResponseV1Schema,
  type GbpConnectionStateResponseV1,
  type GbpPendingUpdatesResponseV1,
} from '@/server/dual-sync/contracts';
import { getDualSyncRuntimeControls } from '@/server/dual-sync/runtime-controls';

import { buildGoogleUpdateOverlay } from './google-update-overlay';
import { readGoogleUpdateOverlays } from './refresh-google-updates';

import type { GoogleNotificationParticipationFence } from '../notifications/participation';
import type { GoogleBusinessProfileConnectionState } from '@/server/google-business-profile/serviceConnectionStateTypes';
import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

type Profile = Pick<
  Database['public']['Tables']['restaurant_external_profiles']['Row'],
  | 'id'
  | 'restaurant_id'
  | 'external_account_id'
  | 'external_profile_id'
  | 'external_location_id'
  | 'connection_generation'
  | 'consent_epoch'
  | 'write_state'
  | 'write_state_reason_code'
  | 'last_pull_at'
  | 'last_error'
  | 'updated_at'
>;

export class GbpWriteAccessTransitionError extends Error {
  readonly code: 'GBP_WRITE_ACCESS_UNAVAILABLE' | 'GBP_WRITE_ACCESS_REJECTED';
  readonly status: 409;

  constructor(code: 'GBP_WRITE_ACCESS_UNAVAILABLE' | 'GBP_WRITE_ACCESS_REJECTED') {
    super(
      code === 'GBP_WRITE_ACCESS_UNAVAILABLE'
        ? 'Google Business Profile write access is unavailable.'
        : 'Google Business Profile write access could not be changed.',
    );
    this.name = 'GbpWriteAccessTransitionError';
    this.code = code;
    this.status = 409;
  }
}

const STALE_REFRESH_MS = 30 * 60 * 1_000;
const SAFE_CODE = /^[a-z0-9_:-]{1,100}$/;

function writeState(value: string): GbpConnectionStateResponseV1['writeState'] {
  if (
    value === 'blocked' ||
    value === 'eligible' ||
    value === 'revoking' ||
    value === 'disconnected' ||
    value === 'reauth_required'
  ) {
    return value;
  }
  return 'blocked';
}

function fence(profile: Profile): GoogleNotificationParticipationFence | null {
  if (
    !profile.external_account_id ||
    !profile.external_profile_id ||
    !profile.external_location_id
  ) {
    return null;
  }
  return {
    restaurantId: profile.restaurant_id,
    externalProfileRowId: profile.id,
    externalAccountId: profile.external_account_id,
    externalProfileId: profile.external_profile_id,
    externalLocationId: profile.external_location_id,
    connectionGeneration: profile.connection_generation,
    consentEpoch: profile.consent_epoch,
  };
}

async function readProfile(
  client: SupabaseClient<Database>,
  restaurantId: string,
): Promise<Profile | null> {
  const result = await client
    .from('restaurant_external_profiles')
    .select(
      'id,restaurant_id,external_account_id,external_profile_id,external_location_id,connection_generation,consent_epoch,write_state,write_state_reason_code,last_pull_at,last_error,updated_at',
    )
    .eq('restaurant_id', restaurantId)
    .eq('provider', 'google_business_profile')
    .maybeSingle();
  if (result.error) throw result.error;
  return result.data;
}

export async function setGbpOperatorWriteAccess(input: {
  readonly client: SupabaseClient<Database>;
  readonly restaurantId: string;
  readonly actorUserId: string;
  readonly enabled: boolean;
}): Promise<void> {
  const profile = await readProfile(input.client, input.restaurantId);
  const currentFence = profile ? fence(profile) : null;
  if (!currentFence) {
    throw new GbpWriteAccessTransitionError('GBP_WRITE_ACCESS_UNAVAILABLE');
  }

  const result = await input.client.rpc('set_gbp_write_access_v1', {
    p_restaurant_id: currentFence.restaurantId,
    p_external_profile_row_id: currentFence.externalProfileRowId,
    p_external_account_id: currentFence.externalAccountId,
    p_external_profile_id: currentFence.externalProfileId,
    p_external_location_id: currentFence.externalLocationId,
    p_connection_generation: currentFence.connectionGeneration,
    p_consent_epoch: currentFence.consentEpoch,
    p_enabled: input.enabled,
    p_actor_user_id: input.actorUserId,
  });
  if (!result.error) return;
  if (
    result.error.code === '42501' ||
    result.error.code === 'P0002' ||
    result.error.code === 'PGRST116'
  ) {
    throw new GbpWriteAccessTransitionError('GBP_WRITE_ACCESS_REJECTED');
  }
  throw result.error;
}

async function readRollout(input: {
  readonly client: SupabaseClient<Database>;
  readonly restaurantId: string;
  readonly now: string;
}) {
  const config = await input.client
    .from('gbp_write_rollout_config_v1')
    .select('rollout_mode')
    .eq('provider', 'google_business_profile')
    .maybeSingle();
  if (config.error) throw config.error;
  const mode =
    config.data?.rollout_mode ??
    getDualSyncRuntimeControls({ restaurantId: input.restaurantId }).writeRolloutMode;
  if (mode === 'on') {
    return { eligible: true as const, cohort: 'all', evaluatedAt: input.now };
  }
  if (mode === 'canary' || mode === 'allowlist') {
    const table = mode === 'canary' ? 'gbp_write_canary_restaurants_v1' : 'gbp_write_allowlist_v1';
    const member = await input.client
      .from(table)
      .select('restaurant_id')
      .eq('restaurant_id', input.restaurantId)
      .eq('enabled', true)
      .maybeSingle();
    if (member.error) throw member.error;
    if (member.data) {
      return { eligible: true as const, cohort: mode, evaluatedAt: input.now };
    }
    return {
      eligible: false as const,
      reason: mode === 'canary' ? 'not_in_canary' : 'not_in_allowlist',
      evaluatedAt: input.now,
    };
  }
  return { eligible: false as const, reason: 'rollout_off', evaluatedAt: input.now };
}

async function readPendingUpdates(input: {
  readonly client: SupabaseClient<Database>;
  readonly restaurantId: string;
  readonly profile: Profile | null;
  readonly now: string;
}): Promise<GbpPendingUpdatesResponseV1> {
  const currentFence = input.profile ? fence(input.profile) : null;
  if (!currentFence) {
    return gbpPendingUpdatesResponseV1Schema.parse({
      version: 'v1',
      restaurantId: input.restaurantId,
      state: 'none',
    });
  }
  const rows = await readGoogleUpdateOverlays({
    client: input.client,
    fence: currentFence,
    now: input.now,
  });
  if (rows.length === 0) {
    return gbpPendingUpdatesResponseV1Schema.parse({
      version: 'v1',
      restaurantId: input.restaurantId,
      state: 'none',
    });
  }
  const locationMasks = [...new Set(rows.flatMap((row) => row.location_masks))].sort();
  const attributePaths = [...new Set(rows.flatMap((row) => row.attribute_paths))].sort();
  const observedAt = rows.map((row) => row.observed_at).sort()[0]!;
  const expiresAt = rows.map((row) => row.expires_at).sort()[0]!;
  const overlay = buildGoogleUpdateOverlay({
    location: { diffMasks: locationMasks, pendingMasks: [] },
    attributes: { diffMasks: attributePaths, pendingMasks: [] },
  });
  if (overlay.state === 'display_only') {
    return gbpPendingUpdatesResponseV1Schema.parse({
      version: 'v1',
      restaurantId: input.restaurantId,
      state: 'unknown',
      observedAt,
      expiresAt,
      locationMasks: [],
      attributePaths: [],
      unknownPaths: overlay.displayOnlyPaths,
    });
  }
  return gbpPendingUpdatesResponseV1Schema.parse({
    version: 'v1',
    restaurantId: input.restaurantId,
    state: 'known',
    observedAt,
    expiresAt,
    locationMasks,
    attributePaths,
  });
}

async function readNotifications(input: {
  readonly client: SupabaseClient<Database>;
  readonly profile: Profile | null;
}) {
  const currentFence = input.profile ? fence(input.profile) : null;
  if (!currentFence) return { enabled: false as const, refCount: 0 };
  const link = await input.client
    .from('gbp_notification_restaurant_links_v1')
    .select('registry_id')
    .eq('restaurant_id', currentFence.restaurantId)
    .eq('external_profile_row_id', currentFence.externalProfileRowId)
    .eq('connection_generation', currentFence.connectionGeneration)
    .eq('consent_epoch', currentFence.consentEpoch)
    .maybeSingle();
  if (link.error) throw link.error;
  if (!link.data) return { enabled: false as const, refCount: 0 };
  const registry = await input.client
    .from('gbp_notification_registries_v1')
    .select('ref_count')
    .eq('id', link.data.registry_id)
    .single();
  if (registry.error) throw registry.error;
  return { enabled: true as const, refCount: registry.data.ref_count };
}

function refreshState(input: {
  readonly profile: Profile | null;
  readonly connection: GoogleBusinessProfileConnectionState;
  readonly now: string;
}): GbpConnectionStateResponseV1['refresh'] {
  if (!input.profile || input.connection.status === 'unlinked') {
    return { status: 'idle', lastAttemptAt: null, lastSucceededAt: null, safeErrorCode: null };
  }
  if (input.profile.last_error) {
    return {
      status: 'failed',
      lastAttemptAt: input.profile.updated_at,
      lastSucceededAt: input.profile.last_pull_at,
      safeErrorCode: 'provider_refresh_failed',
    };
  }
  if (!input.profile.last_pull_at) {
    return { status: 'idle', lastAttemptAt: null, lastSucceededAt: null, safeErrorCode: null };
  }
  const stale = new Date(input.now).getTime() - new Date(input.profile.last_pull_at).getTime();
  return {
    status: stale > STALE_REFRESH_MS ? 'stale' : 'succeeded',
    lastAttemptAt: input.profile.last_pull_at,
    lastSucceededAt: input.profile.last_pull_at,
    safeErrorCode: null,
  };
}

export async function loadGbpOperatorConnectionState(input: {
  readonly client: SupabaseClient<Database>;
  readonly restaurantId: string;
  readonly connection: GoogleBusinessProfileConnectionState;
  readonly now?: string;
}): Promise<GbpConnectionStateResponseV1> {
  const now = input.now ?? new Date().toISOString();
  const profile = await readProfile(input.client, input.restaurantId);
  const [rollout, pendingUpdates, notifications] = await Promise.all([
    readRollout({ client: input.client, restaurantId: input.restaurantId, now }),
    readPendingUpdates({ client: input.client, restaurantId: input.restaurantId, profile, now }),
    readNotifications({ client: input.client, profile }),
  ]);
  const profileWriteState = profile ? writeState(profile.write_state) : 'disconnected';
  const safeWriteState =
    profileWriteState === 'eligible' && !rollout.eligible ? 'blocked' : profileWriteState;
  const reasonCode =
    profile?.write_state_reason_code && SAFE_CODE.test(profile.write_state_reason_code)
      ? profile.write_state_reason_code
      : profile
        ? null
        : 'not_connected';
  return gbpConnectionStateResponseV1Schema.parse({
    version: 'v1',
    restaurantId: input.restaurantId,
    provider: 'google_business_profile',
    connectionStatus: input.connection.status,
    writeState: safeWriteState,
    connectionGeneration: profile?.connection_generation ?? 1,
    consentEpoch: profile?.consent_epoch ?? 1,
    reasonCode,
    rollout,
    pendingUpdates,
    notifications,
    refresh: refreshState({ profile, connection: input.connection, now }),
  });
}
