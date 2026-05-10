-- Links publish batch audit rows to the field-policy manifest active at
-- decision time.

BEGIN;

ALTER TABLE public.dual_sync_publish_batches
  ADD COLUMN IF NOT EXISTS field_policy_version_id uuid
    REFERENCES public.dual_sync_field_policy_versions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS field_policy_hash text;

CREATE INDEX IF NOT EXISTS dual_sync_publish_batches_policy_version_idx
  ON public.dual_sync_publish_batches (field_policy_version_id);

CREATE INDEX IF NOT EXISTS dual_sync_publish_batches_policy_hash_idx
  ON public.dual_sync_publish_batches (restaurant_id, provider, field_policy_hash, created_at DESC)
  WHERE field_policy_hash IS NOT NULL;

COMMENT ON COLUMN public.dual_sync_publish_batches.field_policy_version_id IS
  'Field-policy version row active when this publish batch was planned.';

COMMENT ON COLUMN public.dual_sync_publish_batches.field_policy_hash IS
  'Deterministic hash of the field-policy manifest used for this publish batch.';

COMMIT;
