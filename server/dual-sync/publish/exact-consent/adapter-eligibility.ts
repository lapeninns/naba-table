import { getLinkedExternalProfileWithLocation } from '@/server/google-business-profile/serviceLinkedLocationRuntime';

import { getGoogleUpdatesClient } from './adapter-read-client';
import { getDualSyncRestaurantControl } from '../../controls';
import { runWithDualSyncLock } from '../../locks';
import { getDualSyncRuntimeControls } from '../../runtime-controls';

import type { ExactConsentGoogleUpdates, ExactConsentPreview } from './types';
import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

type DbClient = SupabaseClient<Database>;

function requireText(value: string | null, label: string): string {
  if (!value) throw new Error(`Google ${label} is not linked.`);
  return value;
}

export async function readSupportedExactConsentEligibility(input: {
  readonly client: DbClient;
  readonly preview: ExactConsentPreview;
}) {
  const linked = await getLinkedExternalProfileWithLocation(
    input.preview.listing.restaurantId,
    input.client,
  );
  const controls = getDualSyncRuntimeControls({ restaurantId: input.preview.listing.restaurantId });
  const control = await getDualSyncRestaurantControl({
    client: input.client,
    restaurantId: input.preview.listing.restaurantId,
  });
  const now = new Date().toISOString();
  const [{ data: rollout }, { data: readiness }] = await Promise.all([
    input.client
      .from('gbp_write_rollout_config_v1')
      .select('rollout_mode')
      .eq('provider', 'google_business_profile')
      .maybeSingle(),
    input.client
      .from('gbp_write_readiness_evidence_v1')
      .select('id')
      .eq('provider', 'google_business_profile')
      .eq('policy_version', input.preview.policyVersion)
      .eq('renderer_version', input.preview.rendererVersion)
      .gt('valid_until', now)
      .limit(1),
  ]);
  const mode = rollout?.rollout_mode ?? controls.writeRolloutMode;
  let rolloutEligible = mode === 'on';
  if (mode === 'canary') {
    const { data } = await input.client
      .from('gbp_write_canary_restaurants_v1')
      .select('restaurant_id')
      .eq('restaurant_id', input.preview.listing.restaurantId)
      .eq('enabled', true)
      .maybeSingle();
    rolloutEligible = Boolean(data);
  } else if (mode === 'allowlist') {
    const { data } = await input.client
      .from('gbp_write_allowlist_v1')
      .select('restaurant_id')
      .eq('restaurant_id', input.preview.listing.restaurantId)
      .eq('enabled', true)
      .maybeSingle();
    rolloutEligible = Boolean(data);
  }
  const external = linked.externalProfile;
  return {
    currentListing: {
      restaurantId: external.restaurant_id,
      externalProfileRowId: external.id,
      accountId: requireText(external.external_account_id, 'account'),
      profileId: requireText(external.external_profile_id, 'profile'),
      locationId: requireText(external.external_location_id, 'location'),
      connectionGeneration: external.connection_generation,
      consentEpoch: external.consent_epoch,
    },
    writeState:
      external.write_state === 'write_enabled' ? ('eligible' as const) : ('blocked' as const),
    paused: control.syncPaused,
    rolloutEligible,
    readinessProven: Boolean(readiness?.length),
    flags: controls,
  };
}

export async function readSupportedGoogleUpdates(input: {
  readonly accessToken: string;
  readonly preview: ExactConsentPreview;
}): Promise<ExactConsentGoogleUpdates> {
  const updates = await getGoogleUpdatesClient(input.accessToken).getLocation(
    input.preview.listing.locationId,
    input.preview.groups.flatMap((group) => group.updateMasks),
  );
  return { location: { diffMask: updates.diffMask, pendingMask: updates.pendingMask } };
}

export function withExactConsentListingLock<T>(
  client: DbClient,
  restaurantId: string,
  work: () => Promise<T>,
) {
  return runWithDualSyncLock({ client, restaurantId, jobKind: 'publish_batch' }, work);
}
