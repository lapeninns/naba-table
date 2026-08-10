import { z } from 'zod';

import {
  EXACT_CONSENT_POLICY_VERSION,
  EXACT_CONSENT_RENDERER_VERSION,
  EXACT_CONSENT_VERSION,
} from './types';

import type { ExactConsentPreview } from './types';

const hashSchema = z.string().regex(/^[a-f0-9]{64}$/);
const hashMapSchema = z.record(z.string().min(1), hashSchema);
const sideHashesSchema = z.object({ core: hashMapSchema, google: hashMapSchema }).strict();
const displaySchema = z
  .object({
    core: z.record(z.string().min(1), z.unknown()),
    google: z.record(z.string().min(1), z.unknown()),
  })
  .strict();

export const exactConsentPreviewSchema = z
  .object({
    confirmationVersion: z.literal(EXACT_CONSENT_VERSION),
    policyVersion: z.literal(EXACT_CONSENT_POLICY_VERSION),
    rendererVersion: z.literal(EXACT_CONSENT_RENDERER_VERSION),
    listing: z
      .object({
        restaurantId: z.string().min(1),
        externalProfileRowId: z.string().min(1),
        accountId: z.string().min(1),
        profileId: z.string().min(1),
        locationId: z.string().min(1),
        connectionGeneration: z.number().int().positive(),
        consentEpoch: z.number().int().positive(),
      })
      .strict(),
    snapshotPins: z.object({ core: hashSchema, google: hashSchema }).strict(),
    groups: z.array(
      z
        .object({
          groupId: z.string().min(1),
          writeGroup: z.string().min(1),
          direction: z.literal('export_to_google'),
          fieldKeys: z.array(z.string().min(1)).min(1),
          method: z.enum(['PATCH', 'POST', 'DELETE']),
          resource: z.string().min(1),
          updateMasks: z.array(z.string().min(1)).min(1),
          beforeDisplay: displaySchema,
          afterDisplay: displaySchema,
          beforeHashes: sideHashesSchema,
          afterHashes: sideHashesSchema,
          requestHash: hashSchema,
          decisionHash: hashSchema,
          warnings: z.array(z.string()),
          riskLevel: z.enum(['low', 'medium', 'high', 'critical']),
          fullReplacement: z.boolean(),
        })
        .strict(),
    ),
    planFingerprint: hashSchema,
    issuedAt: z.iso.datetime({ offset: true }),
    expiresAt: z.iso.datetime({ offset: true }),
  })
  .strict();

export function parseExactConsentPreview(input: unknown): ExactConsentPreview {
  return exactConsentPreviewSchema.parse(input);
}
