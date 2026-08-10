import {
  buildGoogleBusinessProfileFoodMenusName,
  getGoogleBusinessProfileFoodMenus,
} from '@/server/google-business-profile/client';
import { hashGoogleFoodMenusResource } from '@/server/google-business-profile/food-menus';
import { prepareFoodMenusProjection } from '@/server/google-business-profile/food-menus-projection-service';
import {
  createGoogleFoodMenusMutationClient,
  createGoogleListingMutationClient,
  isGoogleWritePreDispatchError,
} from '@/server/google-business-profile/mutationClients';
import { getLinkedExternalProfileWithLocation } from '@/server/google-business-profile/serviceLinkedLocationRuntime';
import { isGoogleWriteOutcomeUnknownError } from '@/server/google-business-profile/writePermit';

import { buildPublishPlan } from '../planner';
import { readPublishPlannerRuntime } from '../planner-runtime';
import { buildExactConsentPreview } from './preview';
import { ExactConsentExecutionError } from './types';
import { buildGoogleStorefrontAddressPatch } from '../ports/google-patch-builders';

import type { DualSyncRunPublishInput } from '../types';
import type { GoogleWritePermit } from '@/server/google-business-profile/writePermit';
import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

type DbClient = SupabaseClient<Database>;
const SUPPORTED_FIELDS = new Set(['profile.address', 'profile.businessDescription']);
const FOOD_MENUS_PREFIX = 'foodMenus.items.';

export class ExactConsentUnsupportedPlanError extends Error {
  readonly code = 'GBP_EXACT_CONSENT_UNSUPPORTED_PLAN';
  readonly status = 422;
}

function requireText(value: string | null, label: string): string {
  if (!value) throw new ExactConsentUnsupportedPlanError(`Google ${label} is not linked.`);
  return value;
}

