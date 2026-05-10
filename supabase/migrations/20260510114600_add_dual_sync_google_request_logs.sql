-- Dedicated redacted Google request/response audit summaries for dual-sync.
-- These rows supplement publish batches, operation groups, and per-field
-- operations without storing raw credentials or unbounded provider payloads.

BEGIN;

CREATE TABLE IF NOT EXISTS public.dual_sync_google_request_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'google_business_profile',
  publish_batch_id uuid REFERENCES public.dual_sync_publish_batches(id) ON DELETE SET NULL,
  operation_group_id uuid REFERENCES public.dual_sync_publish_operation_groups(id) ON DELETE SET NULL,
  publish_operation_id uuid REFERENCES public.dual_sync_publish_operations(id) ON DELETE SET NULL,
  publish_job_id text,
  section_key text,
  field_key text,
  direction text,
  write_group text,
  phase text NOT NULL,
  status text,
  google_method text,
  google_update_masks text[] NOT NULL DEFAULT ARRAY[]::text[],
  request_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  response_summary jsonb,
  error_code text,
  error_message text,
  retention_expires_at timestamptz NOT NULL DEFAULT timezone('utc', now()) + interval '180 days',
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT dual_sync_google_request_logs_provider_check
    CHECK (provider IN ('google_business_profile')),
  CONSTRAINT dual_sync_google_request_logs_direction_check
    CHECK (direction IS NULL OR direction IN ('import_from_google', 'export_to_google')),
  CONSTRAINT dual_sync_google_request_logs_phase_check
    CHECK (phase IN (
      'preflight',
      'provider_write',
      'provider_error',
      'provider_summary'
    )),
  CONSTRAINT dual_sync_google_request_logs_retention_check
    CHECK (retention_expires_at >= created_at)
);

CREATE INDEX IF NOT EXISTS dual_sync_google_request_logs_restaurant_created_idx
  ON public.dual_sync_google_request_logs (restaurant_id, provider, created_at DESC);

CREATE INDEX IF NOT EXISTS dual_sync_google_request_logs_batch_idx
  ON public.dual_sync_google_request_logs (publish_batch_id, created_at ASC)
  WHERE publish_batch_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS dual_sync_google_request_logs_group_idx
  ON public.dual_sync_google_request_logs (operation_group_id, created_at ASC)
  WHERE operation_group_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS dual_sync_google_request_logs_operation_idx
  ON public.dual_sync_google_request_logs (publish_operation_id, created_at ASC)
  WHERE publish_operation_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS dual_sync_google_request_logs_retention_idx
  ON public.dual_sync_google_request_logs (retention_expires_at ASC);

ALTER TABLE public.dual_sync_google_request_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'dual_sync_google_request_logs'
      AND policyname = 'Service role can manage dual sync Google request logs'
  ) THEN
    CREATE POLICY "Service role can manage dual sync Google request logs"
      ON public.dual_sync_google_request_logs
      FOR ALL TO service_role
      USING (true) WITH CHECK (true);
  END IF;
END
$$;

COMMENT ON TABLE public.dual_sync_google_request_logs IS
  'Redacted Google Business Profile request/response summaries for dual-sync preflight and publish execution. Raw credentials and sensitive payload fields must be removed before insert.';

COMMIT;
