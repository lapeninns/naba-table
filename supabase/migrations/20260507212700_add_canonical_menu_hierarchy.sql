-- Canonical Google FoodMenus-akin hierarchy for Nabatable menus.
--
-- This migration is intentionally additive. It prepares normalized
-- menu/section/item/option storage while leaving existing item-first food,
-- drinks, import, and GBP sync paths readable during the adapter period.

BEGIN;

CREATE OR REPLACE FUNCTION public.is_google_menu_label_array(value jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN jsonb_typeof(value) <> 'array' THEN false
    ELSE NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(value) AS entry(label)
      WHERE jsonb_typeof(entry.label) <> 'object'
        OR NULLIF(BTRIM(COALESCE(entry.label ->> 'displayName', '')), '') IS NULL
        OR NULLIF(BTRIM(COALESCE(entry.label ->> 'languageCode', '')), '') IS NULL
        OR (
          entry.label ? 'description'
          AND jsonb_typeof(entry.label -> 'description') <> 'string'
        )
    )
  END;
$$;

CREATE OR REPLACE FUNCTION public.is_restaurant_menu_json_object(value jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT jsonb_typeof(value) = 'object';
$$;

CREATE TABLE IF NOT EXISTS public.restaurant_menus (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  labels jsonb NOT NULL DEFAULT '[]'::jsonb,
  source_url text,
  cuisines text[] NOT NULL DEFAULT ARRAY[]::text[],
  default_language_code text NOT NULL DEFAULT 'en-GB',
  menu_kind text NOT NULL DEFAULT 'food',
  display_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  legacy_source jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT restaurant_menus_restaurant_id_id_unique UNIQUE (restaurant_id, id),
  CONSTRAINT restaurant_menus_labels_check CHECK (public.is_google_menu_label_array(labels)),
  CONSTRAINT restaurant_menus_legacy_source_check CHECK (public.is_restaurant_menu_json_object(legacy_source)),
  CONSTRAINT restaurant_menus_default_language_code_check
    CHECK (NULLIF(BTRIM(default_language_code), '') IS NOT NULL),
  CONSTRAINT restaurant_menus_menu_kind_check CHECK (menu_kind IN ('food', 'drinks', 'mixed'))
);

CREATE TABLE IF NOT EXISTS public.restaurant_menu_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  menu_id uuid NOT NULL,
  labels jsonb NOT NULL DEFAULT '[]'::jsonb,
  display_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  legacy_category text,
  legacy_subcategory text,
  legacy_source jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT restaurant_menu_sections_restaurant_id_id_unique UNIQUE (restaurant_id, id),
  CONSTRAINT restaurant_menu_sections_menu_fk
    FOREIGN KEY (restaurant_id, menu_id)
    REFERENCES public.restaurant_menus(restaurant_id, id)
    ON DELETE CASCADE,
  CONSTRAINT restaurant_menu_sections_labels_check CHECK (public.is_google_menu_label_array(labels)),
  CONSTRAINT restaurant_menu_sections_legacy_source_check CHECK (public.is_restaurant_menu_json_object(legacy_source))
);

