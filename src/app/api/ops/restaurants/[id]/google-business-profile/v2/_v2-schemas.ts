/**
 * Phase 4 of the GBP Dual-Sync V2 architecture.
 *
 * zod request/response schemas for the V2 ops API. One schema per route
 * input. Response shapes are typed via the V2 server contracts and not
 * re-validated by zod (response validation is enforced at typecheck time).
 */

import { z } from 'zod';

import { SYNC_V2_SECTION_KEYS } from '@/server/google-business-profile-v2/types';

const sectionKeySchema = z.enum(SYNC_V2_SECTION_KEYS);
const decisionActionSchema = z.enum(['import_from_google', 'export_to_google', 'ignore']);
const directionIntentSchema = z.enum(['import_to_nabatable', 'export_to_google']);

export const createDraftRequestSchema = z
  .object({
    refresh: z.boolean().optional(),
  })
  .strict();

export const upsertDecisionsRequestSchema = z
  .object({
    decisions: z
      .array(
        z
          .object({
            sectionKey: sectionKeySchema,
            fieldKey: z.string().min(1).max(256),
            action: decisionActionSchema,
            nabatableValueHash: z.string().regex(/^[a-f0-9]{64}$/),
            googleValueHash: z.string().regex(/^[a-f0-9]{64}$/),
          })
          .strict(),
      )
      .min(1)
      .max(256),
  })
  .strict();

export const preflightRequestSchema = z
  .object({
    directionIntent: directionIntentSchema,
    /** Idempotency key chosen by the client. Server enforces uniqueness. */
    idempotencyKey: z
      .string()
      .min(8)
      .max(128)
      .regex(/^[a-zA-Z0-9_-]+$/),
  })
  .strict();

export const publishRequestSchema = z
  .object({
    publishJobId: z.string().uuid(),
    /** Operator password for confirmation. Verified server-side. */
    confirmPassword: z.string().trim().min(1).max(512),
  })
  .strict();

export const retryGooglePushRequestSchema = z.object({}).strict();

export type CreateDraftRequest = z.infer<typeof createDraftRequestSchema>;
export type UpsertDecisionsRequest = z.infer<typeof upsertDecisionsRequestSchema>;
export type PreflightRequest = z.infer<typeof preflightRequestSchema>;
export type PublishRequest = z.infer<typeof publishRequestSchema>;
export type RetryGooglePushRequest = z.infer<typeof retryGooglePushRequestSchema>;
