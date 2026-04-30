-- Phase 1 of the unified bidirectional GBP <-> Nabatable Core sync domain.
--
-- Introduces four additive tables that back the new `server/dual-sync/`
-- module. These tables are independent of the legacy `gbp_sync_v2_*`
-- tables; both stacks coexist during the rollout window. The new domain
-- targets a single field-level state machine plus operation-level publish
-- tracking, so drift, conflict, and retry are first-class concepts.
--
-- Tables (all `public.dual_sync_*`):
--   * dual_sync_field_states        -- per (restaurant, provider, field_key) state machine
--   * dual_sync_snapshot_runs       -- transactional GBP pulls keyed by snapshot_id
--   * dual_sync_outbound_candidates -- export candidates queued by Core CRUD
--   * dual_sync_publish_operations  -- per-field operation rows for publish jobs
--
-- RLS is `service_role` only to mirror legacy GBP approval / V2 sync tables.

BEGIN;

-- 1. dual_sync_field_states -------------------------------------------------

CREATE TABLE IF NOT EXISTS public.dual_sync_field_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'google_business_profile',
  section_key text NOT NULL,
  field_key text NOT NULL,
  state text NOT NULL DEFAULT 'in_sync',
  core_value_hash text,
  gbp_value_hash text,
  last_in_sync_hash text,
  last_core_change_at timestamptz,
  last_gbp_change_at timestamptz,
  last_in_sync_at timestamptz,
  last_snapshot_run_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT dual_sync_field_states_provider_check
    CHECK (provider IN ('google_business_profile')),
  CONSTRAINT dual_sync_field_states_state_check
    CHECK (state IN (
      'in_sync',
      'core_dirty',
      'gbp_dirty',
      'drifted',
      'conflict',
      'pending_import',
      'pending_export',
      'import_failed',
      'export_failed',
      'ignored',
      'unsupported'
    ))
);

CREATE UNIQUE INDEX IF NOT EXISTS dual_sync_field_states_unique_field_idx
  ON public.dual_sync_field_states (restaurant_id, provider, field_key);

CREATE INDEX IF NOT EXISTS dual_sync_field_states_restaurant_state_idx
  ON public.dual_sync_field_states (restaurant_id, state, updated_at DESC);

CREATE INDEX IF NOT EXISTS dual_sync_field_states_section_idx
  ON public.dual_sync_field_states (restaurant_id, section_key, field_key);

DROP TRIGGER IF EXISTS dual_sync_field_states_updated_at
  ON public.dual_sync_field_states;

CREATE TRIGGER dual_sync_field_states_updated_at
  BEFORE UPDATE ON public.dual_sync_field_states
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_restaurant_business_entity_updated_at();

-- 2. dual_sync_snapshot_runs ------------------------------------------------

CREATE TABLE IF NOT EXISTS public.dual_sync_snapshot_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'google_business_profile',
  run_kind text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  raw_payload jsonb,
  canonical_snapshot jsonb,
  snapshot_hash text,
  error_code text,
  error_message text,
  started_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT dual_sync_snapshot_runs_provider_check
    CHECK (provider IN ('google_business_profile')),
  CONSTRAINT dual_sync_snapshot_runs_run_kind_check
    CHECK (run_kind IN (
      'manual',
      'scheduled',
      'core_write',
      'location_link',
      'preflight'
    )),
  CONSTRAINT dual_sync_snapshot_runs_status_check
    CHECK (status IN ('pending', 'succeeded', 'failed'))
);

CREATE INDEX IF NOT EXISTS dual_sync_snapshot_runs_restaurant_idx
  ON public.dual_sync_snapshot_runs (restaurant_id, started_at DESC);

CREATE INDEX IF NOT EXISTS dual_sync_snapshot_runs_status_idx
  ON public.dual_sync_snapshot_runs (restaurant_id, status, started_at DESC);

-- snapshot_runs is append-only; no updated_at trigger.

-- Now that runs exist we can attach the field-state FK referencing them.
ALTER TABLE public.dual_sync_field_states
  DROP CONSTRAINT IF EXISTS dual_sync_field_states_last_snapshot_run_fk;

ALTER TABLE public.dual_sync_field_states
  ADD CONSTRAINT dual_sync_field_states_last_snapshot_run_fk
  FOREIGN KEY (last_snapshot_run_id)
  REFERENCES public.dual_sync_snapshot_runs(id)
  ON DELETE SET NULL;

-- 3. dual_sync_outbound_candidates ------------------------------------------

CREATE TABLE IF NOT EXISTS public.dual_sync_outbound_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'google_business_profile',
  section_key text NOT NULL,
  field_key text NOT NULL,
  proposed_value jsonb,
  proposed_value_hash text,
  baseline_gbp_hash text,
  status text NOT NULL DEFAULT 'open',
  source text NOT NULL DEFAULT 'core_write',
  created_by_user_id uuid,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT dual_sync_outbound_candidates_provider_check
    CHECK (provider IN ('google_business_profile')),
  CONSTRAINT dual_sync_outbound_candidates_status_check
    CHECK (status IN ('open', 'resolved', 'superseded', 'cancelled')),
  CONSTRAINT dual_sync_outbound_candidates_source_check
    CHECK (source IN ('core_write', 'manual', 'scheduled'))
);

