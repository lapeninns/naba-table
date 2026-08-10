import { DateTime } from 'luxon';
import { z } from 'zod';

import { rolloutEligibilityV1Schema } from './operations';
import { epochV1Schema, restaurantIdV1Schema } from './primitives';

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
const sortedPathsSchema = z
  .array(z.string().trim().min(1).max(300))
  .refine(
    (paths) =>
      paths.length === new Set(paths).size &&
      paths.every((path, index) => index === 0 || paths[index - 1] < path),
    'Paths must be sorted and unique',
  )
  .readonly();

export const googleConnectionWriteStateV1Schema = z.enum([
  'blocked',
  'eligible',
  'revoking',
  'disconnected',
  'reauth_required',
]);

export const gbpConnectionStateResponseV1Schema = z
  .object({
    version: z.literal('v1'),
    restaurantId: restaurantIdV1Schema,
    provider: z.literal('google_business_profile'),
    connectionStatus: z.enum([
      'pending_auth',
      'authorized',
      'linked',
      'unlinked',
      'reauth_required',
      'sync_error',
    ]),
    writeState: googleConnectionWriteStateV1Schema,
    connectionGeneration: epochV1Schema,
    consentEpoch: epochV1Schema,
    reasonCode: safeCodeSchema.nullable(),
    rollout: rolloutEligibilityV1Schema,
    pendingUpdates: z.lazy(() => gbpPendingUpdatesResponseV1Schema),
    notifications: z.lazy(() => gbpNotificationParticipationResponseV1Schema),
    refresh: z
      .object({
        status: z.enum(['idle', 'refreshing', 'succeeded', 'failed', 'stale']),
        lastAttemptAt: timestampSchema.nullable(),
        lastSucceededAt: timestampSchema.nullable(),
        safeErrorCode: safeCodeSchema.nullable(),
      })
      .strict()
      .readonly(),
  })
  .strict()
  .superRefine((state, context) => {
    if (state.writeState === 'eligible' && !state.rollout.eligible) {
      context.addIssue({
        code: 'custom',
        path: ['writeState'],
        message: 'Rollout-ineligible connections cannot be write eligible',
      });
    }
  })
  .readonly();

export const gbpWriteAccessRequestV1Schema = z
  .object({
    eligible: z.boolean(),
    password: z.string().min(1).max(1_024),
  })
  .strict()
  .readonly();

export const gbpNotificationParticipationResponseV1Schema = z.discriminatedUnion('enabled', [
  z
    .object({ enabled: z.literal(true), refCount: z.number().int().positive() })
    .strict()
    .readonly(),
  z
    .object({ enabled: z.literal(false), refCount: z.number().int().nonnegative() })
    .strict()
    .readonly(),
]);

export const gbpNotificationTopicConflictResponseV1Schema = z
  .object({
    error: z.string().trim().min(1).max(300),
    code: z.literal('GBP_NOTIFICATION_TOPIC_CONFLICT'),
  })
  .strict()
  .readonly();

const pendingBase = {
  version: z.literal('v1'),
  restaurantId: restaurantIdV1Schema,
  observedAt: timestampSchema,
  expiresAt: timestampSchema,
};

export const gbpPendingUpdatesResponseV1Schema = z
  .discriminatedUnion('state', [
    z
      .object({
        version: z.literal('v1'),
        restaurantId: restaurantIdV1Schema,
        state: z.literal('none'),
      })
      .strict()
      .readonly(),
    z
      .object({
        ...pendingBase,
        state: z.literal('known'),
        locationMasks: sortedPathsSchema,
        attributePaths: sortedPathsSchema,
      })
      .strict()
      .readonly(),
    z
      .object({
        ...pendingBase,
        state: z.literal('unknown'),
        locationMasks: z.tuple([]).readonly(),
        attributePaths: z.tuple([]).readonly(),
        unknownPaths: sortedPathsSchema.refine(
          (paths) => paths.length > 0,
          'Unknown paths required',
        ),
      })
      .strict()
      .readonly(),
  ])
  .superRefine((updates, context) => {
    if (updates.state === 'none') return;
    const observedAt = DateTime.fromISO(updates.observedAt, { setZone: true }).toMillis();
    const expiresAt = DateTime.fromISO(updates.expiresAt, { setZone: true }).toMillis();
    if (expiresAt <= observedAt || expiresAt - observedAt > 28 * 24 * 60 * 60 * 1_000) {
      context.addIssue({
        code: 'custom',
        path: ['expiresAt'],
        message: 'Pending update metadata must expire within 28 days',
      });
    }
  });

