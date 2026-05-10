-- Cold archive for redacted Google request-log summaries before hot-table
-- retention deletes expired rows.

BEGIN;

CREATE TABLE IF NOT EXISTS public.dual_sync_google_request_log_archives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  original_request_log_id uuid NOT NULL,
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'google_business_profile',
  retention_expires_at timestamptz NOT NULL,
  original_created_at timestamptz NOT NULL,
  archived_payload jsonb NOT NULL,
  archived_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT dual_sync_google_request_log_archives_provider_check
    CHECK (provider IN ('google_business_profile'))
);

CREATE UNIQUE INDEX IF NOT EXISTS dual_sync_google_request_log_archives_original_idx
  ON public.dual_sync_google_request_log_archives (original_request_log_id);

CREATE INDEX IF NOT EXISTS dual_sync_google_request_log_archives_restaurant_idx
  ON public.dual_sync_google_request_log_archives (restaurant_id, provider, archived_at DESC);

CREATE INDEX IF NOT EXISTS dual_sync_google_request_log_archives_retention_idx
  ON public.dual_sync_google_request_log_archives (retention_expires_at, archived_at DESC);

ALTER TABLE public.dual_sync_google_request_log_archives ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'dual_sync_google_request_log_archives'
      AND policyname = 'Service role can manage dual sync Google request log archives'
  ) THEN
    CREATE POLICY "Service role can manage dual sync Google request log archives"
      ON public.dual_sync_google_request_log_archives
      FOR ALL TO service_role
      USING (true) WITH CHECK (true);
  END IF;
END
$$;

COMMENT ON TABLE public.dual_sync_google_request_log_archives IS
  'Cold archive of redacted dual-sync Google request-log rows copied before hot-table retention deletes expired rows.';

COMMIT;