CREATE UNIQUE INDEX IF NOT EXISTS dual_sync_outbound_candidates_one_open_per_field_idx
  ON public.dual_sync_outbound_candidates (restaurant_id, provider, field_key)
  WHERE status = 'open';

CREATE INDEX IF NOT EXISTS dual_sync_outbound_candidates_restaurant_status_idx
  ON public.dual_sync_outbound_candidates (restaurant_id, status, updated_at DESC);

DROP TRIGGER IF EXISTS dual_sync_outbound_candidates_updated_at
  ON public.dual_sync_outbound_candidates;

CREATE TRIGGER dual_sync_outbound_candidates_updated_at
  BEFORE UPDATE ON public.dual_sync_outbound_candidates
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_restaurant_business_entity_updated_at();

-- 4. dual_sync_publish_operations -------------------------------------------

CREATE TABLE IF NOT EXISTS public.dual_sync_publish_operations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  publish_job_id uuid NOT NULL,
  section_key text NOT NULL,
  field_key text NOT NULL,
  direction text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  attempt_count integer NOT NULL DEFAULT 0,
  before_core_hash text,
  before_gbp_hash text,
  after_core_hash text,
  after_gbp_hash text,
  google_update_mask text,
  error_code text,
  error_message text,
  external_response jsonb,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT dual_sync_publish_operations_direction_check
    CHECK (direction IN ('import_from_google', 'export_to_google')),
  CONSTRAINT dual_sync_publish_operations_status_check
    CHECK (status IN (
      'pending',
      'running',
      'succeeded',
      'failed',
      'skipped',
      'retrying'
    ))
);

CREATE UNIQUE INDEX IF NOT EXISTS dual_sync_publish_operations_unique_field_idx
  ON public.dual_sync_publish_operations (publish_job_id, field_key);

CREATE INDEX IF NOT EXISTS dual_sync_publish_operations_job_idx
  ON public.dual_sync_publish_operations (publish_job_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS dual_sync_publish_operations_restaurant_idx
  ON public.dual_sync_publish_operations (restaurant_id, status, created_at DESC);

DROP TRIGGER IF EXISTS dual_sync_publish_operations_updated_at
  ON public.dual_sync_publish_operations;

CREATE TRIGGER dual_sync_publish_operations_updated_at
  BEFORE UPDATE ON public.dual_sync_publish_operations
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_restaurant_business_entity_updated_at();

-- 5. RLS + service_role policies --------------------------------------------

ALTER TABLE public.dual_sync_field_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dual_sync_snapshot_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dual_sync_outbound_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dual_sync_publish_operations ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'dual_sync_field_states'
      AND policyname = 'Service role can manage dual sync field states'
  ) THEN
    CREATE POLICY "Service role can manage dual sync field states"
      ON public.dual_sync_field_states
      FOR ALL TO service_role
      USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'dual_sync_snapshot_runs'
      AND policyname = 'Service role can manage dual sync snapshot runs'
  ) THEN
    CREATE POLICY "Service role can manage dual sync snapshot runs"
      ON public.dual_sync_snapshot_runs
      FOR ALL TO service_role
      USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'dual_sync_outbound_candidates'
      AND policyname = 'Service role can manage dual sync outbound candidates'
  ) THEN
    CREATE POLICY "Service role can manage dual sync outbound candidates"
      ON public.dual_sync_outbound_candidates
      FOR ALL TO service_role
      USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'dual_sync_publish_operations'
      AND policyname = 'Service role can manage dual sync publish operations'
  ) THEN
    CREATE POLICY "Service role can manage dual sync publish operations"
      ON public.dual_sync_publish_operations
      FOR ALL TO service_role
      USING (true) WITH CHECK (true);
  END IF;
END
$$;

-- 6. Comments ---------------------------------------------------------------

COMMENT ON TABLE public.dual_sync_field_states IS
  'Persistent per-field sync state for the unified GBP <-> Nabatable Core dual-sync engine. One row per (restaurant, provider, field_key). state ∈ {in_sync, core_dirty, gbp_dirty, drifted, conflict, pending_import, pending_export, import_failed, export_failed, ignored, unsupported}.';

COMMENT ON TABLE public.dual_sync_snapshot_runs IS
  'Transactional snapshot pulls. Each run captures raw and canonical provider data under one snapshot_id; canonical data is committed only when status = succeeded.';

COMMENT ON TABLE public.dual_sync_outbound_candidates IS
  'Export candidates created by Core CRUD when a syncable field is written. Status = open until resolved by publish or cancellation. One open candidate per (restaurant, provider, field_key).';

COMMENT ON TABLE public.dual_sync_publish_operations IS
  'Operation-level publish tracking. One row per field per publish job, allowing partial-failure visibility and per-field retry.';

COMMIT;
