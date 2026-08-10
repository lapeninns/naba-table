import { DateTime } from 'luxon';
import { z } from 'zod';

import {
  accountIdV1Schema,
  actorUserIdV1Schema,
  epochV1Schema,
  fieldKeyV1Schema,
  GBP_RENDERER_VERSION_V1,
  GBP_WRITE_POLICY_VERSION_V1,
  grantIdV1Schema,
  locationIdV1Schema,
  MAX_GRANT_LIFETIME_MS,
  profileIdV1Schema,
  REMEDIATION_CONTRACT_VERSION_V1,
  RISK_ACKNOWLEDGEMENTS_V1,
  restaurantIdV1Schema,
  sha256V1Schema,
  sortedGoogleMasksV1Schema,
} from './primitives';

export type ClockV1 = () => Date;

const timestampSchema = z.iso.datetime({ offset: true });
const versionTokenSchema = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .regex(/^[A-Za-z0-9._-]+$/);
const riskAcknowledgementSchema = z.enum(RISK_ACKNOWLEDGEMENTS_V1);
const hashMapSchema = z.record(fieldKeyV1Schema, sha256V1Schema);

const manifestShapeV1Schema = z
  .object({
    version: z.literal(REMEDIATION_CONTRACT_VERSION_V1),
    grantId: grantIdV1Schema,
    restaurantId: restaurantIdV1Schema,
    actorUserId: actorUserIdV1Schema,
    accountId: accountIdV1Schema,
    profileId: profileIdV1Schema,
    locationId: locationIdV1Schema,
    epoch: epochV1Schema,
    direction: z.literal('export_to_google'),
    fieldKeys: z.array(fieldKeyV1Schema).min(1).readonly(),
    beforeHashes: hashMapSchema,
    afterHashes: hashMapSchema,
    writeGroup: versionTokenSchema,
    method: z.enum(['PATCH', 'POST', 'DELETE']),
    resource: z
      .string()
      .trim()
      .min(1)
      .max(500)
      .regex(/^locations\/[A-Za-z0-9._:/-]+$/),
    updateMasks: sortedGoogleMasksV1Schema,
    requestHash: sha256V1Schema,
    decisionHash: sha256V1Schema,
    snapshotPins: z.object({ core: sha256V1Schema, google: sha256V1Schema }).strict().readonly(),
    riskAcknowledgements: z
      .array(riskAcknowledgementSchema)
      .min(1)
      .transform((values) => Object.freeze([...new Set(values)].sort())),
    policyVersion: z.literal(GBP_WRITE_POLICY_VERSION_V1),
    rendererVersion: z.literal(GBP_RENDERER_VERSION_V1),
    previewFingerprint: sha256V1Schema,
    issuedAt: timestampSchema,
    expiresAt: timestampSchema,
  })
  .strict();

function sameKeys(fieldKeys: readonly string[], hashes: Readonly<Record<string, string>>): boolean {
  const expected = [...new Set(fieldKeys)].sort();
  return (
    expected.length === fieldKeys.length &&
    expected.join('\u0000') === Object.keys(hashes).sort().join('\u0000')
  );
}

function addManifestCrossFieldIssues(
  manifest: z.infer<typeof manifestShapeV1Schema>,
  context: z.RefinementCtx,
): void {
  if (!sameKeys(manifest.fieldKeys, manifest.beforeHashes)) {
    context.addIssue({
      code: 'custom',
      path: ['beforeHashes'],
      message: 'Hash keys must match fieldKeys',
    });
  }
  if (!sameKeys(manifest.fieldKeys, manifest.afterHashes)) {
    context.addIssue({
      code: 'custom',
      path: ['afterHashes'],
      message: 'Hash keys must match fieldKeys',
    });
  }
  const issuedAt = DateTime.fromISO(manifest.issuedAt, { setZone: true }).toMillis();
  const expiresAt = DateTime.fromISO(manifest.expiresAt, { setZone: true }).toMillis();
  if (expiresAt <= issuedAt || expiresAt - issuedAt > MAX_GRANT_LIFETIME_MS) {
    context.addIssue({
      code: 'custom',
      path: ['expiresAt'],
      message: 'Grant expiry must be after issue time and no more than 15 minutes later',
    });
  }
  if (!manifest.resource.endsWith(`/${manifest.locationId}`)) {
    context.addIssue({
      code: 'custom',
      path: ['resource'],
      message: 'Resource must bind the location',
    });
  }
}

export const grantManifestV1Schema = manifestShapeV1Schema
  .superRefine(addManifestCrossFieldIssues)
  .readonly();

export type GrantManifestV1 = z.infer<typeof grantManifestV1Schema>;

export function createGrantManifestV1Schema(clock: ClockV1) {
  return grantManifestV1Schema.superRefine((manifest, context) => {
    if (DateTime.fromISO(manifest.expiresAt, { setZone: true }).toMillis() <= clock().getTime()) {
      context.addIssue({ code: 'custom', path: ['expiresAt'], message: 'Grant has expired' });
    }
  });
}

export function parseGrantManifestV1(input: unknown, clock: ClockV1 = () => new Date()) {
  return createGrantManifestV1Schema(clock).safeParse(input);
}
