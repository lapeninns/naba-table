-- Durable queue for unified dual-sync jobs. This is the foundation for
-- retry/backoff/dead-letter handling across refresh, publish, auto-export,
-- and core-write recompute work.

BEGIN;

CREATE TABLE IF NOT EXISTS public.dual_sync_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'google_business_profile',
  job_kind text NOT NULL,
  status text NOT NULL DEFAULT 'queued',
  idempotency_key text,
  priority integer NOT NULL DEFAULT 100,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  attempt_count integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 3,
  available_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  locked_at timestamptz,
  locked_by text,
  last_error_code text,
  last_error_message text,
  dead_letter_reason text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT dual_sync_jobs_provider_check
    CHECK (provider IN ('google_business_profile')),
  CONSTRAINT dual_sync_jobs_job_kind_check
    CHECK (job_kind IN (
      'google_refresh_manual',
      'google_refresh_scheduled',
      'core_write_recompute',
      'publish_batch',
      'auto_export',
      'mirror_refresh_after_publish'
    )),
  CONSTRAINT dual_sync_jobs_status_check
    CHECK (status IN (
      'queued',
      'running',
      'succeeded',
      'failed',
      'retrying',
      'dead_letter',
      'cancelled'
    )),
  CONSTRAINT dual_sync_jobs_attempts_check
    CHECK (attempt_count >= 0 AND max_attempts > 0),
  CONSTRAINT dual_sync_jobs_priority_check
    CHECK (priority >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS dual_sync_jobs_idempotency_idx
  ON public.dual_sync_jobs (restaurant_id, provider, job_kind, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS dual_sync_jobs_claim_idx
  ON public.dual_sync_jobs (provider, status, available_at ASC, priority ASC, created_at ASC)
  WHERE status IN ('queued', 'retrying');

CREATE INDEX IF NOT EXISTS dual_sync_jobs_restaurant_status_idx
  ON public.dual_sync_jobs (restaurant_id, provider, status, created_at DESC);

DROP TRIGGER IF EXISTS dual_sync_jobs_updated_at
  ON public.dual_sync_jobs;

CREATE TRIGGER dual_sync_jobs_updated_at
  BEFORE UPDATE ON public.dual_sync_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_restaurant_business_entity_updated_at();

ALTER TABLE public.dual_sync_jobs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'dual_sync_jobs'
      AND policyname = 'Service role can manage dual sync jobs'
  ) THEN
    CREATE POLICY "Service role can manage dual sync jobs"
      ON public.dual_sync_jobs
      FOR ALL TO service_role
      USING (true) WITH CHECK (true);
  END IF;
END
$$;

COMMENT ON TABLE public.dual_sync_jobs IS
  'Durable unified dual-sync job queue. Supports queued/retry/dead-letter lifecycle for refresh, publish, auto-export, mirror refresh, and core-write recompute work.';

COMMIT;
