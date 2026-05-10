-- Phase 1 of the GBP Dual-Sync V2 architecture (task harness:
-- tasks/gbp-dual-sync-architecture-v2-20260428-2319). Adds five additive
-- _v2 tables that back the new versioned engine. Legacy GBP tables stay live
-- and unchanged. RLS is service_role-only to mirror the legacy approval
-- workflow tables.
--
-- Naming: tables are prefixed `gbp_sync_v2_*` for namespacing (repo
-- convention), matching the plan's logical names (sync_workflows_v2 etc.).

BEGIN;

-- 1. Workflow ----------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.gbp_sync_v2_workflows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'google_business_profile',
  active_draft_id uuid,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT gbp_sync_v2_workflows_provider_check
    CHECK (provider IN ('google_business_profile'))
);

CREATE UNIQUE INDEX IF NOT EXISTS gbp_sync_v2_workflows_one_per_restaurant_idx
  ON public.gbp_sync_v2_workflows (restaurant_id, provider);

DROP TRIGGER IF EXISTS gbp_sync_v2_workflows_updated_at
  ON public.gbp_sync_v2_workflows;

CREATE TRIGGER gbp_sync_v2_workflows_updated_at
  BEFORE UPDATE ON public.gbp_sync_v2_workflows
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_restaurant_business_entity_updated_at();

-- 2. Drafts ------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.gbp_sync_v2_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id uuid NOT NULL REFERENCES public.gbp_sync_v2_workflows(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'open',
  nabatable_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  google_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  nabatable_snapshot_hash text NOT NULL,
  google_snapshot_hash text NOT NULL,
  diff_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  fetched_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  created_by_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT gbp_sync_v2_drafts_status_check
    CHECK (status IN (
      'open',
      'preflight_locked',
      'publishing',
      'published',
      'partial',
      'failed',
      'archived'
    ))
);