ALTER TABLE public.restaurant_menu_items
  ADD COLUMN IF NOT EXISTS menu_id uuid,
  ADD COLUMN IF NOT EXISTS section_id uuid,
  ADD COLUMN IF NOT EXISTS item_kind text NOT NULL DEFAULT 'food',
  ADD COLUMN IF NOT EXISTS labels jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS google_attributes jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS google_media_keys text[] NOT NULL DEFAULT ARRAY[]::text[],
  ADD COLUMN IF NOT EXISTS local_media jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS legacy_source jsonb NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'restaurant_menu_items_menu_fk'
      AND conrelid = 'public.restaurant_menu_items'::regclass
  ) THEN
    ALTER TABLE public.restaurant_menu_items
      ADD CONSTRAINT restaurant_menu_items_menu_fk
        FOREIGN KEY (restaurant_id, menu_id)
        REFERENCES public.restaurant_menus(restaurant_id, id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'restaurant_menu_items_section_fk'
      AND conrelid = 'public.restaurant_menu_items'::regclass
  ) THEN
    ALTER TABLE public.restaurant_menu_items
      ADD CONSTRAINT restaurant_menu_items_section_fk
        FOREIGN KEY (restaurant_id, section_id)
        REFERENCES public.restaurant_menu_sections(restaurant_id, id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'restaurant_menu_items_item_kind_check'
      AND conrelid = 'public.restaurant_menu_items'::regclass
  ) THEN
    ALTER TABLE public.restaurant_menu_items
      ADD CONSTRAINT restaurant_menu_items_item_kind_check
        CHECK (item_kind IN ('food', 'drink'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'restaurant_menu_items_labels_check'
      AND conrelid = 'public.restaurant_menu_items'::regclass
  ) THEN
    ALTER TABLE public.restaurant_menu_items
      ADD CONSTRAINT restaurant_menu_items_labels_check
        CHECK (public.is_google_menu_label_array(labels));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'restaurant_menu_items_google_attrs_check'
      AND conrelid = 'public.restaurant_menu_items'::regclass
  ) THEN
    ALTER TABLE public.restaurant_menu_items
      ADD CONSTRAINT restaurant_menu_items_google_attrs_check
        CHECK (public.is_restaurant_menu_json_object(google_attributes));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'restaurant_menu_items_local_media_check'
      AND conrelid = 'public.restaurant_menu_items'::regclass
  ) THEN
    ALTER TABLE public.restaurant_menu_items
      ADD CONSTRAINT restaurant_menu_items_local_media_check
        CHECK (public.is_restaurant_menu_json_object(local_media));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'restaurant_menu_items_legacy_source_check'
      AND conrelid = 'public.restaurant_menu_items'::regclass
  ) THEN
    ALTER TABLE public.restaurant_menu_items
      ADD CONSTRAINT restaurant_menu_items_legacy_source_check
        CHECK (public.is_restaurant_menu_json_object(legacy_source));
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.restaurant_menu_item_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  menu_item_id uuid NOT NULL,
  external_option_id text,
  labels jsonb NOT NULL DEFAULT '[]'::jsonb,
  google_attributes jsonb NOT NULL DEFAULT '{}'::jsonb,
  google_media_keys text[] NOT NULL DEFAULT ARRAY[]::text[],
  display_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  legacy_source jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT restaurant_menu_item_options_item_fk
    FOREIGN KEY (restaurant_id, menu_item_id)
    REFERENCES public.restaurant_menu_items(restaurant_id, id)
    ON DELETE CASCADE,
  CONSTRAINT restaurant_menu_item_options_labels_check
    CHECK (public.is_google_menu_label_array(labels)),
  CONSTRAINT restaurant_menu_item_options_google_attrs_check
    CHECK (public.is_restaurant_menu_json_object(google_attributes)),
  CONSTRAINT restaurant_menu_item_options_legacy_source_check
    CHECK (public.is_restaurant_menu_json_object(legacy_source))
);

CREATE TABLE IF NOT EXISTS public.restaurant_menu_item_extensions (
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  menu_item_id uuid NOT NULL,
  drink_profile jsonb NOT NULL DEFAULT '{}'::jsonb,
  recommendation_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  availability_policy jsonb NOT NULL DEFAULT '{}'::jsonb,
  customization_controls jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  PRIMARY KEY (restaurant_id, menu_item_id),
  CONSTRAINT restaurant_menu_item_extensions_item_fk
    FOREIGN KEY (restaurant_id, menu_item_id)
    REFERENCES public.restaurant_menu_items(restaurant_id, id)
    ON DELETE CASCADE,
  CONSTRAINT restaurant_menu_item_extensions_drink_profile_check
    CHECK (public.is_restaurant_menu_json_object(drink_profile)),
  CONSTRAINT restaurant_menu_item_extensions_recommendation_check
    CHECK (public.is_restaurant_menu_json_object(recommendation_metadata)),
  CONSTRAINT restaurant_menu_item_extensions_availability_check
    CHECK (public.is_restaurant_menu_json_object(availability_policy)),
  CONSTRAINT restaurant_menu_item_extensions_customization_check
    CHECK (public.is_restaurant_menu_json_object(customization_controls)),
  CONSTRAINT restaurant_menu_item_extensions_source_metadata_check
    CHECK (public.is_restaurant_menu_json_object(source_metadata))
);

CREATE INDEX IF NOT EXISTS restaurant_menus_restaurant_order_idx
  ON public.restaurant_menus (restaurant_id, active, display_order);

CREATE INDEX IF NOT EXISTS restaurant_menus_restaurant_kind_idx
  ON public.restaurant_menus (restaurant_id, menu_kind, active);

CREATE INDEX IF NOT EXISTS restaurant_menu_sections_menu_order_idx
  ON public.restaurant_menu_sections (restaurant_id, menu_id, active, display_order);

