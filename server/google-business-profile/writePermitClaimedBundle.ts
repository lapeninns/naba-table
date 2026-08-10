import { z } from 'zod';

const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
const timestampSchema = z.iso.datetime({ offset: true });

export const claimedGoogleWriteGrantSchema = z
  .object({
    actor_user_id: z.string().uuid(),
    after_hashes: z.array(sha256Schema),
    before_hashes: z.array(sha256Schema),
    bundle_hash: sha256Schema,
    bundle_id: z.string().uuid(),
    bundle_order: z.number().int().positive(),
    bundle_size: z.number().int().positive().max(25),
    claimed_at: timestampSchema,
    connection_generation: z.number().int().positive(),
    consent_epoch: z.number().int().positive(),
    core_snapshot_hash: sha256Schema,
    created_at: timestampSchema,
    decision_hash: sha256Schema,
    direction: z.literal('export_to_google'),
    dispatched_at: z.null(),
    execution_id: z.string().uuid(),
    expires_at: timestampSchema,
    external_account_id: z.string().min(1),
    external_location_id: z.string().min(1),
    external_profile_id: z.string().min(1),
    external_profile_row_id: z.string().uuid(),
    field_keys: z.array(z.string().min(1)).min(1),
    google_method: z.enum(['PATCH', 'POST', 'DELETE']),
    google_resource: z.string().min(1),
    google_snapshot_hash: sha256Schema,
    group_id: z.string().min(1),
    id: z.string().uuid(),
    issued_at: timestampSchema,
    manifest_hash: sha256Schema,
    policy_version: z.string().min(1),
    preview_fingerprint: sha256Schema,
    provider: z.literal('google_business_profile'),
    reason_code: z.null(),
    renderer_version: z.string().min(1),
    request_hash: sha256Schema,
    restaurant_id: z.string().uuid(),
    risk_acknowledgements: z.array(z.string().min(1)),
    status: z.literal('claimed'),
    terminal_at: z.null(),
    update_masks: z.array(z.string().min(1)).min(1),
    update_masks_hash: sha256Schema,
    write_group: z.string().min(1),
  })
  .strict();

export const claimedGoogleWriteBundleSchema = z.array(claimedGoogleWriteGrantSchema).min(1).max(25);

export type ClaimedGoogleWriteGrant = z.infer<typeof claimedGoogleWriteGrantSchema>;
