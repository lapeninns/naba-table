'use client';

import {
  latestTimestamp,
  recommendedDirection,
} from './googleBusinessProfileVerificationComparators';
import {
  buildProfileVerificationFields,
  getProfileProviderValues,
  getProfileVerificationWarnings,
  getUnavailableProfileFields,
} from './googleBusinessProfileVerificationModel';

import type {
  ProfileFieldVerification,
  ProfileVerificationFields,
  VerificationSummary,
} from './googleBusinessProfileVerificationModel';
import type {
  GoogleBusinessProfileConnection,
  RestaurantProfile,
} from '@/services/ops/restaurants';

export type {
  ComparisonTooltipDetails,
  CoreVerificationStatus,
  ProfileFieldVerification,
  ProfileVerificationFieldKey,
  ProfileVerificationFields,
  VerificationSummary,
} from './googleBusinessProfileVerificationModel';

export function deriveProfileVerification(params: {
  profile: RestaurantProfile | null | undefined;
  connection: GoogleBusinessProfileConnection | null | undefined;
}): VerificationSummary & {
  fields: ProfileVerificationFields;
} {
  if (!params.profile || !params.connection || params.connection.status !== 'linked') {
    return {
      status: 'unavailable',
      summary: 'Connect and sync Google Business Profile to verify core profile fields.',
      recommendedDirection: null,
      canPull: false,
      canPush: false,
      warnings: [],
      fields: getUnavailableProfileFields(),
    };
  }

  const providerValues = getProfileProviderValues(params.connection);
  const fields = buildProfileVerificationFields(params.profile, providerValues);
  const comparableFields = Object.values(fields).filter(
    (field: ProfileFieldVerification) => field.status !== 'unavailable',
  );
  const driftedCount = comparableFields.filter((field) => field.status === 'drifted').length;
  const status =
    comparableFields.length === 0 ? 'unavailable' : driftedCount === 0 ? 'verified' : 'drifted';
  const canPull = Object.values(fields).some(
    (field) => field.canPull && field.status !== 'verified',
  );
  const canPush = Object.values(fields).some(
    (field) => field.canPush && field.status !== 'verified',
  );

  return {
    status,
    summary:
      status === 'verified'
        ? 'Core restaurant profile fields currently match Google Business Profile.'
        : status === 'drifted'
          ? `${driftedCount} profile field${driftedCount === 1 ? '' : 's'} differ from Google Business Profile.`
          : 'Google Business Profile does not currently expose matching profile data for this section.',
    recommendedDirection: recommendedDirection({
      coreUpdatedAt: params.profile.updatedAt,
      providerUpdatedAt: latestTimestamp(
        params.connection.lastPullAt,
        params.connection.lastPushAt,
      ),
      canPull,
      canPush,
    }),
    canPull,
    canPush,
    warnings: getProfileVerificationWarnings(fields, providerValues, params.profile),
    fields,
  };
}
