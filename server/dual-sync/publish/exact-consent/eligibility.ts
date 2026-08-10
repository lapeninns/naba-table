import { ExactConsentError } from './types';

import type { ExactConsentListing, ExactConsentPreview } from './types';

function sameListing(left: ExactConsentListing, right: ExactConsentListing): boolean {
  return (
    left.restaurantId === right.restaurantId &&
    left.externalProfileRowId === right.externalProfileRowId &&
    left.accountId === right.accountId &&
    left.profileId === right.profileId &&
    left.locationId === right.locationId &&
    left.connectionGeneration === right.connectionGeneration &&
    left.consentEpoch === right.consentEpoch
  );
}

export function assertExactConsentEligibility(input: {
  readonly preview: ExactConsentPreview;
  readonly currentListing: ExactConsentListing;
  readonly writeState: 'blocked' | 'eligible' | 'revoking' | 'disconnected' | 'reauth_required';
  readonly paused: boolean;
  readonly rolloutEligible: boolean;
  readonly readinessProven: boolean;
  readonly flags: {
    readonly exportEnabled: boolean;
    readonly highRiskExportsEnabled: boolean;
    readonly menuSyncEnabled: boolean;
    readonly attributesSyncEnabled: boolean;
  };
}): void {
  if (
    input.writeState !== 'eligible' ||
    !sameListing(input.preview.listing, input.currentListing)
  ) {
    throw new ExactConsentError(
      'GBP_CONNECTION_INELIGIBLE',
      'The Google connection is stale or not eligible for writes.',
    );
  }
  if (input.paused) {
    throw new ExactConsentError('GBP_SYNC_PAUSED', 'Google synchronization is paused.');
  }
  if (!input.rolloutEligible) {
    throw new ExactConsentError(
      'GBP_ROLLOUT_INELIGIBLE',
      'This restaurant is not eligible for the Google write rollout.',
    );
  }
  if (!input.readinessProven) {
    throw new ExactConsentError(
      'GBP_READINESS_UNPROVEN',
      'Google write readiness has not been proven for the current policy.',
    );
  }
  const hasHighRisk = input.preview.groups.some(
    (group) => group.riskLevel === 'high' || group.riskLevel === 'critical',
  );
  const hasMenus = input.preview.groups.some((group) => group.updateMasks.includes('menus'));
  const hasAttributes = input.preview.groups.some((group) =>
    group.updateMasks.includes('attributes'),
  );
  if (
    !input.flags.exportEnabled ||
    (hasHighRisk && !input.flags.highRiskExportsEnabled) ||
    (hasMenus && !input.flags.menuSyncEnabled) ||
    (hasAttributes && !input.flags.attributesSyncEnabled)
  ) {
    throw new ExactConsentError(
      'GBP_RUNTIME_FLAG_DISABLED',
      'A runtime safety flag required by this Google write plan is disabled.',
    );
  }
}
