BEGIN;

CREATE TABLE IF NOT EXISTS public.restaurant_gbp_food_menu_settings (
  restaurant_id uuid PRIMARY KEY REFERENCES public.restaurants(id) ON DELETE CASCADE,
  menu_label text,
  source_url text,
  cuisines text[] NOT NULL DEFAULT ARRAY[]::text[],
  language_code text,
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

DROP TRIGGER IF EXISTS restaurant_gbp_food_menu_settings_updated_at
  ON public.restaurant_gbp_food_menu_settings;

CREATE TRIGGER restaurant_gbp_food_menu_settings_updated_at
  BEFORE UPDATE ON public.restaurant_gbp_food_menu_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_restaurant_menu_updated_at();

ALTER TABLE public.restaurant_gbp_food_menu_settings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'restaurant_gbp_food_menu_settings'
      AND policyname = 'Service role can manage restaurant GBP food menu settings'
  ) THEN
    CREATE POLICY "Service role can manage restaurant GBP food menu settings"
      ON public.restaurant_gbp_food_menu_settings
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END
$$;

ALTER TABLE public.restaurant_gbp_food_menu_import_reviews
  ADD COLUMN IF NOT EXISTS target_kind text NOT NULL DEFAULT 'food';

ALTER TABLE public.restaurant_gbp_food_menu_import_reviews
  ALTER COLUMN google_path DROP NOT NULL;

ALTER TABLE public.restaurant_gbp_food_menu_import_reviews
  DROP CONSTRAINT IF EXISTS restaurant_gbp_food_menu_import_reviews_item_fk,
  DROP CONSTRAINT IF EXISTS restaurant_gbp_food_menu_import_reviews_match_status_check,
  DROP CONSTRAINT IF EXISTS restaurant_gbp_food_menu_import_reviews_decision_action_check,
  DROP CONSTRAINT IF EXISTS restaurant_gbp_food_menu_import_reviews_target_kind_check;

ALTER TABLE public.restaurant_gbp_food_menu_import_reviews
  ADD CONSTRAINT restaurant_gbp_food_menu_import_reviews_match_status_check
    CHECK (match_status IN ('matched', 'unmatched', 'missing_from_google', 'menu_metadata')),
  ADD CONSTRAINT restaurant_gbp_food_menu_import_reviews_decision_action_check
    CHECK (
      decision_action IS NULL
      OR decision_action IN (
        'apply_to_nabatable',
        'ignore_google_change',
        'create_new_item',
        'apply_menu_metadata',
        'mark_inactive',
        'mark_sold_out',
        'delete_local'
      )
    ),
  ADD CONSTRAINT restaurant_gbp_food_menu_import_reviews_target_kind_check
    CHECK (target_kind IN ('food', 'drink'));

DROP INDEX IF EXISTS restaurant_gbp_food_menu_import_reviews_pending_path_idx;

CREATE UNIQUE INDEX IF NOT EXISTS restaurant_gbp_food_menu_import_reviews_pending_identity_idx
  ON public.restaurant_gbp_food_menu_import_reviews (
    restaurant_id,
    target_kind,
    COALESCE(google_path, 'local:' || COALESCE(menu_item_id::text, external_item_id, id::text))
  )
  WHERE decision_status = 'pending';

CREATE INDEX IF NOT EXISTS restaurant_gbp_food_menu_import_reviews_target_kind_idx
  ON public.restaurant_gbp_food_menu_import_reviews (restaurant_id, target_kind, decision_status);

COMMIT;
