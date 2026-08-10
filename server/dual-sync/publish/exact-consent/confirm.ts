import { masksOverlap } from '@/server/google-business-profile/googleUpdates';

import { previewFingerprintProjection } from './preview';
import { parseExactConsentPreview } from './schema';
import { ExactConsentError } from './types';
import { hashCanonicalJson } from '../../hashing';

import type {
  ExactConsentGoogleUpdates,
  ExactConsentPreview,
  ExactConsentRiskAcknowledgement,
} from './types';
import type { NormalizedGoogleMasks } from '@/server/google-business-profile/googleUpdates';

const BASE_RISKS = [
  'external_write',
  'outcome_may_be_unknown',
  'partial_bundle_failure',
] as const satisfies readonly ExactConsentRiskAcknowledgement[];

function projectionHash(preview: ExactConsentPreview): string {
  return hashCanonicalJson(previewFingerprintProjection(preview)) ?? '';
}

function assertExactPreview(submitted: ExactConsentPreview, rebuilt: ExactConsentPreview): void {
  const submittedHash = projectionHash(submitted);
  if (
    submitted.planFingerprint !== submittedHash ||
    submitted.planFingerprint !== rebuilt.planFingerprint ||
    submittedHash !== projectionHash(rebuilt) ||
    submitted.issuedAt !== rebuilt.issuedAt ||
    submitted.expiresAt !== rebuilt.expiresAt
  ) {
    throw new ExactConsentError(
      'GBP_PREVIEW_MISMATCH',
      'The confirmed preview does not exactly match the current write plan.',
    );
  }
}

function unknownPaths(masks: readonly NormalizedGoogleMasks[]): readonly string[] {
  return masks.flatMap((mask) => (mask.kind === 'unknown' ? mask.unknownPaths : []));
}

function knownPaths(masks: readonly NormalizedGoogleMasks[]): readonly string[] {
  return masks.flatMap((mask) => (mask.kind === 'known' ? mask.masks : []));
}

export function assertExactConsentGoogleUpdatesSafe(
  preview: ExactConsentPreview,
  updates: ExactConsentGoogleUpdates,
): void {
  const locationMasks = [updates.location.diffMask, updates.location.pendingMask];
  if (unknownPaths(locationMasks).length > 0) {
    throw new ExactConsentError(
      'GBP_UNKNOWN_UPDATE_MASK',
      'Google returned an update path that this deployment cannot safely classify.',
    );
  }
  const pendingLocation = knownPaths(locationMasks);
  for (const group of preview.groups) {
    if (group.updateMasks.includes('attributes')) {
      if (!updates.attributes) {
        throw new ExactConsentError(
          'GBP_ATTRIBUTES_COMPARISON_REQUIRED',
          'Attribute writes require a separate fresh Google attribute comparison.',
        );
      }
      const attributeMasks = [updates.attributes.diffMask, updates.attributes.pendingMask];
      if (unknownPaths(attributeMasks).length > 0) {
        throw new ExactConsentError(
          'GBP_UNKNOWN_UPDATE_MASK',
          'Google returned an unknown attribute update path.',
        );
      }
      if (
        group.updateMasks.some((mask) =>
          knownPaths(attributeMasks).some((pending) => masksOverlap(mask, pending)),
        )
      ) {
        throw new ExactConsentError(
          'GBP_UPDATE_MASK_CONFLICT',
          'Google attributes changed while this preview was being confirmed.',
        );
      }
      continue;
    }
    if (
      group.updateMasks.some((mask) =>
        pendingLocation.some((pending) => masksOverlap(mask, pending)),
      )
    ) {
      throw new ExactConsentError(
        'GBP_UPDATE_MASK_CONFLICT',
        'Google changed an overlapping field while this preview was being confirmed.',
      );
    }
  }
}

export function confirmExactConsentPreview(input: {
  readonly submitted: unknown;
  readonly rebuilt: ExactConsentPreview;
  readonly acknowledged: boolean;
  readonly riskAcknowledgements: readonly ExactConsentRiskAcknowledgement[];
  readonly googleUpdates: ExactConsentGoogleUpdates;
  readonly clock?: () => Date;
}): ExactConsentPreview {
  const submitted = parseExactConsentPreview(input.submitted);
  if (!input.acknowledged) {
    throw new ExactConsentError(
      'GBP_ACKNOWLEDGEMENT_REQUIRED',
      'The exact write preview must be acknowledged.',
    );
  }
  if (new Date(submitted.expiresAt).getTime() <= (input.clock?.() ?? new Date()).getTime()) {
    throw new ExactConsentError('GBP_PREVIEW_EXPIRED', 'The exact write preview has expired.');
  }
  const requiredRisks: readonly ExactConsentRiskAcknowledgement[] = input.rebuilt.groups.some(
    (group) => group.fullReplacement,
  )
    ? [...BASE_RISKS, 'destructive_full_replacement']
    : BASE_RISKS;
  if (!requiredRisks.every((risk) => input.riskAcknowledgements.includes(risk))) {
    throw new ExactConsentError(
      'GBP_RISK_ACKNOWLEDGEMENT_REQUIRED',
      'Every risk acknowledgement required by this write plan must be accepted.',
    );
  }
  assertExactPreview(submitted, input.rebuilt);
  assertExactConsentGoogleUpdatesSafe(input.rebuilt, input.googleUpdates);
  return input.rebuilt;
}
