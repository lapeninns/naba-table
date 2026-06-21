-- Adds durable publish batch and section-operation group audit rows for
-- unified dual-sync. Existing per-field operation rows remain intact and
-- gain nullable parent references so older rows continue to read cleanly.

BEGIN;

CREATE TABLE IF NOT EXISTS public.dual_sync_publish_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'google_business_profile',
  client_request_id text,
  actor_user_id uuid,
  status text NOT NULL DEFAULT 'pending',
  decision_hash text NOT NULL,
  pinned_core_snapshot_hash text,
  pinned_gbp_snapshot_hash text,
  core_snapshot_hash text,
  gbp_snapshot_hash text,
  accepted_count integer NOT NULL DEFAULT 0,
  rejected_count integer NOT NULL DEFAULT 0,
  ignored_count integer NOT NULL DEFAULT 0,
  plan_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_code text,
  error_message text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT dual_sync_publish_batches_provider_check
    CHECK (provider IN ('google_business_profile')),
  CONSTRAINT dual_sync_publish_batches_status_check
    CHECK (status IN (
      'pending',
      'running',
      'succeeded',
      'failed',
      'skipped',
      'stale',
      'cancelled'
    )),
  CONSTRAINT dual_sync_publish_batches_counts_check
    CHECK (accepted_count >= 0 AND rejected_count >= 0 AND ignored_count >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS dual_sync_publish_batches_client_request_idx
  ON public.dual_sync_publish_batches (restaurant_id, provider, client_request_id)
  WHERE client_request_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS dual_sync_publish_batches_restaurant_status_idx
  ON public.dual_sync_publish_batches (restaurant_id, provider, status, created_at DESC);

DROP TRIGGER IF EXISTS dual_sync_publish_batches_updated_at
  ON public.dual_sync_publish_batches;

CREATE TRIGGER dual_sync_publish_batches_updated_at
  BEFORE UPDATE ON public.dual_sync_publish_batches
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_restaurant_business_entity_updated_at();

CREATE TABLE IF NOT EXISTS public.dual_sync_publish_operation_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  publish_batch_id uuid NOT NULL REFERENCES public.dual_sync_publish_batches(id) ON DELETE CASCADE,
  group_key text NOT NULL,
  section_key text NOT NULL,
  direction text NOT NULL,
  write_group text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  risk_level text NOT NULL,
  requires_preflight boolean NOT NULL DEFAULT false,
  requires_manual_confirmation boolean NOT NULL DEFAULT false,
  destructive_write_possible boolean NOT NULL DEFAULT false,
  google_update_masks text[] NOT NULL DEFAULT ARRAY[]::text[],
  decision_count integer NOT NULL DEFAULT 0,
  preflight_status text,
  preflight_result jsonb,
  request_summary jsonb,
  response_summary jsonb,
  error_code text,
  error_message text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT dual_sync_publish_operation_groups_direction_check
    CHECK (direction IN ('import_from_google', 'export_to_google')),
  CONSTRAINT dual_sync_publish_operation_groups_status_check
    CHECK (status IN (
      'pending',
      'running',
      'succeeded',
      'failed',
      'skipped',
      'retrying'
    )),
  CONSTRAINT dual_sync_publish_operation_groups_decision_count_check
    CHECK (decision_count >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS dual_sync_publish_operation_groups_batch_key_idx
  ON public.dual_sync_publish_operation_groups (publish_batch_id, group_key);

CREATE INDEX IF NOT EXISTS dual_sync_publish_operation_groups_batch_status_idx
  ON public.dual_sync_publish_operation_groups (publish_batch_id, status, created_at ASC);

CREATE INDEX IF NOT EXISTS dual_sync_publish_operation_groups_restaurant_status_idx
  ON public.dual_sync_publish_operation_groups (restaurant_id, status, created_at DESC);

DROP TRIGGER IF EXISTS dual_sync_publish_operation_groups_updated_at
  ON public.dual_sync_publish_operation_groups;

CREATE TRIGGER dual_sync_publish_operation_groups_updated_at
  BEFORE UPDATE ON public.dual_sync_publish_operation_groups
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_restaurant_business_entity_updated_at();

ALTER TABLE public.dual_sync_publish_operations
  ADD COLUMN IF NOT EXISTS publish_batch_id uuid REFERENCES public.dual_sync_publish_batches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS operation_group_id uuid REFERENCES public.dual_sync_publish_operation_groups(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS dual_sync_publish_operations_batch_idx
  ON public.dual_sync_publish_operations (publish_batch_id, status, created_at ASC)
  WHERE publish_batch_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS dual_sync_publish_operations_group_idx
  ON public.dual_sync_publish_operations (operation_group_id, status, created_at ASC)
  WHERE operation_group_id IS NOT NULL;

ALTER TABLE public.dual_sync_publish_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dual_sync_publish_operation_groups ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'dual_sync_publish_batches'
      AND policyname = 'Service role can manage dual sync publish batches'
  ) THEN
    CREATE POLICY "Service role can manage dual sync publish batches"
      ON public.dual_sync_publish_batches
      FOR ALL TO service_role
      USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'dual_sync_publish_operation_groups'
      AND policyname = 'Service role can manage dual sync publish operation groups'
  ) THEN
    CREATE POLICY "Service role can manage dual sync publish operation groups"
      ON public.dual_sync_publish_operation_groups
      FOR ALL TO service_role
      USING (true) WITH CHECK (true);
  END IF;
END
$$;

COMMENT ON TABLE public.dual_sync_publish_batches IS
  'Durable publish batch/idempotency root for unified dual-sync. One row records the frozen decision hash, actor, pinned snapshots, planner counts, and final status.';

COMMENT ON TABLE public.dual_sync_publish_operation_groups IS
  'Section/write-group parent rows for dual-sync publish execution. Each group owns one Google/Core-safe execution unit while child operation rows keep per-field audit detail.';

COMMIT;
