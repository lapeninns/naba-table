import { z } from 'zod';

import { EXACT_CONSENT_VERSION } from './types';

import type { ExactConsentPreview, ExactConsentSideHashes } from './types';

const hashSchema = z.string().regex(/^[a-f0-9]{64}$/);
const hashesSchema = z
  .object({
    core: z.record(z.string().min(1), hashSchema),
    google: z.record(z.string().min(1), hashSchema),
  })
  .strict();
const listingSchema = z
  .object({
    restaurantId: z.string().min(1),
    externalProfileRowId: z.string().min(1),
    accountId: z.string().min(1),
    profileId: z.string().min(1),
    locationId: z.string().min(1),
    connectionGeneration: z.number().int().positive(),
    consentEpoch: z.number().int().positive(),
  })
  .strict();
const queueGroupSchema = z
  .object({
    grantId: z.string().min(1),
    groupId: z.string().min(1),
    fieldKeys: z.array(z.string().min(1)).min(1),
    requestHash: hashSchema,
    decisionHash: hashSchema,
    beforeHashes: hashesSchema,
    afterHashes: hashesSchema,
    updateMasks: z.array(z.string().min(1)).min(1),
  })
  .strict();

export const googleWriteQueueEnvelopeSchema = z
  .object({
    confirmationVersion: z.literal(EXACT_CONSENT_VERSION),
    bundleId: z.string().min(1),
    listing: listingSchema,
    snapshotPins: z.object({ core: hashSchema, google: hashSchema }).strict(),
    planFingerprint: hashSchema,
    policyVersion: z.string().min(1),
    rendererVersion: z.string().min(1),
    expiresAt: z.iso.datetime({ offset: true }),
    groups: z.array(queueGroupSchema).min(1),
  })
  .strict();

const databaseQueueGroupSchema = z
  .object({
    group_id: z.string().min(1),
    grant_id: z.string().min(1),
    bundle_order: z.number().int().positive(),
    write_group: z.string().min(1),
    field_keys: z.array(z.string().min(1)).min(1),
    google_method: z.enum(['PATCH', 'POST', 'DELETE']),
    google_resource: z.string().min(1),
    update_masks: z.array(z.string().min(1)).min(1),
    update_masks_hash: hashSchema,
    before_hashes: z.array(hashSchema).min(1),
    after_hashes: z.array(hashSchema).min(1),
    request_hash: hashSchema,
    decision_hash: hashSchema,
    core_snapshot_hash: hashSchema,
    google_snapshot_hash: hashSchema,
    preview_fingerprint: hashSchema,
    manifest_hash: hashSchema,
  })
  .strict();

export const databaseGoogleWriteQueueEnvelopeSchema = z
  .object({
    confirmation_version: z.literal(EXACT_CONSENT_VERSION),
    restaurant_id: z.string().min(1),
    external_profile_row_id: z.string().min(1),
    external_account_id: z.string().min(1),
    external_profile_id: z.string().min(1),
    external_location_id: z.string().min(1),
    connection_generation: z.number().int().positive(),
    consent_epoch: z.number().int().positive(),
    bundle_id: z.string().min(1),
    bundle_hash: hashSchema,
    grant_ids: z.array(z.string().min(1)).min(1),
    manifest_hashes: z.array(hashSchema).min(1),
    policy_version: z.string().min(1),
    renderer_version: z.string().min(1),
    expires_at: z.iso.datetime({ offset: true }),
    groups: z.array(databaseQueueGroupSchema).min(1),
  })
  .strict()
  .superRefine((envelope, context) => {
    const orderedIds = envelope.groups.map((group) => group.grant_id);
    const orderedManifests = envelope.groups.map((group) => group.manifest_hash);
    if (orderedIds.join(',') !== envelope.grant_ids.join(',')) {
      context.addIssue({ code: 'custom', path: ['grant_ids'], message: 'Grant order mismatch' });
    }
    if (orderedManifests.join(',') !== envelope.manifest_hashes.join(',')) {
      context.addIssue({
        code: 'custom',
        path: ['manifest_hashes'],
        message: 'Manifest order mismatch',
      });
    }
    if (envelope.groups.some((group, index) => group.bundle_order !== index + 1)) {
      context.addIssue({ code: 'custom', path: ['groups'], message: 'Bundle order mismatch' });
    }
  });

export type DatabaseGoogleWriteQueueEnvelope = z.infer<
  typeof databaseGoogleWriteQueueEnvelopeSchema
>;

export type GoogleWriteQueueEnvelope = {
  readonly confirmationVersion: typeof EXACT_CONSENT_VERSION;
  readonly bundleId: string;
  readonly listing: ExactConsentPreview['listing'];
  readonly snapshotPins: ExactConsentPreview['snapshotPins'];
  readonly planFingerprint: string;
  readonly policyVersion: string;
  readonly rendererVersion: string;
  readonly expiresAt: string;
  readonly groups: readonly {
    readonly grantId: string;
    readonly groupId: string;
    readonly fieldKeys: readonly string[];
    readonly requestHash: string;
    readonly decisionHash: string;
    readonly beforeHashes: ExactConsentSideHashes;
    readonly afterHashes: ExactConsentSideHashes;
    readonly updateMasks: readonly string[];
  }[];
};

export function buildGoogleWriteQueuePayload(input: {
  readonly bundleId: string;
  readonly grantIds: readonly string[];
  readonly preview: ExactConsentPreview;
}): { readonly maxAttempts: 1; readonly envelope: GoogleWriteQueueEnvelope } {
  if (input.grantIds.length !== input.preview.groups.length) {
    throw new RangeError('Each exact-consent group requires exactly one grant id.');
  }
  return Object.freeze({
    maxAttempts: 1,
    envelope: Object.freeze({
      confirmationVersion: EXACT_CONSENT_VERSION,
      bundleId: input.bundleId,
      listing: input.preview.listing,
      snapshotPins: input.preview.snapshotPins,
      planFingerprint: input.preview.planFingerprint,
      policyVersion: input.preview.policyVersion,
      rendererVersion: input.preview.rendererVersion,
      expiresAt: input.preview.expiresAt,
      groups: Object.freeze(
        input.preview.groups.map((group, index) => ({
          grantId: input.grantIds[index] ?? '',
          groupId: group.groupId,
          fieldKeys: group.fieldKeys,
          requestHash: group.requestHash,
          decisionHash: group.decisionHash,
          beforeHashes: group.beforeHashes,
          afterHashes: group.afterHashes,
          updateMasks: group.updateMasks,
        })),
      ),
    }),
  });
}

export function parseGoogleWriteQueueEnvelope(input: unknown): GoogleWriteQueueEnvelope {
  return googleWriteQueueEnvelopeSchema.parse(input);
}

export function parseDatabaseGoogleWriteQueueEnvelope(
  input: unknown,
): DatabaseGoogleWriteQueueEnvelope {
  return databaseGoogleWriteQueueEnvelopeSchema.parse(input);
}