const terminalNoticeSchema = z
  .object({
    id: identifierSchema,
    grant_id: identifierSchema,
    event_id: identifierSchema,
    terminal_kind: z.enum(['consumed', 'failed', 'outcome_unknown']),
    safe_reason_code: safeCodeSchema,
    requires_fresh_preview: z.boolean(),
    status: z.enum(['pending', 'claimed', 'dispatched', 'delivered', 'failed', 'outcome_unknown']),
    terminal_at: timestampSchema,
    due_at: timestampSchema,
    dispatched_at: timestampSchema.nullable(),
    outcome_unknown_at: timestampSchema.nullable(),
    delivered_at: timestampSchema.nullable(),
    failed_at: timestampSchema.nullable(),
    last_error_code: safeCodeSchema.nullable(),
    created_at: timestampSchema,
    providerInstruction: z.enum(['none', 'refresh_then_create_new_preview']),
    operationalDeliveryInstruction: z.enum([
      'none',
      'in_app_notice_available_verify_operational_channel',
    ]),
  })
  .strict()
  .superRefine((notice, context) => {
    const unknown = notice.terminal_kind === 'outcome_unknown';
    const deliveryUnknown = notice.status === 'outcome_unknown';
    if (
      notice.requires_fresh_preview !== unknown ||
      (unknown && notice.providerInstruction !== 'refresh_then_create_new_preview') ||
      (!unknown && notice.providerInstruction !== 'none') ||
      (deliveryUnknown &&
        notice.operationalDeliveryInstruction !==
          'in_app_notice_available_verify_operational_channel') ||
      (!deliveryUnknown && notice.operationalDeliveryInstruction !== 'none')
    ) {
      context.addIssue({
        code: 'custom',
        path: ['providerInstruction'],
        message: 'Instruction mismatch',
      });
    }
  })
  .readonly();

export const gbpTerminalNoticesResponseV1Schema = z
  .object({
    notices: z.array(terminalNoticeSchema).readonly(),
    census: z
      .object({
        pending_count: z.number().int().nonnegative(),
        overdue_count: z.number().int().nonnegative(),
        claimed_count: z.number().int().nonnegative(),
        dispatched_count: z.number().int().nonnegative(),
        outcome_unknown_count: z.number().int().nonnegative(),
        delivered_count: z.number().int().nonnegative(),
        failed_count: z.number().int().nonnegative(),
        oldest_pending_at: timestampSchema.nullable(),
      })
      .strict()
      .readonly(),
    asOf: timestampSchema,
  })
  .strict()
  .readonly();

export type GbpConnectionStateResponseV1 = z.infer<typeof gbpConnectionStateResponseV1Schema>;
export type GbpWriteAccessRequestV1 = z.infer<typeof gbpWriteAccessRequestV1Schema>;
export type GbpNotificationParticipationResponseV1 = z.infer<
  typeof gbpNotificationParticipationResponseV1Schema
>;
export type GbpNotificationTopicConflictResponseV1 = z.infer<
  typeof gbpNotificationTopicConflictResponseV1Schema
>;
export type GbpPendingUpdatesResponseV1 = z.infer<typeof gbpPendingUpdatesResponseV1Schema>;
export type GbpTerminalNoticesResponseV1 = z.infer<typeof gbpTerminalNoticesResponseV1Schema>;
