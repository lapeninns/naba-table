-- Durable storage for Google Business Profile FoodMenus sync.
--
-- This migration is additive. It does not alter Nabatable menu source tables
-- and does not enable any automatic Google write path by itself.
--
-- Tables:
--   * restaurant_gbp_food_menu_snapshots
--       append-only raw/canonical FoodMenus snapshots for pull, projection, and preflight
--   * restaurant_gbp_food_menu_projected_identities
--       deterministic Nabatable item -> Google array-path identity map for the latest projection
--   * restaurant_gbp_food_menu_import_reviews
--       non-mutating Google -> Nabatable suggested patches requiring explicit approval
--   * restaurant_gbp_food_menu_publish_attempts
--       audit rows for future FoodMenus export attempts and Google responses

BEGIN;

CREATE TABLE IF NOT EXISTS public.restaurant_gbp_food_menu_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  external_profile_id uuid REFERENCES public.restaurant_external_profiles(id) ON DELETE SET NULL,
  provider text NOT NULL DEFAULT 'google_business_profile',
  snapshot_kind text NOT NULL,
  source text NOT NULL,
  status text NOT NULL DEFAULT 'succeeded',
  food_menus_name text,
  raw_food_menus jsonb,
  canonical_food_menus jsonb,
  projection_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  snapshot_hash text,
  google_etag text,
  error_code text,
  error_message text,
  pulled_at timestamptz,
  created_by_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT restaurant_gbp_food_menu_snapshots_provider_check
    CHECK (provider IN ('google_business_profile')),
  CONSTRAINT restaurant_gbp_food_menu_snapshots_kind_check
    CHECK (snapshot_kind IN ('google_pull', 'nabatable_projection', 'preflight')),
  CONSTRAINT restaurant_gbp_food_menu_snapshots_source_check
    CHECK (source IN ('manual', 'scheduled', 'preflight', 'publish')),
  CONSTRAINT restaurant_gbp_food_menu_snapshots_status_check
    CHECK (status IN ('succeeded', 'failed'))
);

