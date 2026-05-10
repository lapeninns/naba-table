BEGIN;

ALTER TABLE public.restaurant_external_profile_credentials
  DROP COLUMN IF EXISTS access_token_encrypted,
  DROP COLUMN IF EXISTS access_token_expires_at;

CREATE TABLE IF NOT EXISTS public.restaurant_external_profile_sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_profile_id uuid NOT NULL REFERENCES public.restaurant_external_profiles(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'google_business_profile',
  run_kind text NOT NULL DEFAULT 'manual',
  status text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  finished_at timestamptz,
  error_code text,
  error_message text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT restaurant_external_profile_sync_runs_provider_check
    CHECK (provider IN ('google_business_profile')),
  CONSTRAINT restaurant_external_profile_sync_runs_kind_check
    CHECK (run_kind IN ('manual', 'location_selection', 'core_sync')),
  CONSTRAINT restaurant_external_profile_sync_runs_status_check
    CHECK (status IN ('success', 'failed'))
);

CREATE INDEX IF NOT EXISTS restaurant_external_profile_sync_runs_profile_idx
  ON public.restaurant_external_profile_sync_runs (external_profile_id, started_at DESC);

CREATE INDEX IF NOT EXISTS restaurant_external_profile_sync_runs_restaurant_idx
  ON public.restaurant_external_profile_sync_runs (restaurant_id, provider, started_at DESC);

DROP TRIGGER IF EXISTS restaurant_external_profile_sync_runs_updated_at
ON public.restaurant_external_profile_sync_runs;

CREATE TRIGGER restaurant_external_profile_sync_runs_updated_at
  BEFORE UPDATE ON public.restaurant_external_profile_sync_runs
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_restaurant_business_entity_updated_at();

ALTER TABLE public.restaurant_external_profile_sync_runs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'restaurant_external_profile_sync_runs'
      AND policyname = 'Service role can manage restaurant external profile sync runs'
  ) THEN
    CREATE POLICY "Service role can manage restaurant external profile sync runs"
      ON public.restaurant_external_profile_sync_runs
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END
$$;

COMMIT;
