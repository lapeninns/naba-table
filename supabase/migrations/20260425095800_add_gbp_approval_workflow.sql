BEGIN;

CREATE TABLE IF NOT EXISTS public.restaurant_external_profile_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  external_profile_id uuid REFERENCES public.restaurant_external_profiles(id) ON DELETE SET NULL,
  provider text NOT NULL DEFAULT 'google_business_profile',
  status text NOT NULL DEFAULT 'review_ready',
  source_snapshot_refs jsonb NOT NULL DEFAULT '{}'::jsonb,
  section_diffs jsonb NOT NULL DEFAULT '[]'::jsonb,
  selected_approvals jsonb NOT NULL DEFAULT '{}'::jsonb,
  core_snapshot_hashes jsonb NOT NULL DEFAULT '{}'::jsonb,
  stale_sections text[] NOT NULL DEFAULT ARRAY[]::text[],
  conflict_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by_user_id uuid,
  approved_by_user_id uuid,
  published_by_user_id uuid,
  fetched_at timestamptz,
  approved_at timestamptz,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT restaurant_external_profile_drafts_provider_check
    CHECK (provider IN ('google_business_profile')),
  CONSTRAINT restaurant_external_profile_drafts_status_check
    CHECK (
      status IN (
        'review_ready',
        'approved',
        'publishing',
        'published',
        'partially_published',
        'stale',
        'failed',
        'archived'
      )
    )
);

CREATE INDEX IF NOT EXISTS restaurant_external_profile_drafts_restaurant_idx
  ON public.restaurant_external_profile_drafts (restaurant_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS restaurant_external_profile_drafts_one_active_idx
  ON public.restaurant_external_profile_drafts (restaurant_id, provider)
  WHERE status IN ('review_ready', 'approved', 'publishing', 'stale', 'failed', 'partially_published');

DROP TRIGGER IF EXISTS restaurant_external_profile_drafts_updated_at
ON public.restaurant_external_profile_drafts;

CREATE TRIGGER restaurant_external_profile_drafts_updated_at
  BEFORE UPDATE ON public.restaurant_external_profile_drafts
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_restaurant_business_entity_updated_at();

CREATE TABLE IF NOT EXISTS public.restaurant_external_profile_publish_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  draft_id uuid REFERENCES public.restaurant_external_profile_drafts(id) ON DELETE SET NULL,
  external_profile_id uuid REFERENCES public.restaurant_external_profiles(id) ON DELETE SET NULL,
  provider text NOT NULL DEFAULT 'google_business_profile',
  direction text NOT NULL,
  affected_sections text[] NOT NULL DEFAULT ARRAY[]::text[],
  old_values jsonb NOT NULL DEFAULT '{}'::jsonb,
  new_values jsonb NOT NULL DEFAULT '{}'::jsonb,
  google_update_masks jsonb NOT NULL DEFAULT '[]'::jsonb,
  result text NOT NULL DEFAULT 'pending',
  errors jsonb NOT NULL DEFAULT '[]'::jsonb,
  actor_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT restaurant_external_profile_publish_events_provider_check
    CHECK (provider IN ('google_business_profile')),
  CONSTRAINT restaurant_external_profile_publish_events_direction_check
    CHECK (direction IN ('pull_from_gbp_to_nabatable', 'push_from_nabatable_to_google')),
  CONSTRAINT restaurant_external_profile_publish_events_result_check
    CHECK (result IN ('pending', 'success', 'failed', 'partial', 'skipped'))
);

CREATE INDEX IF NOT EXISTS restaurant_external_profile_publish_events_restaurant_idx
  ON public.restaurant_external_profile_publish_events (restaurant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS restaurant_external_profile_publish_events_draft_idx
  ON public.restaurant_external_profile_publish_events (draft_id, created_at DESC);

ALTER TABLE public.restaurant_external_profile_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_external_profile_publish_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'restaurant_external_profile_drafts'
      AND policyname = 'Service role can manage restaurant external profile drafts'
  ) THEN
    CREATE POLICY "Service role can manage restaurant external profile drafts"
      ON public.restaurant_external_profile_drafts
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'restaurant_external_profile_publish_events'
      AND policyname = 'Service role can manage restaurant external profile publish events'
  ) THEN
    CREATE POLICY "Service role can manage restaurant external profile publish events"
      ON public.restaurant_external_profile_publish_events
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END
$$;

COMMENT ON TABLE public.restaurant_external_profile_drafts IS 'Reviewable approval drafts generated from external restaurant profile providers before selected data is published into Nabatable core.';
COMMENT ON TABLE public.restaurant_external_profile_publish_events IS 'Immutable audit trail for external profile workflow publish attempts, including Nabatable writes and safe Google pushes.';

COMMIT;