CREATE INDEX IF NOT EXISTS restaurant_menu_sections_legacy_group_idx
  ON public.restaurant_menu_sections (restaurant_id, legacy_category, legacy_subcategory);

CREATE INDEX IF NOT EXISTS restaurant_menu_items_hierarchy_order_idx
  ON public.restaurant_menu_items (restaurant_id, menu_id, section_id, display_order);

CREATE INDEX IF NOT EXISTS restaurant_menu_items_kind_idx
  ON public.restaurant_menu_items (restaurant_id, item_kind, active);

CREATE INDEX IF NOT EXISTS restaurant_menu_item_options_item_order_idx
  ON public.restaurant_menu_item_options (restaurant_id, menu_item_id, active, display_order);

CREATE UNIQUE INDEX IF NOT EXISTS restaurant_menu_item_options_external_idx
  ON public.restaurant_menu_item_options (restaurant_id, menu_item_id, external_option_id)
  WHERE external_option_id IS NOT NULL;

DROP TRIGGER IF EXISTS restaurant_menus_updated_at
ON public.restaurant_menus;

CREATE TRIGGER restaurant_menus_updated_at
  BEFORE UPDATE ON public.restaurant_menus
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_restaurant_menu_updated_at();

DROP TRIGGER IF EXISTS restaurant_menu_sections_updated_at
ON public.restaurant_menu_sections;

CREATE TRIGGER restaurant_menu_sections_updated_at
  BEFORE UPDATE ON public.restaurant_menu_sections
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_restaurant_menu_updated_at();

DROP TRIGGER IF EXISTS restaurant_menu_item_options_updated_at
ON public.restaurant_menu_item_options;

CREATE TRIGGER restaurant_menu_item_options_updated_at
  BEFORE UPDATE ON public.restaurant_menu_item_options
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_restaurant_menu_updated_at();

DROP TRIGGER IF EXISTS restaurant_menu_item_extensions_updated_at
ON public.restaurant_menu_item_extensions;

CREATE TRIGGER restaurant_menu_item_extensions_updated_at
  BEFORE UPDATE ON public.restaurant_menu_item_extensions
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_restaurant_menu_updated_at();

ALTER TABLE public.restaurant_menus ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_menu_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_menu_item_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_menu_item_extensions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'restaurant_menus'
      AND policyname = 'Service role can manage restaurant menus'
  ) THEN
    CREATE POLICY "Service role can manage restaurant menus"
      ON public.restaurant_menus
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'restaurant_menu_sections'
      AND policyname = 'Service role can manage restaurant menu sections'
  ) THEN
    CREATE POLICY "Service role can manage restaurant menu sections"
      ON public.restaurant_menu_sections
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'restaurant_menu_item_options'
      AND policyname = 'Service role can manage restaurant menu item options'
  ) THEN
    CREATE POLICY "Service role can manage restaurant menu item options"
      ON public.restaurant_menu_item_options
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'restaurant_menu_item_extensions'
      AND policyname = 'Service role can manage restaurant menu item extensions'
  ) THEN
    CREATE POLICY "Service role can manage restaurant menu item extensions"
      ON public.restaurant_menu_item_extensions
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END
$$;

COMMENT ON TABLE public.restaurant_menus IS
  'Canonical Google FoodMenus-like menu containers. Additive foundation for food, drinks, and mixed menus.';
COMMENT ON TABLE public.restaurant_menu_sections IS
  'Canonical menu sections. legacy_category and legacy_subcategory preserve adapter-period grouping compatibility.';
COMMENT ON COLUMN public.restaurant_menu_items.item_kind IS
  'Canonical item kind for unified food/drink hierarchy. Existing food rows default to food; migrated drinks use drink.';
COMMENT ON COLUMN public.restaurant_menu_items.google_attributes IS
  'Google FoodMenuItemAttributes-compatible JSONB only. Nabatable-only fields belong in restaurant_menu_item_extensions.';
COMMENT ON COLUMN public.restaurant_menu_items.google_media_keys IS
  'Google media keys only. Local image URLs remain in image_url/local_media and must not be projected as media keys.';
COMMENT ON TABLE public.restaurant_menu_item_options IS
  'Google FoodMenuItemOption-compatible options. Operational modifier groups/options remain separate Nabatable customization.';
COMMENT ON TABLE public.restaurant_menu_item_extensions IS
  'Nabatable-only menu item extension storage for drink profile, recommendation, availability, and customization controls.';

COMMIT;
