import { ExactConsentError } from './types';

import type { DatabaseGoogleWriteQueueEnvelope } from './queue';
import type { ExactConsentPreview } from './types';

function same(left: readonly string[], right: readonly string[]): boolean {
  return left.join('\u0000') === right.join('\u0000');
}

export function assertDatabaseQueueEnvelopeMatchesPreview(input: {
  readonly envelope: DatabaseGoogleWriteQueueEnvelope;
  readonly preview: ExactConsentPreview;
  readonly clock?: () => Date;
}): void {
  const { envelope, preview } = input;
  const listing = preview.listing;
  const identityMatches =
    envelope.restaurant_id === listing.restaurantId &&
    envelope.external_profile_row_id === listing.externalProfileRowId &&
    envelope.external_account_id === listing.accountId &&
    envelope.external_profile_id === listing.profileId &&
    envelope.external_location_id === listing.locationId &&
    envelope.connection_generation === listing.connectionGeneration &&
    envelope.consent_epoch === listing.consentEpoch;
  const topLevelMatches =
    identityMatches &&
    envelope.policy_version === preview.policyVersion &&
    envelope.renderer_version === preview.rendererVersion &&
    envelope.groups.length === preview.groups.length &&
    envelope.groups.every((queued, index) => {
      const current = preview.groups[index];
      return (
        current !== undefined &&
        queued.group_id === current.groupId &&
        queued.write_group === current.writeGroup &&
        same(queued.field_keys, current.fieldKeys) &&
        queued.google_method === current.method &&
        queued.google_resource === current.resource &&
        same(queued.update_masks, current.updateMasks) &&
        same(
          queued.before_hashes,
          current.fieldKeys.map((fieldKey) => current.beforeHashes.google[fieldKey] ?? ''),
        ) &&
        same(
          queued.after_hashes,
          current.fieldKeys.map((fieldKey) => current.afterHashes.google[fieldKey] ?? ''),
        ) &&
        queued.request_hash === current.requestHash &&
        queued.decision_hash === current.decisionHash &&
        queued.core_snapshot_hash === preview.snapshotPins.core &&
        queued.google_snapshot_hash === preview.snapshotPins.google &&
        queued.preview_fingerprint === preview.planFingerprint
      );
    });
  if (!topLevelMatches) {
    throw new ExactConsentError(
      'GBP_QUEUE_STALE',
      'The queued write no longer matches the current exact write plan.',
    );
  }
  if (new Date(envelope.expires_at).getTime() <= (input.clock?.() ?? new Date()).getTime()) {
    throw new ExactConsentError('GBP_PREVIEW_EXPIRED', 'The queued write grant has expired.');
  }
}
