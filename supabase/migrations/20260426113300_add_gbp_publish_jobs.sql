BEGIN;

CREATE TABLE IF NOT EXISTS public.restaurant_external_profile_publish_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  draft_id uuid NOT NULL REFERENCES public.restaurant_external_profile_drafts(id) ON DELETE CASCADE,
  external_profile_id uuid REFERENCES public.restaurant_external_profiles(id) ON DELETE SET NULL,
  provider text NOT NULL DEFAULT 'google_business_profile',
  idempotency_key text NOT NULL,
  mode text NOT NULL DEFAULT 'nabatable_only',
  status text NOT NULL DEFAULT 'preflight_ready',
  selected_approvals jsonb NOT NULL DEFAULT '{}'::jsonb,
  nabatable_sections text[] NOT NULL DEFAULT ARRAY[]::text[],
  preflight_nabatable_updates jsonb NOT NULL DEFAULT '[]'::jsonb,
  preflight_pull_only_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  google_update_masks text[] NOT NULL DEFAULT ARRAY[]::text[],
  post_nabatable_core_hashes jsonb NOT NULL DEFAULT '{}'::jsonb,
  preflight_warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
  preflight_errors jsonb NOT NULL DEFAULT '[]'::jsonb,
  error_classification text,
  errors jsonb NOT NULL DEFAULT '[]'::jsonb,
  nabatable_publish_event_id uuid REFERENCES public.restaurant_external_profile_publish_events(id) ON DELETE SET NULL,
  google_publish_event_id uuid REFERENCES public.restaurant_external_profile_publish_events(id) ON DELETE SET NULL,
  created_by_user_id uuid,
  published_by_user_id uuid,
  google_retry_by_user_id uuid,
  preflighted_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  nabatable_published_at timestamptz,
  google_pushed_at timestamptz,
  failed_at timestamptz,
  retried_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT restaurant_external_profile_publish_jobs_provider_check
    CHECK (provider IN ('google_business_profile')),
  CONSTRAINT restaurant_external_profile_publish_jobs_mode_check
    CHECK (mode IN ('nabatable_only', 'nabatable_and_google')),
  CONSTRAINT restaurant_external_profile_publish_jobs_status_check
    CHECK (
      status IN (
        'preflight_ready',
        'publishing',
        'published',
        'partially_published',
        'google_failed',
        'failed',
        'cancelled'
      )
    ),
  CONSTRAINT restaurant_external_profile_publish_jobs_error_classification_check
    CHECK (
      error_classification IS NULL OR
      error_classification IN (
        'retryable',
        'permission',
        'validation',
        'unsupported_field',
        'quota'
      )
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS restaurant_external_profile_publish_jobs_idempotency_key_idx
  ON public.restaurant_external_profile_publish_jobs (idempotency_key);

CREATE INDEX IF NOT EXISTS restaurant_external_profile_publish_jobs_restaurant_idx
  ON public.restaurant_external_profile_publish_jobs (restaurant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS restaurant_external_profile_publish_jobs_draft_idx
  ON public.restaurant_external_profile_publish_jobs (draft_id, created_at DESC);

DROP TRIGGER IF EXISTS restaurant_external_profile_publish_jobs_updated_at
ON public.restaurant_external_profile_publish_jobs;

CREATE TRIGGER restaurant_external_profile_publish_jobs_updated_at
  BEFORE UPDATE ON public.restaurant_external_profile_publish_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_restaurant_business_entity_updated_at();

ALTER TABLE public.restaurant_external_profile_publish_jobs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'restaurant_external_profile_publish_jobs'
      AND policyname = 'Service role can manage restaurant external profile publish jobs'
  ) THEN
    CREATE POLICY "Service role can manage restaurant external profile publish jobs"
      ON public.restaurant_external_profile_publish_jobs
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END
$$;

COMMENT ON TABLE public.restaurant_external_profile_publish_jobs IS 'Durable GBP approval publish jobs used for preflight, idempotent Nabatable writes, Google push status, and retry safety.';

COMMIT;