CREATE INDEX IF NOT EXISTS gbp_sync_v2_drafts_restaurant_idx
  ON public.gbp_sync_v2_drafts (restaurant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS gbp_sync_v2_drafts_workflow_idx
  ON public.gbp_sync_v2_drafts (workflow_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS gbp_sync_v2_drafts_one_open_per_workflow_idx
  ON public.gbp_sync_v2_drafts (workflow_id)
  WHERE status IN ('open', 'preflight_locked', 'publishing');

DROP TRIGGER IF EXISTS gbp_sync_v2_drafts_updated_at
  ON public.gbp_sync_v2_drafts;

CREATE TRIGGER gbp_sync_v2_drafts_updated_at
  BEFORE UPDATE ON public.gbp_sync_v2_drafts
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_restaurant_business_entity_updated_at();

-- Now that drafts exist we can add the workflow.active_draft_id FK.
ALTER TABLE public.gbp_sync_v2_workflows
  DROP CONSTRAINT IF EXISTS gbp_sync_v2_workflows_active_draft_fk;

ALTER TABLE public.gbp_sync_v2_workflows
  ADD CONSTRAINT gbp_sync_v2_workflows_active_draft_fk
  FOREIGN KEY (active_draft_id)
  REFERENCES public.gbp_sync_v2_drafts(id)
  ON DELETE SET NULL;

-- 3. Decisions --------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.gbp_sync_v2_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id uuid NOT NULL REFERENCES public.gbp_sync_v2_drafts(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  section_key text NOT NULL,
  field_key text NOT NULL,
  action text NOT NULL,
  nabatable_value_hash text NOT NULL,
  google_value_hash text NOT NULL,
  decided_by_user_id uuid,
  decided_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT gbp_sync_v2_decisions_action_check
    CHECK (action IN ('import_from_google', 'export_to_google', 'ignore'))
);

CREATE UNIQUE INDEX IF NOT EXISTS gbp_sync_v2_decisions_unique_field_idx
  ON public.gbp_sync_v2_decisions (draft_id, section_key, field_key);

CREATE INDEX IF NOT EXISTS gbp_sync_v2_decisions_draft_idx
  ON public.gbp_sync_v2_decisions (draft_id, decided_at DESC);

DROP TRIGGER IF EXISTS gbp_sync_v2_decisions_updated_at
  ON public.gbp_sync_v2_decisions;

CREATE TRIGGER gbp_sync_v2_decisions_updated_at
  BEFORE UPDATE ON public.gbp_sync_v2_decisions
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_restaurant_business_entity_updated_at();

-- 4. Publish jobs (frozen contract) -----------------------------------------

CREATE TABLE IF NOT EXISTS public.gbp_sync_v2_publish_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id uuid NOT NULL REFERENCES public.gbp_sync_v2_workflows(id) ON DELETE CASCADE,
  draft_id uuid NOT NULL REFERENCES public.gbp_sync_v2_drafts(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  direction_intent text NOT NULL,
  publish_plan_id uuid NOT NULL DEFAULT gen_random_uuid(),
  idempotency_key text NOT NULL,
  frozen_decisions jsonb NOT NULL DEFAULT '[]'::jsonb,
  frozen_decisions_hash text NOT NULL,
  frozen_nabatable_snapshot_hash text NOT NULL,
  frozen_google_snapshot_hash text NOT NULL,
  preflight_result jsonb NOT NULL DEFAULT '{}'::jsonb,
  google_update_masks text[] NOT NULL DEFAULT ARRAY[]::text[],
  status text NOT NULL DEFAULT 'preflight_locked',
  error_classification text,
  errors jsonb NOT NULL DEFAULT '[]'::jsonb,
  nabatable_event_id uuid,
  google_event_id uuid,
  rollback_event_id uuid,
  preflighted_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  published_at timestamptz,
  failed_at timestamptz,
  retried_at timestamptz,
  created_by_user_id uuid,
  published_by_user_id uuid,
  retried_by_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT gbp_sync_v2_publish_jobs_direction_intent_check
    CHECK (direction_intent IN ('import_to_nabatable', 'export_to_google')),
  CONSTRAINT gbp_sync_v2_publish_jobs_status_check
    CHECK (status IN (
      'preflight_locked',
      'publishing',
      'published',
      'partial',
      'failed',
      'rolled_back',
      'cancelled'
    )),
  CONSTRAINT gbp_sync_v2_publish_jobs_error_classification_check
    CHECK (
      error_classification IS NULL OR
      error_classification IN (
        'retryable',
        'permission',
        'validation',
        'unsupported_field',
        'quota',
        'contract_lock_mismatch',
        'stale_snapshot'
      )
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS gbp_sync_v2_publish_jobs_idempotency_key_idx
  ON public.gbp_sync_v2_publish_jobs (idempotency_key);

CREATE INDEX IF NOT EXISTS gbp_sync_v2_publish_jobs_draft_idx
  ON public.gbp_sync_v2_publish_jobs (draft_id, created_at DESC);

CREATE INDEX IF NOT EXISTS gbp_sync_v2_publish_jobs_restaurant_idx
  ON public.gbp_sync_v2_publish_jobs (restaurant_id, created_at DESC);

DROP TRIGGER IF EXISTS gbp_sync_v2_publish_jobs_updated_at
  ON public.gbp_sync_v2_publish_jobs;

CREATE TRIGGER gbp_sync_v2_publish_jobs_updated_at
  BEFORE UPDATE ON public.gbp_sync_v2_publish_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_restaurant_business_entity_updated_at();

-- 5. Publish events (immutable audit) ---------------------------------------

CREATE TABLE IF NOT EXISTS public.gbp_sync_v2_publish_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  publish_job_id uuid NOT NULL REFERENCES public.gbp_sync_v2_publish_jobs(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  direction text NOT NULL,
  leg text NOT NULL,
  result text NOT NULL DEFAULT 'pending',
  affected_section_keys text[] NOT NULL DEFAULT ARRAY[]::text[],
  google_update_masks text[] NOT NULL DEFAULT ARRAY[]::text[],
  old_values jsonb NOT NULL DEFAULT '{}'::jsonb,
  new_values jsonb NOT NULL DEFAULT '{}'::jsonb,
  errors jsonb NOT NULL DEFAULT '[]'::jsonb,
  actor_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT gbp_sync_v2_publish_events_direction_check
    CHECK (direction IN ('import_to_nabatable', 'export_to_google')),
  CONSTRAINT gbp_sync_v2_publish_events_leg_check
    CHECK (leg IN ('nabatable_apply', 'google_patch', 'rollback')),
  CONSTRAINT gbp_sync_v2_publish_events_result_check
    CHECK (result IN ('pending', 'success', 'failed', 'partial', 'skipped'))
);

CREATE INDEX IF NOT EXISTS gbp_sync_v2_publish_events_job_idx
  ON public.gbp_sync_v2_publish_events (publish_job_id, created_at DESC);

CREATE INDEX IF NOT EXISTS gbp_sync_v2_publish_events_restaurant_idx
  ON public.gbp_sync_v2_publish_events (restaurant_id, created_at DESC);

-- Now that events exist, attach FKs on publish_jobs that reference them.
ALTER TABLE public.gbp_sync_v2_publish_jobs
  DROP CONSTRAINT IF EXISTS gbp_sync_v2_publish_jobs_nabatable_event_fk;

ALTER TABLE public.gbp_sync_v2_publish_jobs
  ADD CONSTRAINT gbp_sync_v2_publish_jobs_nabatable_event_fk
  FOREIGN KEY (nabatable_event_id)
  REFERENCES public.gbp_sync_v2_publish_events(id)
  ON DELETE SET NULL;

ALTER TABLE public.gbp_sync_v2_publish_jobs
  DROP CONSTRAINT IF EXISTS gbp_sync_v2_publish_jobs_google_event_fk;

ALTER TABLE public.gbp_sync_v2_publish_jobs
  ADD CONSTRAINT gbp_sync_v2_publish_jobs_google_event_fk
  FOREIGN KEY (google_event_id)
  REFERENCES public.gbp_sync_v2_publish_events(id)
  ON DELETE SET NULL;

ALTER TABLE public.gbp_sync_v2_publish_jobs
  DROP CONSTRAINT IF EXISTS gbp_sync_v2_publish_jobs_rollback_event_fk;

ALTER TABLE public.gbp_sync_v2_publish_jobs
  ADD CONSTRAINT gbp_sync_v2_publish_jobs_rollback_event_fk
  FOREIGN KEY (rollback_event_id)
  REFERENCES public.gbp_sync_v2_publish_events(id)
  ON DELETE SET NULL;

-- 6. RLS + service_role policies (mirror legacy GBP approval workflow rules) -

ALTER TABLE public.gbp_sync_v2_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gbp_sync_v2_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gbp_sync_v2_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gbp_sync_v2_publish_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gbp_sync_v2_publish_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'gbp_sync_v2_workflows'
      AND policyname = 'Service role can manage gbp sync v2 workflows'
  ) THEN
    CREATE POLICY "Service role can manage gbp sync v2 workflows"
      ON public.gbp_sync_v2_workflows
      FOR ALL TO service_role
      USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'gbp_sync_v2_drafts'
      AND policyname = 'Service role can manage gbp sync v2 drafts'
  ) THEN
    CREATE POLICY "Service role can manage gbp sync v2 drafts"
      ON public.gbp_sync_v2_drafts
      FOR ALL TO service_role
      USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'gbp_sync_v2_decisions'
      AND policyname = 'Service role can manage gbp sync v2 decisions'
  ) THEN
    CREATE POLICY "Service role can manage gbp sync v2 decisions"
      ON public.gbp_sync_v2_decisions
      FOR ALL TO service_role
      USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'gbp_sync_v2_publish_jobs'
      AND policyname = 'Service role can manage gbp sync v2 publish jobs'
  ) THEN
    CREATE POLICY "Service role can manage gbp sync v2 publish jobs"
      ON public.gbp_sync_v2_publish_jobs
      FOR ALL TO service_role
      USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'gbp_sync_v2_publish_events'
      AND policyname = 'Service role can manage gbp sync v2 publish events'
  ) THEN
    CREATE POLICY "Service role can manage gbp sync v2 publish events"
      ON public.gbp_sync_v2_publish_events
      FOR ALL TO service_role
      USING (true) WITH CHECK (true);
  END IF;
END
$$;

-- 7. Comments ---------------------------------------------------------------

COMMENT ON TABLE public.gbp_sync_v2_workflows IS
  'V2 sync workflow root per restaurant for the dual-direction GBP engine (import_to_nabatable, export_to_google). One row per (restaurant, provider).';
COMMENT ON TABLE public.gbp_sync_v2_drafts IS
  'V2 reviewable diff session. Holds canonical Nabatable and Google snapshots, diff items, and snapshot hashes used for stale detection.';
COMMENT ON TABLE public.gbp_sync_v2_decisions IS
  'V2 per-field decision rows. Single source of truth for selection. action ∈ {import_from_google, export_to_google, ignore}.';
COMMENT ON TABLE public.gbp_sync_v2_publish_jobs IS
  'V2 frozen publish-job contract. Captures direction intent, frozen decisions hash, and snapshot hashes used at preflight to lock publish.';
COMMENT ON TABLE public.gbp_sync_v2_publish_events IS
  'V2 immutable audit trail for nabatable_apply, google_patch, and rollback legs of a publish job.';

COMMIT;
