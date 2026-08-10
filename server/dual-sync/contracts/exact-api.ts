import { DateTime } from 'luxon';
import { z } from 'zod';

import { MAX_GRANT_LIFETIME_MS, sha256V1Schema } from './primitives';

export type OperatorApiClockV1 = () => Date;

const timestampSchema = z.iso.datetime({ offset: true });
const identifierSchema = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .regex(/^[A-Za-z0-9._:/-]+$/);
const safeCodeSchema = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .regex(/^[a-z0-9_:-]+$/);
const fieldKeySchema = identifierSchema;
const sortedUniqueSchema = (item: z.ZodString) =>
  z
    .array(item)
    .min(1)
    .refine(
      (values) =>
        values.length === new Set(values).size &&
        values.every((value, index) => index === 0 || values[index - 1] < value),
      'Values must be sorted and unique',
    )
    .readonly();

const displaySidesSchema = z
  .object({
    core: z.record(fieldKeySchema, z.json()).readonly(),
    google: z.record(fieldKeySchema, z.json()).readonly(),
  })
  .strict()
  .readonly();
const hashSidesSchema = z
  .object({
    core: z.record(fieldKeySchema, sha256V1Schema).readonly(),
    google: z.record(fieldKeySchema, sha256V1Schema).readonly(),
  })
  .strict()
  .readonly();

const exactPreviewGroupSchema = z
  .object({
    groupId: identifierSchema,
    writeGroup: identifierSchema,
    direction: z.literal('export_to_google'),
    fieldKeys: sortedUniqueSchema(fieldKeySchema),
    method: z.enum(['PATCH', 'POST', 'DELETE']),
    resource: z
      .string()
      .trim()
      .min(1)
      .max(500)
      .regex(
        /^(?:locations\/[A-Za-z0-9._:/-]+|accounts\/[A-Za-z0-9._:-]+\/locations\/[A-Za-z0-9._:-]+\/foodMenus)$/,
      ),
    updateMasks: sortedUniqueSchema(identifierSchema),
    beforeDisplay: displaySidesSchema,
    afterDisplay: displaySidesSchema,
    beforeHashes: hashSidesSchema,
    afterHashes: hashSidesSchema,
    requestHash: sha256V1Schema,
    decisionHash: sha256V1Schema,
    warnings: z.array(z.string().trim().min(1).max(300)).readonly(),
    riskLevel: z.enum(['low', 'medium', 'high', 'critical']),
    fullReplacement: z.boolean(),
  })
  .strict()
  .superRefine((group, context) => {
    const expected = [...group.fieldKeys];
    const maps = [
      group.beforeDisplay.core,
      group.beforeDisplay.google,
      group.afterDisplay.core,
      group.afterDisplay.google,
      group.beforeHashes.core,
      group.beforeHashes.google,
      group.afterHashes.core,
      group.afterHashes.google,
    ];
    if (maps.some((map) => Object.keys(map).sort().join('\u0000') !== expected.join('\u0000'))) {
      context.addIssue({
        code: 'custom',
        path: ['fieldKeys'],
        message: 'Display and hash keys must exactly match fieldKeys',
      });
    }
  })
  .readonly();

export const gbpExactPreviewResponseV1Schema = z
  .object({
    confirmationVersion: z.literal('gbp-exact-consent-v1'),
    policyVersion: z.literal('gbp-write-policy-v1'),
    rendererVersion: z.literal('gbp-renderer-v1'),
    listing: z
      .object({
        restaurantId: identifierSchema,
        externalProfileRowId: identifierSchema,
        accountId: identifierSchema,
        profileId: identifierSchema,
        locationId: identifierSchema,
        connectionGeneration: z.number().int().positive(),
        consentEpoch: z.number().int().positive(),
      })
      .strict()
      .readonly(),
    snapshotPins: z.object({ core: sha256V1Schema, google: sha256V1Schema }).strict().readonly(),
    groups: z.array(exactPreviewGroupSchema).min(1).readonly(),
    planFingerprint: sha256V1Schema,
    issuedAt: timestampSchema,
    expiresAt: timestampSchema,
  })
  .strict()
  .superRefine((preview, context) => {
    const issuedAt = DateTime.fromISO(preview.issuedAt, { setZone: true }).toMillis();
    const expiresAt = DateTime.fromISO(preview.expiresAt, { setZone: true }).toMillis();
    if (expiresAt <= issuedAt || expiresAt - issuedAt > MAX_GRANT_LIFETIME_MS) {
      context.addIssue({
        code: 'custom',
        path: ['expiresAt'],
        message: 'Exact preview must expire within 15 minutes',
      });
    }
  })
  .readonly();

