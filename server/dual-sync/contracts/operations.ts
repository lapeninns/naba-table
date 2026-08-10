import { z } from 'zod';

import {
  connectionWriteStateV1Schema,
  epochV1Schema,
  eventIdV1Schema,
  executionModeV1Schema,
  grantIdV1Schema,
  locationIdV1Schema,
  REMEDIATION_CONTRACT_VERSION_V1,
  restaurantIdV1Schema,
  sha256V1Schema,
  sortedGoogleMasksV1Schema,
} from './primitives';

const timestampSchema = z.iso.datetime({ offset: true });
const safeCodeSchema = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .regex(/^[a-z0-9_]+$/);

export const previewAcknowledgementV1Schema = z.discriminatedUnion('required', [
  z
    .object({ required: z.literal(false), acknowledged: z.literal(false), fingerprint: z.null() })
    .strict()
    .readonly(),
  z
    .object({ required: z.literal(true), acknowledged: z.boolean(), fingerprint: sha256V1Schema })
    .strict()
    .readonly(),
]);

export const googleMaskUpdateOverlayV1Schema = z
  .object({
    locationId: locationIdV1Schema,
    epoch: epochV1Schema,
    eventId: eventIdV1Schema,
    state: z.enum(['pending', 'applied', 'stale', 'failed']),
    updateMasks: sortedGoogleMasksV1Schema,
    previousStateHash: sha256V1Schema.nullable(),
    observedStateHash: sha256V1Schema,
    observedAt: timestampSchema,
  })
  .strict()
  .readonly();

export const notificationStateV1Schema = z.discriminatedUnion('status', [
  z
    .object({ status: z.literal('not_required') })
    .strict()
    .readonly(),
  z
    .object({ status: z.literal('pending'), notificationId: safeCodeSchema })
    .strict()
    .readonly(),
  z
    .object({ status: z.literal('sent'), notificationId: safeCodeSchema, sentAt: timestampSchema })
    .strict()
    .readonly(),
  z
    .object({
      status: z.literal('failed'),
      notificationId: safeCodeSchema,
      failureCode: safeCodeSchema,
      retryable: z.boolean(),
    })
    .strict()
    .readonly(),
]);

export const rolloutEligibilityV1Schema = z.discriminatedUnion('eligible', [
  z
    .object({ eligible: z.literal(true), cohort: safeCodeSchema, evaluatedAt: timestampSchema })
    .strict()
    .readonly(),
  z
    .object({ eligible: z.literal(false), reason: safeCodeSchema, evaluatedAt: timestampSchema })
    .strict()
    .readonly(),
]);

export const remediationSafeOutcomeV1Schema = z.discriminatedUnion('status', [
  z
    .object({ status: z.literal('accepted'), grantId: grantIdV1Schema })
    .strict()
    .readonly(),
  z
    .object({ status: z.literal('queued'), grantId: grantIdV1Schema, jobId: safeCodeSchema })
    .strict()
    .readonly(),
  z
    .object({ status: z.literal('rejected'), reasonCode: safeCodeSchema })
    .strict()
    .readonly(),
  z
    .object({ status: z.literal('failed'), failureCode: safeCodeSchema })
    .strict()
    .readonly(),
  z
    .object({ status: z.literal('outcome_unknown'), grantId: grantIdV1Schema })
    .strict()
    .readonly(),
]);

export const remediationOpsResponseV1Schema = z
  .object({
    version: z.literal(REMEDIATION_CONTRACT_VERSION_V1),
    restaurantId: restaurantIdV1Schema,
    writeState: connectionWriteStateV1Schema,
    epoch: epochV1Schema,
    rolloutEligibility: rolloutEligibilityV1Schema,
    pendingMasks: sortedGoogleMasksV1Schema,
    notification: notificationStateV1Schema,
    preview: previewAcknowledgementV1Schema,
    executionMode: executionModeV1Schema,
    outcome: remediationSafeOutcomeV1Schema,
  })
  .strict()
  .superRefine((response, context) => {
    if (response.preview.required && !response.preview.acknowledged) {
      context.addIssue({
        code: 'custom',
        path: ['preview'],
        message: 'Required preview is not acknowledged',
      });
    }
    if (!response.rolloutEligibility.eligible && response.writeState === 'write_enabled') {
      context.addIssue({
        code: 'custom',
        path: ['writeState'],
        message: 'Ineligible rollout cannot enable writes',
      });
    }
  })
  .readonly();

const queueBaseSchema = {
  version: z.literal(REMEDIATION_CONTRACT_VERSION_V1),
  restaurantId: restaurantIdV1Schema,
  epoch: epochV1Schema,
};

export const remediationQueueJobV1Schema = z.discriminatedUnion('kind', [
  z
    .object({ ...queueBaseSchema, kind: z.literal('grant_expiry'), grantId: grantIdV1Schema })
    .strict()
    .readonly(),
  z
    .object({
      ...queueBaseSchema,
      kind: z.literal('google_write_dispatch'),
      grantId: grantIdV1Schema,
      requestHash: sha256V1Schema,
    })
    .strict()
    .readonly(),
  z
    .object({
      ...queueBaseSchema,
      kind: z.literal('notification_dispatch'),
      grantId: grantIdV1Schema,
      notificationId: safeCodeSchema,
    })
    .strict()
    .readonly(),
]);

export type PreviewAcknowledgementV1 = z.infer<typeof previewAcknowledgementV1Schema>;
export type GoogleMaskUpdateOverlayV1 = z.infer<typeof googleMaskUpdateOverlayV1Schema>;
export type NotificationStateV1 = z.infer<typeof notificationStateV1Schema>;
export type RolloutEligibilityV1 = z.infer<typeof rolloutEligibilityV1Schema>;
export type RemediationSafeOutcomeV1 = z.infer<typeof remediationSafeOutcomeV1Schema>;
export type RemediationOpsResponseV1 = z.infer<typeof remediationOpsResponseV1Schema>;
export type RemediationQueueJobV1 = z.infer<typeof remediationQueueJobV1Schema>;
