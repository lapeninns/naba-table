import { z } from 'zod';

export const REMEDIATION_CONTRACT_VERSION_V1 = 'v1' as const;
export const GBP_WRITE_POLICY_VERSION_V1 = 'gbp-write-policy-v1' as const;
export const GBP_RENDERER_VERSION_V1 = 'gbp-renderer-v1' as const;
export const MAX_GRANT_LIFETIME_MS = 15 * 60 * 1_000;

export const RISK_ACKNOWLEDGEMENTS_V1 = [
  'external_write',
  'outcome_may_be_unknown',
  'partial_bundle_failure',
] as const;

const identifierSchema = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .regex(/^[A-Za-z0-9._:/-]+$/);

export const restaurantIdV1Schema = identifierSchema.brand<'RestaurantIdV1'>();
export const actorUserIdV1Schema = identifierSchema.brand<'ActorUserIdV1'>();
export const grantIdV1Schema = identifierSchema.brand<'GrantIdV1'>();
export const accountIdV1Schema = identifierSchema.brand<'GoogleAccountIdV1'>();
export const profileIdV1Schema = identifierSchema.brand<'GoogleProfileIdV1'>();
export const locationIdV1Schema = identifierSchema.brand<'GoogleLocationIdV1'>();
export const eventIdV1Schema = identifierSchema.brand<'GoogleEventIdV1'>();
export const fieldKeyV1Schema = identifierSchema.brand<'DualSyncFieldKeyV1'>();
export const sha256V1Schema = z
  .string()
  .regex(/^[a-f0-9]{64}$/)
  .brand<'Sha256V1'>();
export const epochV1Schema = z.number().int().nonnegative();

export const GRANT_STATUSES_V1 = [
  'granted',
  'claimed',
  'dispatched',
  'consumed',
  'failed',
  'outcome_unknown',
  'expired',
  'revoked',
  'cancelled_before_dispatch',
  'cancelled_after_bundle_failure',
] as const;

export const grantStatusV1Schema = z.enum(GRANT_STATUSES_V1);

export const EVENT_STATUSES_V1 = [
  'received',
  'processing',
  'consumed',
  'ignored',
  'failed',
] as const;

export const DISPATCH_STATUSES_V1 = [
  'claimed',
  'dispatched',
  'failed',
  'outcome_unknown',
  'cancelled_before_dispatch',
  'cancelled_after_bundle_failure',
] as const;

export const eventStatusV1Schema = z.enum(EVENT_STATUSES_V1);
export const dispatchStatusV1Schema = z.enum(DISPATCH_STATUSES_V1);

export const connectionWriteStateV1Schema = z.enum([
  'read_only',
  'preview_only',
  'write_enabled',
  'fail_stopped',
]);
export const executionModeV1Schema = z.enum(['immediate', 'queued']);

export const GOOGLE_UPDATE_MASKS_V1 = [
  'title',
  'profile',
  'phoneNumbers',
  'storefrontAddress',
  'regularHours',
  'specialHours',
  'moreHours',
  'categories',
  'serviceArea',
  'attributes',
  'serviceItems',
  'menus',
] as const;

export const googleUpdateMaskV1Schema = z.enum(GOOGLE_UPDATE_MASKS_V1);

export const sortedGoogleMasksV1Schema = z
  .array(googleUpdateMaskV1Schema)
  .min(1)
  .transform((masks) => Object.freeze([...new Set(masks)].sort()));

export type RestaurantIdV1 = z.infer<typeof restaurantIdV1Schema>;
export type ActorUserIdV1 = z.infer<typeof actorUserIdV1Schema>;
export type GrantIdV1 = z.infer<typeof grantIdV1Schema>;
export type GrantStatusV1 = z.infer<typeof grantStatusV1Schema>;
export type EventStatusV1 = z.infer<typeof eventStatusV1Schema>;
export type DispatchStatusV1 = z.infer<typeof dispatchStatusV1Schema>;
export type ConnectionWriteStateV1 = z.infer<typeof connectionWriteStateV1Schema>;
export type ExecutionModeV1 = z.infer<typeof executionModeV1Schema>;
export type GoogleUpdateMaskV1 = z.infer<typeof googleUpdateMaskV1Schema>;
