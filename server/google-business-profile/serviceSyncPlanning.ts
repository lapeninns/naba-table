import { GoogleBusinessProfileError } from './errors';

import type { CoreSyncDirection } from './core-sync';
import type { Database } from '@/types/supabase';

type ProviderTimestampFields = Pick<
  Database['public']['Tables']['restaurant_external_profiles']['Row'],
  'last_pull_at' | 'last_push_at'
>;

const SERVICE_PERIODS_PUSH_UNAVAILABLE_MESSAGE =
  'This Google Business Profile location does not expose a writable kitchen more-hours type yet, so service periods can only be pulled from GBP for now.';

export function createGoogleServicePeriodsPushUnavailableError(): GoogleBusinessProfileError {
  return new GoogleBusinessProfileError(SERVICE_PERIODS_PUSH_UNAVAILABLE_MESSAGE, {
    code: 'GBP_SERVICE_PERIODS_PUSH_UNAVAILABLE',
    status: 409,
  });
}

export function assertGoogleServicePeriodsPushCapability(canPush: boolean): void {
  if (!canPush) {
    throw createGoogleServicePeriodsPushUnavailableError();
  }
}

export function assertGoogleServicePeriodsPushPatch<TPatch>(patch: TPatch | null): TPatch {
  if (!patch) {
    throw createGoogleServicePeriodsPushUnavailableError();
  }

  return patch;
}

export function resolveRequestedDirection(params: {
  requestedDirection?: CoreSyncDirection;
  coreUpdatedAt: string | null;
  providerUpdatedAt: string | null;
}): CoreSyncDirection {
  if (params.requestedDirection) {
    return params.requestedDirection;
  }

  const coreTime = params.coreUpdatedAt ? new Date(params.coreUpdatedAt).getTime() : Number.NaN;
  const providerTime = params.providerUpdatedAt
    ? new Date(params.providerUpdatedAt).getTime()
    : Number.NaN;

  if (Number.isFinite(coreTime) && Number.isFinite(providerTime)) {
    return coreTime > providerTime ? 'push_to_gbp' : 'pull_from_gbp';
  }

  if (Number.isFinite(coreTime)) {
    return 'push_to_gbp';
  }

  return 'pull_from_gbp';
}

export function getProviderReferenceUpdatedAt(
  externalProfile: ProviderTimestampFields | null | undefined,
): string | null {
  const timestamps = [externalProfile?.last_pull_at ?? null, externalProfile?.last_push_at ?? null]
    .map((value) => ({
      value,
      time: value ? new Date(value).getTime() : Number.NaN,
    }))
    .filter((entry) => Number.isFinite(entry.time));

  if (timestamps.length === 0) {
    return null;
  }

  timestamps.sort((left, right) => right.time - left.time);
  return timestamps[0]?.value ?? null;
}