export function parseGbpExactPreviewResponseV1(
  input: unknown,
  clock: OperatorApiClockV1 = () => new Date(),
) {
  return gbpExactPreviewResponseV1Schema
    .superRefine((preview, context) => {
      if (DateTime.fromISO(preview.expiresAt, { setZone: true }).toMillis() <= clock().getTime()) {
        context.addIssue({ code: 'custom', path: ['expiresAt'], message: 'Exact preview expired' });
      }
    })
    .safeParse(input);
}

const grantIdsSchema = z.array(identifierSchema).min(1).readonly();
const groupOutcomeSchema = z
  .object({
    groupId: identifierSchema,
    status: z.enum([
      'consumed',
      'failed',
      'outcome_unknown',
      'cancelled_before_dispatch',
      'cancelled_after_bundle_failure',
    ]),
    reasonCode: safeCodeSchema,
  })
  .strict()
  .readonly();

export const gbpPublishResponseV1Schema = z.discriminatedUnion('mode', [
  z
    .object({
      mode: z.literal('queued'),
      bundleId: identifierSchema,
      grantIds: grantIdsSchema,
      jobId: identifierSchema,
      status: z.literal('queued'),
    })
    .strict()
    .readonly(),
  z
    .object({
      mode: z.literal('immediate'),
      bundleId: identifierSchema,
      grantIds: grantIdsSchema,
      outcomes: z.array(groupOutcomeSchema).min(1).readonly(),
    })
    .strict()
    .readonly(),
]);

const exactDecisionSchema = z
  .object({
    fieldKey: fieldKeySchema,
    sectionKey: z.enum([
      'profile',
      'operatingHours',
      'servicePeriods',
      'businessContext.categories',
      'businessContext.serviceAreas',
      'businessContext.attributes',
      'businessContext.serviceItems',
      'foodMenus',
    ]),
    action: z.enum(['import_from_google', 'export_to_google', 'ignore']),
    pinnedCoreHash: sha256V1Schema.nullable(),
    pinnedGbpHash: sha256V1Schema.nullable(),
  })
  .strict()
  .readonly();

export const gbpExactPublishRequestV1Schema = z
  .object({
    decisions: z.array(exactDecisionSchema).min(1).max(200).readonly(),
    clientRequestId: identifierSchema.nullish(),
    publishBatchId: identifierSchema.nullish(),
    pinnedCoreSnapshotHash: sha256V1Schema.nullish(),
    pinnedGbpSnapshotHash: sha256V1Schema.nullish(),
    confirmationVersion: z.literal('gbp-exact-consent-v1'),
    preview: gbpExactPreviewResponseV1Schema,
    acknowledged: z.literal(true),
    riskAcknowledgements: z
      .array(
        z.enum([
          'external_write',
          'outcome_may_be_unknown',
          'partial_bundle_failure',
          'destructive_full_replacement',
        ]),
      )
      .refine((values) => values.length === new Set(values).size, 'Acknowledgements must be unique')
      .readonly(),
    mode: z.enum(['immediate', 'queued']),
  })
  .strict()
  .readonly();

export type GbpExactPreviewResponseV1 = z.infer<typeof gbpExactPreviewResponseV1Schema>;
export type GbpExactPublishRequestV1 = z.infer<typeof gbpExactPublishRequestV1Schema>;
export type GbpPublishResponseV1 = z.infer<typeof gbpPublishResponseV1Schema>;