CREATE INDEX IF NOT EXISTS restaurant_gbp_food_menu_snapshots_restaurant_idx
  ON public.restaurant_gbp_food_menu_snapshots (restaurant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS restaurant_gbp_food_menu_snapshots_kind_status_idx
  ON public.restaurant_gbp_food_menu_snapshots (restaurant_id, snapshot_kind, status, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS restaurant_gbp_food_menu_snapshots_hash_idx
  ON public.restaurant_gbp_food_menu_snapshots (restaurant_id, snapshot_kind, snapshot_hash)
  WHERE snapshot_hash IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.restaurant_gbp_food_menu_projected_identities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  snapshot_id uuid NOT NULL REFERENCES public.restaurant_gbp_food_menu_snapshots(id) ON DELETE CASCADE,
  menu_item_id uuid,
  external_item_id text NOT NULL,
  stable_key text NOT NULL,
  item_name text NOT NULL,
  section_key text NOT NULL,
  section_label text NOT NULL,
  google_path text NOT NULL,
  google_option_paths jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT restaurant_gbp_food_menu_projected_identities_option_paths_check
    CHECK (jsonb_typeof(google_option_paths) = 'array'),
  CONSTRAINT restaurant_gbp_food_menu_projected_identities_item_fk
    FOREIGN KEY (restaurant_id, menu_item_id)
    REFERENCES public.restaurant_menu_items(restaurant_id, id)
    ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS restaurant_gbp_food_menu_projected_identities_stable_idx
  ON public.restaurant_gbp_food_menu_projected_identities (restaurant_id, snapshot_id, stable_key);

CREATE UNIQUE INDEX IF NOT EXISTS restaurant_gbp_food_menu_projected_identities_path_idx
  ON public.restaurant_gbp_food_menu_projected_identities (restaurant_id, snapshot_id, google_path);

CREATE INDEX IF NOT EXISTS restaurant_gbp_food_menu_projected_identities_item_idx
  ON public.restaurant_gbp_food_menu_projected_identities (restaurant_id, menu_item_id);

CREATE TABLE IF NOT EXISTS public.restaurant_gbp_food_menu_import_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  google_snapshot_id uuid REFERENCES public.restaurant_gbp_food_menu_snapshots(id) ON DELETE SET NULL,
  projection_snapshot_id uuid REFERENCES public.restaurant_gbp_food_menu_snapshots(id) ON DELETE SET NULL,
  menu_item_id uuid,
  external_item_id text,
  google_path text NOT NULL,
  google_section_label text,
  google_item_name text,
  match_status text NOT NULL,
  match_confidence text NOT NULL,
  suggested_patch jsonb,
  warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
  decision_status text NOT NULL DEFAULT 'pending',
  decision_action text,
  decided_by_user_id uuid,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT restaurant_gbp_food_menu_import_reviews_match_status_check
    CHECK (match_status IN ('matched', 'unmatched')),
  CONSTRAINT restaurant_gbp_food_menu_import_reviews_match_confidence_check
    CHECK (match_confidence IN ('previous_identity', 'section_name_price', 'section_name', 'none')),
  CONSTRAINT restaurant_gbp_food_menu_import_reviews_decision_status_check
    CHECK (decision_status IN ('pending', 'approved', 'ignored', 'applied', 'superseded')),
  CONSTRAINT restaurant_gbp_food_menu_import_reviews_decision_action_check
    CHECK (
      decision_action IS NULL
      OR decision_action IN ('apply_to_nabatable', 'ignore_google_change', 'create_new_item')
    ),
  CONSTRAINT restaurant_gbp_food_menu_import_reviews_warnings_check
    CHECK (jsonb_typeof(warnings) = 'array'),
  CONSTRAINT restaurant_gbp_food_menu_import_reviews_suggested_patch_check
    CHECK (suggested_patch IS NULL OR jsonb_typeof(suggested_patch) = 'object'),
  CONSTRAINT restaurant_gbp_food_menu_import_reviews_item_fk
    FOREIGN KEY (restaurant_id, menu_item_id)
    REFERENCES public.restaurant_menu_items(restaurant_id, id)
    ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS restaurant_gbp_food_menu_import_reviews_pending_path_idx
  ON public.restaurant_gbp_food_menu_import_reviews (restaurant_id, google_path)
  WHERE decision_status = 'pending';

CREATE INDEX IF NOT EXISTS restaurant_gbp_food_menu_import_reviews_restaurant_status_idx
  ON public.restaurant_gbp_food_menu_import_reviews (restaurant_id, decision_status, updated_at DESC);

CREATE INDEX IF NOT EXISTS restaurant_gbp_food_menu_import_reviews_item_idx
  ON public.restaurant_gbp_food_menu_import_reviews (restaurant_id, menu_item_id);

DROP TRIGGER IF EXISTS restaurant_gbp_food_menu_import_reviews_updated_at
  ON public.restaurant_gbp_food_menu_import_reviews;

CREATE TRIGGER restaurant_gbp_food_menu_import_reviews_updated_at
  BEFORE UPDATE ON public.restaurant_gbp_food_menu_import_reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_restaurant_menu_updated_at();

CREATE TABLE IF NOT EXISTS public.restaurant_gbp_food_menu_publish_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  projection_snapshot_id uuid REFERENCES public.restaurant_gbp_food_menu_snapshots(id) ON DELETE SET NULL,
  baseline_google_snapshot_id uuid REFERENCES public.restaurant_gbp_food_menu_snapshots(id) ON DELETE SET NULL,
  provider text NOT NULL DEFAULT 'google_business_profile',
  status text NOT NULL DEFAULT 'pending',
  publish_mode text NOT NULL DEFAULT 'manual',
  food_menus_name text NOT NULL,
  update_mask text[] NOT NULL DEFAULT ARRAY['menus']::text[],
  projected_payload jsonb NOT NULL,
  google_response jsonb,
  baseline_google_hash text,
  projected_payload_hash text,
  error_code text,
  error_message text,
  requested_by_user_id uuid,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT restaurant_gbp_food_menu_publish_attempts_provider_check
    CHECK (provider IN ('google_business_profile')),
  CONSTRAINT restaurant_gbp_food_menu_publish_attempts_status_check
    CHECK (status IN ('pending', 'preflight_failed', 'running', 'succeeded', 'failed', 'cancelled')),
  CONSTRAINT restaurant_gbp_food_menu_publish_attempts_mode_check
    CHECK (publish_mode IN ('manual', 'scheduled', 'dry_run')),
  CONSTRAINT restaurant_gbp_food_menu_publish_attempts_projected_payload_check
    CHECK (jsonb_typeof(projected_payload) = 'object')
);

CREATE INDEX IF NOT EXISTS restaurant_gbp_food_menu_publish_attempts_restaurant_idx
  ON public.restaurant_gbp_food_menu_publish_attempts (restaurant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS restaurant_gbp_food_menu_publish_attempts_status_idx
  ON public.restaurant_gbp_food_menu_publish_attempts (restaurant_id, status, updated_at DESC);

DROP TRIGGER IF EXISTS restaurant_gbp_food_menu_publish_attempts_updated_at
  ON public.restaurant_gbp_food_menu_publish_attempts;

CREATE TRIGGER restaurant_gbp_food_menu_publish_attempts_updated_at
  BEFORE UPDATE ON public.restaurant_gbp_food_menu_publish_attempts
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_restaurant_menu_updated_at();

ALTER TABLE public.restaurant_gbp_food_menu_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_gbp_food_menu_projected_identities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_gbp_food_menu_import_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_gbp_food_menu_publish_attempts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'restaurant_gbp_food_menu_snapshots'
      AND policyname = 'Service role can manage restaurant GBP food menu snapshots'
  ) THEN
    CREATE POLICY "Service role can manage restaurant GBP food menu snapshots"
      ON public.restaurant_gbp_food_menu_snapshots
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'restaurant_gbp_food_menu_projected_identities'
      AND policyname = 'Service role can manage restaurant GBP food menu projected identities'
  ) THEN
    CREATE POLICY "Service role can manage restaurant GBP food menu projected identities"
      ON public.restaurant_gbp_food_menu_projected_identities
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'restaurant_gbp_food_menu_import_reviews'
      AND policyname = 'Service role can manage restaurant GBP food menu import reviews'
  ) THEN
    CREATE POLICY "Service role can manage restaurant GBP food menu import reviews"
      ON public.restaurant_gbp_food_menu_import_reviews
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'restaurant_gbp_food_menu_publish_attempts'
      AND policyname = 'Service role can manage restaurant GBP food menu publish attempts'
  ) THEN
    CREATE POLICY "Service role can manage restaurant GBP food menu publish attempts"
      ON public.restaurant_gbp_food_menu_publish_attempts
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END
$$;

COMMIT;