export async function buildSupportedExactConsentPlan(input: {
  readonly client: DbClient;
  readonly publish: DualSyncRunPublishInput;
  readonly clock?: () => Date;
}) {
  const runtime = await readPublishPlannerRuntime({
    client: input.client,
    restaurantId: input.publish.restaurantId,
  });
  const plan = await buildPublishPlan(input.client, input.publish, {
    readCoreSnapshot: async () => runtime.coreSnapshot,
    readGbpSnapshot: async () => runtime.gbpSnapshot,
  });
  if (plan.rejected.length > 0 || plan.groups.length !== 1) {
    throw new ExactConsentUnsupportedPlanError(
      plan.rejected[0]?.failure.message ?? 'The exact write must contain one supported group.',
    );
  }
  const group = plan.groups[0];
  const profileGroup =
    group?.sectionKey === 'profile' &&
    group.fields.every((decision) => SUPPORTED_FIELDS.has(decision.fieldKey));
  const foodMenusGroup =
    group?.sectionKey === 'foodMenus' &&
    group.fields.every((decision) => decision.fieldKey.startsWith(FOOD_MENUS_PREFIX));
  if (!group || group.direction !== 'export_to_google' || (!profileGroup && !foodMenusGroup)) {
    throw new ExactConsentUnsupportedPlanError(
      'This field group does not yet have an exact Google request renderer.',
    );
  }
  const linked = await getLinkedExternalProfileWithLocation(
    input.publish.restaurantId,
    input.client,
  );
  const external = linked.externalProfile;
  const accountId = requireText(external.external_account_id, 'account');
  const locationId = requireText(external.external_location_id, 'location');
  const patch: Record<string, unknown> = {};
  const updateMasks: string[] = [];
  for (const decision of profileGroup ? group.fields : []) {
    if (decision.fieldKey === 'profile.address') {
      patch.storefrontAddress = buildGoogleStorefrontAddressPatch({
        nabatableAddress: runtime.coreSnapshot.profile.address,
        googleAddress: runtime.gbpSnapshot.profile.storefrontAddress,
      });
      updateMasks.push('storefrontAddress');
    }
    if (decision.fieldKey === 'profile.businessDescription') {
      patch.profile = { description: runtime.coreSnapshot.profile.businessDescription ?? '' };
      updateMasks.push('profile');
    }
  }
  let projectionHash: string | null = null;
  let baselineHash: string | null = null;
  if (foodMenusGroup) {
    const foodMenusName = buildGoogleBusinessProfileFoodMenusName(accountId, locationId);
    const [projection, baseline] = await Promise.all([
      prepareFoodMenusProjection({
        client: input.client,
        restaurantId: input.publish.restaurantId,
        foodMenusName,
        externalProfileId: external.id,
        createdByUserId: input.publish.actorUserId,
        source: 'preflight',
        persist: false,
      }),
      getGoogleBusinessProfileFoodMenus(linked.accessToken, foodMenusName, {
        readMask: ['name', 'menus'],
      }),
    ]);
    Object.assign(patch, projection.projection.foodMenus);
    projectionHash = projection.projectionHash;
    baselineHash = hashGoogleFoodMenusResource(baseline);
    updateMasks.push('menus');
  }
  const fields = group.fields.map((decision) => decision.fieldKey);
  const beforeCore = Object.fromEntries(
    fields.map((field) => [
      field,
      foodMenusGroup
        ? { projectionHash }
        : field === 'profile.address'
          ? runtime.coreSnapshot.profile.address
          : runtime.coreSnapshot.profile.businessDescription,
    ]),
  );
  const beforeGoogle = Object.fromEntries(
    fields.map((field) => [
      field,
      foodMenusGroup
        ? { baselineHash }
        : field === 'profile.address'
          ? runtime.gbpSnapshot.profile.storefrontAddress
          : runtime.gbpSnapshot.profile.businessDescription,
    ]),
  );
  const preview = buildExactConsentPreview(
    {
      listing: {
        restaurantId: input.publish.restaurantId,
        externalProfileRowId: external.id,
        accountId,
        profileId: requireText(external.external_profile_id, 'profile'),
        locationId,
        connectionGeneration: external.connection_generation,
        consentEpoch: external.consent_epoch,
      },
      snapshotPins: { core: runtime.coreSnapshotHash, google: runtime.gbpSnapshotHash },
      decisions: group.fields.map((decision) => ({ ...decision })),
      groups: [
        {
          groupId: group.groupId,
          writeGroup: group.writeGroup,
          fieldKeys: fields,
          method: 'PATCH',
          resource: foodMenusGroup
            ? buildGoogleBusinessProfileFoodMenusName(accountId, locationId)
            : `locations/${locationId}`,
          updateMasks,
          before: { core: beforeCore, google: beforeGoogle },
          after: { core: beforeCore, google: beforeCore },
          request: patch,
          warnings: plan.warnings.map((warning) => warning.message),
          riskLevel: group.riskLevel,
          fullReplacement: foodMenusGroup || group.destructiveWritePossible,
        },
      ],
    },
    { clock: input.clock },
  );
  const executeImmediate = async (permits: readonly GoogleWritePermit[]) => {
    const permit = permits[0];
    if (!permit || permits.length !== 1) {
      throw new ExactConsentExecutionError('provider_before_dispatch');
    }
    try {
      if (foodMenusGroup) {
        await createGoogleFoodMenusMutationClient({ accessToken: linked.accessToken }).replace({
          permit,
          accountId: preview.listing.accountId,
          locationId: preview.listing.locationId,
          payload: patch,
        });
      } else {
        await createGoogleListingMutationClient({ accessToken: linked.accessToken }).patchLocation({
          permit,
          locationId: preview.listing.locationId,
          updateMasks,
          payload: patch,
        });
      }
    } catch (failure) {
      if (isGoogleWritePreDispatchError(failure)) {
        throw new ExactConsentExecutionError('provider_before_dispatch');
      }
      if (isGoogleWriteOutcomeUnknownError(failure)) {
        throw new ExactConsentExecutionError('provider_after_dispatch');
      }
      throw failure;
    }
    return [{ groupId: group.groupId, status: 'consumed', reasonCode: 'provider_succeeded' }];
  };
  return { preview, executeImmediate, linked, runtime, patch };
}
