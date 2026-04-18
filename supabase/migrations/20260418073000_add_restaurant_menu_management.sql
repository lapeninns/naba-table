BEGIN;

CREATE TABLE IF NOT EXISTS public.restaurant_menu_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  external_item_id text NOT NULL,
  item_name text NOT NULL,
  category text NOT NULL,
  subcategory text,
  short_description text,
  full_description text,
  base_price numeric(10, 2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'GBP',
  service_time text,
  availability_status text NOT NULL DEFAULT 'available',
  key_ingredients text[] NOT NULL DEFAULT ARRAY[]::text[],
  main_protein_or_base text,
  cooking_style text,
  preparation_method text,
  flavor_profile text,
  texture text,
  spice_level text,
  spice_adjustable boolean NOT NULL DEFAULT false,
  portion_size text,
  shareable boolean NOT NULL DEFAULT false,
  recommendation_tags text[] NOT NULL DEFAULT ARRAY[]::text[],
  pairings text[] NOT NULL DEFAULT ARRAY[]::text[],
  signature_score integer,
  popularity_score integer,
  dietary_tags text[] NOT NULL DEFAULT ARRAY[]::text[],
  allergens_contains text[] NOT NULL DEFAULT ARRAY[]::text[],
  allergens_may_contain text[] NOT NULL DEFAULT ARRAY[]::text[],
  removable_ingredients text[] NOT NULL DEFAULT ARRAY[]::text[],
  substitutions_allowed boolean NOT NULL DEFAULT false,
  can_be_made_vegetarian boolean NOT NULL DEFAULT false,
  can_be_made_vegan boolean NOT NULL DEFAULT false,
  can_be_made_gluten_free boolean NOT NULL DEFAULT false,
  customization_rules text,
  serving_notes text,
  active boolean NOT NULL DEFAULT true,
  seasonal boolean NOT NULL DEFAULT false,
  limited_time boolean NOT NULL DEFAULT false,
  sold_out boolean NOT NULL DEFAULT false,
  display_order integer NOT NULL DEFAULT 0,
  image_url text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT restaurant_menu_items_external_item_unique UNIQUE (restaurant_id, external_item_id),
  CONSTRAINT restaurant_menu_items_restaurant_id_id_unique UNIQUE (restaurant_id, id),
  CONSTRAINT restaurant_menu_items_availability_status_check CHECK (availability_status IN ('available', 'unavailable')),
  CONSTRAINT restaurant_menu_items_signature_score_check CHECK (signature_score IS NULL OR signature_score BETWEEN 0 AND 100),
  CONSTRAINT restaurant_menu_items_popularity_score_check CHECK (popularity_score IS NULL OR popularity_score BETWEEN 0 AND 100)
);

CREATE TABLE IF NOT EXISTS public.restaurant_menu_modifier_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  menu_item_id uuid NOT NULL,
  external_modifier_group_id text NOT NULL,
  group_name text NOT NULL,
  required boolean NOT NULL DEFAULT false,
  min_select integer NOT NULL DEFAULT 0,
  max_select integer NOT NULL DEFAULT 1,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT restaurant_menu_modifier_groups_external_unique UNIQUE (restaurant_id, external_modifier_group_id),
  CONSTRAINT restaurant_menu_modifier_groups_restaurant_id_id_unique UNIQUE (restaurant_id, id),
  CONSTRAINT restaurant_menu_modifier_groups_item_fk
    FOREIGN KEY (restaurant_id, menu_item_id)
    REFERENCES public.restaurant_menu_items(restaurant_id, id)
    ON DELETE CASCADE,
  CONSTRAINT restaurant_menu_modifier_groups_min_select_check CHECK (min_select >= 0),
  CONSTRAINT restaurant_menu_modifier_groups_max_select_check CHECK (max_select >= 0),
  CONSTRAINT restaurant_menu_modifier_groups_range_check CHECK (min_select <= max_select),
  CONSTRAINT restaurant_menu_modifier_groups_required_check CHECK ((NOT required) OR min_select >= 1)
);

CREATE TABLE IF NOT EXISTS public.restaurant_menu_modifier_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  modifier_group_id uuid NOT NULL,
  external_modifier_option_id text NOT NULL,
  option_name text NOT NULL,
  price_delta numeric(10, 2) NOT NULL DEFAULT 0,
  default_selected boolean NOT NULL DEFAULT false,
  availability_status text NOT NULL DEFAULT 'available',
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT restaurant_menu_modifier_options_external_unique UNIQUE (restaurant_id, external_modifier_option_id),
  CONSTRAINT restaurant_menu_modifier_options_group_fk
    FOREIGN KEY (restaurant_id, modifier_group_id)
    REFERENCES public.restaurant_menu_modifier_groups(restaurant_id, id)
    ON DELETE CASCADE,
  CONSTRAINT restaurant_menu_modifier_options_availability_status_check CHECK (availability_status IN ('available', 'unavailable'))
);

CREATE INDEX IF NOT EXISTS restaurant_menu_items_restaurant_display_order_idx
  ON public.restaurant_menu_items (restaurant_id, display_order);

CREATE INDEX IF NOT EXISTS restaurant_menu_items_restaurant_category_idx
  ON public.restaurant_menu_items (restaurant_id, category);

CREATE INDEX IF NOT EXISTS restaurant_menu_items_restaurant_subcategory_idx
  ON public.restaurant_menu_items (restaurant_id, subcategory);

CREATE INDEX IF NOT EXISTS restaurant_menu_items_restaurant_active_sold_out_idx
  ON public.restaurant_menu_items (restaurant_id, active, sold_out);

CREATE INDEX IF NOT EXISTS restaurant_menu_items_restaurant_availability_idx
  ON public.restaurant_menu_items (restaurant_id, availability_status);

CREATE INDEX IF NOT EXISTS restaurant_menu_modifier_groups_item_idx
  ON public.restaurant_menu_modifier_groups (restaurant_id, menu_item_id, display_order);

CREATE INDEX IF NOT EXISTS restaurant_menu_modifier_options_group_idx
  ON public.restaurant_menu_modifier_options (restaurant_id, modifier_group_id, display_order);

CREATE OR REPLACE FUNCTION public.touch_restaurant_menu_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := timezone('utc', now());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS restaurant_menu_items_updated_at
ON public.restaurant_menu_items;

CREATE TRIGGER restaurant_menu_items_updated_at
  BEFORE UPDATE ON public.restaurant_menu_items
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_restaurant_menu_updated_at();

DROP TRIGGER IF EXISTS restaurant_menu_modifier_groups_updated_at
ON public.restaurant_menu_modifier_groups;

CREATE TRIGGER restaurant_menu_modifier_groups_updated_at
  BEFORE UPDATE ON public.restaurant_menu_modifier_groups
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_restaurant_menu_updated_at();

DROP TRIGGER IF EXISTS restaurant_menu_modifier_options_updated_at
ON public.restaurant_menu_modifier_options;

CREATE TRIGGER restaurant_menu_modifier_options_updated_at
  BEFORE UPDATE ON public.restaurant_menu_modifier_options
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_restaurant_menu_updated_at();

ALTER TABLE public.restaurant_menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_menu_modifier_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_menu_modifier_options ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'restaurant_menu_items'
      AND policyname = 'Service role can manage restaurant menu items'
  ) THEN
    CREATE POLICY "Service role can manage restaurant menu items"
      ON public.restaurant_menu_items
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'restaurant_menu_modifier_groups'
      AND policyname = 'Service role can manage restaurant menu modifier groups'
  ) THEN
    CREATE POLICY "Service role can manage restaurant menu modifier groups"
      ON public.restaurant_menu_modifier_groups
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'restaurant_menu_modifier_options'
      AND policyname = 'Service role can manage restaurant menu modifier options'
  ) THEN
    CREATE POLICY "Service role can manage restaurant menu modifier options"
      ON public.restaurant_menu_modifier_options
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.upsert_restaurant_menu_item_with_modifiers(
  p_restaurant_id uuid,
  p_item jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item_id uuid;
  v_item jsonb;
  v_group jsonb;
  v_option jsonb;
  v_group_id uuid;
  v_group_index integer := 0;
  v_option_index integer := 0;
  v_modifier_groups jsonb := COALESCE(p_item -> 'modifierGroups', '[]'::jsonb);
  v_external_item_id text := NULLIF(BTRIM(COALESCE(p_item ->> 'externalItemId', '')), '');
  v_item_name text := NULLIF(BTRIM(COALESCE(p_item ->> 'itemName', '')), '');
  v_category text := NULLIF(BTRIM(COALESCE(p_item ->> 'category', '')), '');
  v_availability_status text := LOWER(COALESCE(NULLIF(BTRIM(p_item ->> 'availabilityStatus'), ''), 'available'));
BEGIN
  IF p_restaurant_id IS NULL THEN
    RAISE EXCEPTION 'Restaurant id is required';
  END IF;

  IF p_item IS NULL OR jsonb_typeof(p_item) <> 'object' THEN
    RAISE EXCEPTION 'Item payload must be an object';
  END IF;

  IF v_external_item_id IS NULL THEN
    RAISE EXCEPTION 'externalItemId is required';
  END IF;

  IF v_item_name IS NULL THEN
    RAISE EXCEPTION 'itemName is required';
  END IF;

  IF v_category IS NULL THEN
    RAISE EXCEPTION 'category is required';
  END IF;

  IF v_availability_status NOT IN ('available', 'unavailable') THEN
    RAISE EXCEPTION 'availabilityStatus must be available or unavailable';
  END IF;

  IF jsonb_typeof(v_modifier_groups) <> 'array' THEN
    RAISE EXCEPTION 'modifierGroups must be an array';
  END IF;

  v_item := jsonb_build_object(
    'restaurant_id', p_restaurant_id,
    'external_item_id', v_external_item_id,
    'item_name', v_item_name,
    'category', v_category,
    'subcategory', NULLIF(BTRIM(COALESCE(p_item ->> 'subcategory', '')), ''),
    'short_description', NULLIF(BTRIM(COALESCE(p_item ->> 'shortDescription', '')), ''),
    'full_description', NULLIF(BTRIM(COALESCE(p_item ->> 'fullDescription', '')), ''),
    'base_price', COALESCE((p_item ->> 'basePrice')::numeric(10, 2), 0),
    'currency', UPPER(COALESCE(NULLIF(BTRIM(p_item ->> 'currency'), ''), 'GBP')),
    'service_time', NULLIF(BTRIM(COALESCE(p_item ->> 'serviceTime', '')), ''),
    'availability_status', v_availability_status,
    'key_ingredients', COALESCE(p_item -> 'keyIngredients', '[]'::jsonb),
    'main_protein_or_base', NULLIF(BTRIM(COALESCE(p_item ->> 'mainProteinOrBase', '')), ''),
    'cooking_style', NULLIF(BTRIM(COALESCE(p_item ->> 'cookingStyle', '')), ''),
    'preparation_method', NULLIF(BTRIM(COALESCE(p_item ->> 'preparationMethod', '')), ''),
    'flavor_profile', NULLIF(BTRIM(COALESCE(p_item ->> 'flavorProfile', '')), ''),
    'texture', NULLIF(BTRIM(COALESCE(p_item ->> 'texture', '')), ''),
    'spice_level', NULLIF(BTRIM(COALESCE(p_item ->> 'spiceLevel', '')), ''),
    'spice_adjustable', COALESCE((p_item ->> 'spiceAdjustable')::boolean, false),
    'portion_size', NULLIF(BTRIM(COALESCE(p_item ->> 'portionSize', '')), ''),
    'shareable', COALESCE((p_item ->> 'shareable')::boolean, false),
    'recommendation_tags', COALESCE(p_item -> 'recommendationTags', '[]'::jsonb),
    'pairings', COALESCE(p_item -> 'pairings', '[]'::jsonb),
    'signature_score', CASE WHEN p_item ? 'signatureScore' AND (p_item ->> 'signatureScore') <> '' THEN (p_item ->> 'signatureScore')::integer ELSE NULL END,
    'popularity_score', CASE WHEN p_item ? 'popularityScore' AND (p_item ->> 'popularityScore') <> '' THEN (p_item ->> 'popularityScore')::integer ELSE NULL END,
    'dietary_tags', COALESCE(p_item -> 'dietaryTags', '[]'::jsonb),
    'allergens_contains', COALESCE(p_item -> 'allergensContains', '[]'::jsonb),
    'allergens_may_contain', COALESCE(p_item -> 'allergensMayContain', '[]'::jsonb),
    'removable_ingredients', COALESCE(p_item -> 'removableIngredients', '[]'::jsonb),
    'substitutions_allowed', COALESCE((p_item ->> 'substitutionsAllowed')::boolean, false),
    'can_be_made_vegetarian', COALESCE((p_item ->> 'canBeMadeVegetarian')::boolean, false),
    'can_be_made_vegan', COALESCE((p_item ->> 'canBeMadeVegan')::boolean, false),
    'can_be_made_gluten_free', COALESCE((p_item ->> 'canBeMadeGlutenFree')::boolean, false),
    'customization_rules', NULLIF(BTRIM(COALESCE(p_item ->> 'customizationRules', '')), ''),
    'serving_notes', NULLIF(BTRIM(COALESCE(p_item ->> 'servingNotes', '')), ''),
    'active', COALESCE((p_item ->> 'active')::boolean, true),
    'seasonal', COALESCE((p_item ->> 'seasonal')::boolean, false),
    'limited_time', COALESCE((p_item ->> 'limitedTime')::boolean, false),
    'sold_out', COALESCE((p_item ->> 'soldOut')::boolean, false),
    'display_order', COALESCE((p_item ->> 'displayOrder')::integer, 0),
    'image_url', NULLIF(BTRIM(COALESCE(p_item ->> 'imageUrl', '')), '')
  );

  INSERT INTO public.restaurant_menu_items (
    restaurant_id,
    external_item_id,
    item_name,
    category,
    subcategory,
    short_description,
    full_description,
    base_price,
    currency,
    service_time,
    availability_status,
    key_ingredients,
    main_protein_or_base,
    cooking_style,
    preparation_method,
    flavor_profile,
    texture,
    spice_level,
    spice_adjustable,
    portion_size,
    shareable,
    recommendation_tags,
    pairings,
    signature_score,
    popularity_score,
    dietary_tags,
    allergens_contains,
    allergens_may_contain,
    removable_ingredients,
    substitutions_allowed,
    can_be_made_vegetarian,
    can_be_made_vegan,
    can_be_made_gluten_free,
    customization_rules,
    serving_notes,
    active,
    seasonal,
    limited_time,
    sold_out,
    display_order,
    image_url
  )
  VALUES (
    p_restaurant_id,
    v_external_item_id,
    v_item_name,
    v_category,
    v_item ->> 'subcategory',
    v_item ->> 'short_description',
    v_item ->> 'full_description',
    (v_item ->> 'base_price')::numeric(10, 2),
    v_item ->> 'currency',
    v_item ->> 'service_time',
    v_item ->> 'availability_status',
    ARRAY(SELECT jsonb_array_elements_text(v_item -> 'key_ingredients')),
    v_item ->> 'main_protein_or_base',
    v_item ->> 'cooking_style',
    v_item ->> 'preparation_method',
    v_item ->> 'flavor_profile',
    v_item ->> 'texture',
    v_item ->> 'spice_level',
    (v_item ->> 'spice_adjustable')::boolean,
    v_item ->> 'portion_size',
    (v_item ->> 'shareable')::boolean,
    ARRAY(SELECT jsonb_array_elements_text(v_item -> 'recommendation_tags')),
    ARRAY(SELECT jsonb_array_elements_text(v_item -> 'pairings')),
    CASE WHEN v_item ->> 'signature_score' IS NULL THEN NULL ELSE (v_item ->> 'signature_score')::integer END,
    CASE WHEN v_item ->> 'popularity_score' IS NULL THEN NULL ELSE (v_item ->> 'popularity_score')::integer END,
    ARRAY(SELECT jsonb_array_elements_text(v_item -> 'dietary_tags')),
    ARRAY(SELECT jsonb_array_elements_text(v_item -> 'allergens_contains')),
    ARRAY(SELECT jsonb_array_elements_text(v_item -> 'allergens_may_contain')),
    ARRAY(SELECT jsonb_array_elements_text(v_item -> 'removable_ingredients')),
    (v_item ->> 'substitutions_allowed')::boolean,
    (v_item ->> 'can_be_made_vegetarian')::boolean,
    (v_item ->> 'can_be_made_vegan')::boolean,
    (v_item ->> 'can_be_made_gluten_free')::boolean,
    v_item ->> 'customization_rules',
    v_item ->> 'serving_notes',
    (v_item ->> 'active')::boolean,
    (v_item ->> 'seasonal')::boolean,
    (v_item ->> 'limited_time')::boolean,
    (v_item ->> 'sold_out')::boolean,
    (v_item ->> 'display_order')::integer,
    v_item ->> 'image_url'
  )
  ON CONFLICT (restaurant_id, external_item_id)
  DO UPDATE SET
    item_name = EXCLUDED.item_name,
    category = EXCLUDED.category,
    subcategory = EXCLUDED.subcategory,
    short_description = EXCLUDED.short_description,
    full_description = EXCLUDED.full_description,
    base_price = EXCLUDED.base_price,
    currency = EXCLUDED.currency,
    service_time = EXCLUDED.service_time,
    availability_status = EXCLUDED.availability_status,
    key_ingredients = EXCLUDED.key_ingredients,
    main_protein_or_base = EXCLUDED.main_protein_or_base,
    cooking_style = EXCLUDED.cooking_style,
    preparation_method = EXCLUDED.preparation_method,
    flavor_profile = EXCLUDED.flavor_profile,
    texture = EXCLUDED.texture,
    spice_level = EXCLUDED.spice_level,
    spice_adjustable = EXCLUDED.spice_adjustable,
    portion_size = EXCLUDED.portion_size,
    shareable = EXCLUDED.shareable,
    recommendation_tags = EXCLUDED.recommendation_tags,
    pairings = EXCLUDED.pairings,
    signature_score = EXCLUDED.signature_score,
    popularity_score = EXCLUDED.popularity_score,
    dietary_tags = EXCLUDED.dietary_tags,
    allergens_contains = EXCLUDED.allergens_contains,
    allergens_may_contain = EXCLUDED.allergens_may_contain,
    removable_ingredients = EXCLUDED.removable_ingredients,
    substitutions_allowed = EXCLUDED.substitutions_allowed,
    can_be_made_vegetarian = EXCLUDED.can_be_made_vegetarian,
    can_be_made_vegan = EXCLUDED.can_be_made_vegan,
    can_be_made_gluten_free = EXCLUDED.can_be_made_gluten_free,
    customization_rules = EXCLUDED.customization_rules,
    serving_notes = EXCLUDED.serving_notes,
    active = EXCLUDED.active,
    seasonal = EXCLUDED.seasonal,
    limited_time = EXCLUDED.limited_time,
    sold_out = EXCLUDED.sold_out,
    display_order = EXCLUDED.display_order,
    image_url = EXCLUDED.image_url
  RETURNING id
  INTO v_item_id;

  DELETE FROM public.restaurant_menu_modifier_groups
  WHERE restaurant_id = p_restaurant_id
    AND menu_item_id = v_item_id;

  FOR v_group IN SELECT value FROM jsonb_array_elements(v_modifier_groups)
  LOOP
    v_group_index := v_group_index + 1;

    IF jsonb_typeof(v_group) <> 'object' THEN
      RAISE EXCEPTION 'modifierGroups[%] must be an object', v_group_index;
    END IF;

    IF NULLIF(BTRIM(COALESCE(v_group ->> 'externalModifierGroupId', '')), '') IS NULL THEN
      RAISE EXCEPTION 'modifierGroups[%].externalModifierGroupId is required', v_group_index;
    END IF;

    IF NULLIF(BTRIM(COALESCE(v_group ->> 'groupName', '')), '') IS NULL THEN
      RAISE EXCEPTION 'modifierGroups[%].groupName is required', v_group_index;
    END IF;

    IF COALESCE((v_group ->> 'minSelect')::integer, 0) > COALESCE((v_group ->> 'maxSelect')::integer, 0) THEN
      RAISE EXCEPTION 'modifierGroups[%] minSelect cannot exceed maxSelect', v_group_index;
    END IF;

    IF COALESCE((v_group ->> 'required')::boolean, false) AND COALESCE((v_group ->> 'minSelect')::integer, 0) < 1 THEN
      RAISE EXCEPTION 'modifierGroups[%] required groups must have minSelect >= 1', v_group_index;
    END IF;

    INSERT INTO public.restaurant_menu_modifier_groups (
      restaurant_id,
      menu_item_id,
      external_modifier_group_id,
      group_name,
      required,
      min_select,
      max_select,
      display_order
    )
    VALUES (
      p_restaurant_id,
      v_item_id,
      BTRIM(v_group ->> 'externalModifierGroupId'),
      BTRIM(v_group ->> 'groupName'),
      COALESCE((v_group ->> 'required')::boolean, false),
      COALESCE((v_group ->> 'minSelect')::integer, 0),
      COALESCE((v_group ->> 'maxSelect')::integer, 0),
      COALESCE((v_group ->> 'displayOrder')::integer, 0)
    )
    RETURNING id
    INTO v_group_id;

    IF jsonb_typeof(COALESCE(v_group -> 'options', '[]'::jsonb)) <> 'array' THEN
      RAISE EXCEPTION 'modifierGroups[%].options must be an array', v_group_index;
    END IF;

    v_option_index := 0;
    FOR v_option IN SELECT value FROM jsonb_array_elements(COALESCE(v_group -> 'options', '[]'::jsonb))
    LOOP
      v_option_index := v_option_index + 1;

      IF jsonb_typeof(v_option) <> 'object' THEN
        RAISE EXCEPTION 'modifierGroups[%].options[%] must be an object', v_group_index, v_option_index;
      END IF;

      IF NULLIF(BTRIM(COALESCE(v_option ->> 'externalModifierOptionId', '')), '') IS NULL THEN
        RAISE EXCEPTION 'modifierGroups[%].options[%].externalModifierOptionId is required', v_group_index, v_option_index;
      END IF;

      IF NULLIF(BTRIM(COALESCE(v_option ->> 'optionName', '')), '') IS NULL THEN
        RAISE EXCEPTION 'modifierGroups[%].options[%].optionName is required', v_group_index, v_option_index;
      END IF;

      IF LOWER(COALESCE(NULLIF(BTRIM(v_option ->> 'availabilityStatus'), ''), 'available')) NOT IN ('available', 'unavailable') THEN
        RAISE EXCEPTION 'modifierGroups[%].options[%].availabilityStatus must be available or unavailable', v_group_index, v_option_index;
      END IF;

      INSERT INTO public.restaurant_menu_modifier_options (
        restaurant_id,
        modifier_group_id,
        external_modifier_option_id,
        option_name,
        price_delta,
        default_selected,
        availability_status,
        display_order
      )
      VALUES (
        p_restaurant_id,
        v_group_id,
        BTRIM(v_option ->> 'externalModifierOptionId'),
        BTRIM(v_option ->> 'optionName'),
        COALESCE((v_option ->> 'priceDelta')::numeric(10, 2), 0),
        COALESCE((v_option ->> 'defaultSelected')::boolean, false),
        LOWER(COALESCE(NULLIF(BTRIM(v_option ->> 'availabilityStatus'), ''), 'available')),
        COALESCE((v_option ->> 'displayOrder')::integer, 0)
      );
    END LOOP;
  END LOOP;

  RETURN (
    SELECT jsonb_build_object(
      'id', item.id,
      'restaurantId', item.restaurant_id,
      'externalItemId', item.external_item_id,
      'updatedAt', item.updated_at
    )
    FROM public.restaurant_menu_items item
    WHERE item.id = v_item_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.import_restaurant_menu_bundle(
  p_restaurant_id uuid,
  p_items jsonb,
  p_modifier_groups jsonb DEFAULT '[]'::jsonb,
  p_modifier_options jsonb DEFAULT '[]'::jsonb,
  p_replace_modifiers boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item jsonb;
  v_group jsonb;
  v_option jsonb;
  v_item_index integer := 0;
  v_group_index integer := 0;
  v_option_index integer := 0;
  v_item_id uuid;
  v_group_id uuid;
  v_item_external_ids text[] := ARRAY[]::text[];
  v_impacted_item_ids uuid[] := ARRAY[]::uuid[];
  v_group_id_map jsonb := '{}'::jsonb;
  v_group_external_id text;
  v_item_external_id text;
  v_item_name text;
  v_category text;
  v_availability_status text;
BEGIN
  IF p_restaurant_id IS NULL THEN
    RAISE EXCEPTION 'Restaurant id is required';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN
    RAISE EXCEPTION 'items payload must be an array';
  END IF;

  IF jsonb_typeof(COALESCE(p_modifier_groups, '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'modifierGroups payload must be an array';
  END IF;

  IF jsonb_typeof(COALESCE(p_modifier_options, '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'modifierOptions payload must be an array';
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    v_item_index := v_item_index + 1;
    IF jsonb_typeof(v_item) <> 'object' THEN
      RAISE EXCEPTION 'items[%] must be an object', v_item_index;
    END IF;

    v_item_external_id := NULLIF(BTRIM(COALESCE(v_item ->> 'externalItemId', '')), '');
    v_item_name := NULLIF(BTRIM(COALESCE(v_item ->> 'itemName', '')), '');
    v_category := NULLIF(BTRIM(COALESCE(v_item ->> 'category', '')), '');
    v_availability_status := LOWER(COALESCE(NULLIF(BTRIM(v_item ->> 'availabilityStatus'), ''), 'available'));

    IF v_item_external_id IS NULL THEN
      RAISE EXCEPTION 'items[%].externalItemId is required', v_item_index;
    END IF;

    IF v_item_external_id = ANY(v_item_external_ids) THEN
      RAISE EXCEPTION 'Duplicate item external id: %', v_item_external_id;
    END IF;
    v_item_external_ids := array_append(v_item_external_ids, v_item_external_id);

    IF v_item_name IS NULL THEN
      RAISE EXCEPTION 'items[%].itemName is required', v_item_index;
    END IF;

    IF v_category IS NULL THEN
      RAISE EXCEPTION 'items[%].category is required', v_item_index;
    END IF;

    IF v_availability_status NOT IN ('available', 'unavailable') THEN
      RAISE EXCEPTION 'items[%].availabilityStatus must be available or unavailable', v_item_index;
    END IF;

    INSERT INTO public.restaurant_menu_items (
      restaurant_id,
      external_item_id,
      item_name,
      category,
      subcategory,
      short_description,
      full_description,
      base_price,
      currency,
      service_time,
      availability_status,
      key_ingredients,
      main_protein_or_base,
      cooking_style,
      preparation_method,
      flavor_profile,
      texture,
      spice_level,
      spice_adjustable,
      portion_size,
      shareable,
      recommendation_tags,
      pairings,
      signature_score,
      popularity_score,
      dietary_tags,
      allergens_contains,
      allergens_may_contain,
      removable_ingredients,
      substitutions_allowed,
      can_be_made_vegetarian,
      can_be_made_vegan,
      can_be_made_gluten_free,
      customization_rules,
      serving_notes,
      active,
      seasonal,
      limited_time,
      sold_out,
      display_order,
      image_url
    )
    VALUES (
      p_restaurant_id,
      v_item_external_id,
      v_item_name,
      v_category,
      NULLIF(BTRIM(COALESCE(v_item ->> 'subcategory', '')), ''),
      NULLIF(BTRIM(COALESCE(v_item ->> 'shortDescription', '')), ''),
      NULLIF(BTRIM(COALESCE(v_item ->> 'fullDescription', '')), ''),
      COALESCE((v_item ->> 'basePrice')::numeric(10, 2), 0),
      UPPER(COALESCE(NULLIF(BTRIM(v_item ->> 'currency'), ''), 'GBP')),
      NULLIF(BTRIM(COALESCE(v_item ->> 'serviceTime', '')), ''),
      v_availability_status,
      COALESCE(ARRAY(SELECT jsonb_array_elements_text(COALESCE(v_item -> 'keyIngredients', '[]'::jsonb))), ARRAY[]::text[]),
      NULLIF(BTRIM(COALESCE(v_item ->> 'mainProteinOrBase', '')), ''),
      NULLIF(BTRIM(COALESCE(v_item ->> 'cookingStyle', '')), ''),
      NULLIF(BTRIM(COALESCE(v_item ->> 'preparationMethod', '')), ''),
      NULLIF(BTRIM(COALESCE(v_item ->> 'flavorProfile', '')), ''),
      NULLIF(BTRIM(COALESCE(v_item ->> 'texture', '')), ''),
      NULLIF(BTRIM(COALESCE(v_item ->> 'spiceLevel', '')), ''),
      COALESCE((v_item ->> 'spiceAdjustable')::boolean, false),
      NULLIF(BTRIM(COALESCE(v_item ->> 'portionSize', '')), ''),
      COALESCE((v_item ->> 'shareable')::boolean, false),
      COALESCE(ARRAY(SELECT jsonb_array_elements_text(COALESCE(v_item -> 'recommendationTags', '[]'::jsonb))), ARRAY[]::text[]),
      COALESCE(ARRAY(SELECT jsonb_array_elements_text(COALESCE(v_item -> 'pairings', '[]'::jsonb))), ARRAY[]::text[]),
      CASE WHEN v_item ? 'signatureScore' AND (v_item ->> 'signatureScore') <> '' THEN (v_item ->> 'signatureScore')::integer ELSE NULL END,
      CASE WHEN v_item ? 'popularityScore' AND (v_item ->> 'popularityScore') <> '' THEN (v_item ->> 'popularityScore')::integer ELSE NULL END,
      COALESCE(ARRAY(SELECT jsonb_array_elements_text(COALESCE(v_item -> 'dietaryTags', '[]'::jsonb))), ARRAY[]::text[]),
      COALESCE(ARRAY(SELECT jsonb_array_elements_text(COALESCE(v_item -> 'allergensContains', '[]'::jsonb))), ARRAY[]::text[]),
      COALESCE(ARRAY(SELECT jsonb_array_elements_text(COALESCE(v_item -> 'allergensMayContain', '[]'::jsonb))), ARRAY[]::text[]),
      COALESCE(ARRAY(SELECT jsonb_array_elements_text(COALESCE(v_item -> 'removableIngredients', '[]'::jsonb))), ARRAY[]::text[]),
      COALESCE((v_item ->> 'substitutionsAllowed')::boolean, false),
      COALESCE((v_item ->> 'canBeMadeVegetarian')::boolean, false),
      COALESCE((v_item ->> 'canBeMadeVegan')::boolean, false),
      COALESCE((v_item ->> 'canBeMadeGlutenFree')::boolean, false),
      NULLIF(BTRIM(COALESCE(v_item ->> 'customizationRules', '')), ''),
      NULLIF(BTRIM(COALESCE(v_item ->> 'servingNotes', '')), ''),
      COALESCE((v_item ->> 'active')::boolean, true),
      COALESCE((v_item ->> 'seasonal')::boolean, false),
      COALESCE((v_item ->> 'limitedTime')::boolean, false),
      COALESCE((v_item ->> 'soldOut')::boolean, false),
      COALESCE((v_item ->> 'displayOrder')::integer, 0),
      NULLIF(BTRIM(COALESCE(v_item ->> 'imageUrl', '')), '')
    )
    ON CONFLICT (restaurant_id, external_item_id)
    DO UPDATE SET
      item_name = EXCLUDED.item_name,
      category = EXCLUDED.category,
      subcategory = EXCLUDED.subcategory,
      short_description = EXCLUDED.short_description,
      full_description = EXCLUDED.full_description,
      base_price = EXCLUDED.base_price,
      currency = EXCLUDED.currency,
      service_time = EXCLUDED.service_time,
      availability_status = EXCLUDED.availability_status,
      key_ingredients = EXCLUDED.key_ingredients,
      main_protein_or_base = EXCLUDED.main_protein_or_base,
      cooking_style = EXCLUDED.cooking_style,
      preparation_method = EXCLUDED.preparation_method,
      flavor_profile = EXCLUDED.flavor_profile,
      texture = EXCLUDED.texture,
      spice_level = EXCLUDED.spice_level,
      spice_adjustable = EXCLUDED.spice_adjustable,
      portion_size = EXCLUDED.portion_size,
      shareable = EXCLUDED.shareable,
      recommendation_tags = EXCLUDED.recommendation_tags,
      pairings = EXCLUDED.pairings,
      signature_score = EXCLUDED.signature_score,
      popularity_score = EXCLUDED.popularity_score,
      dietary_tags = EXCLUDED.dietary_tags,
      allergens_contains = EXCLUDED.allergens_contains,
      allergens_may_contain = EXCLUDED.allergens_may_contain,
      removable_ingredients = EXCLUDED.removable_ingredients,
      substitutions_allowed = EXCLUDED.substitutions_allowed,
      can_be_made_vegetarian = EXCLUDED.can_be_made_vegetarian,
      can_be_made_vegan = EXCLUDED.can_be_made_vegan,
      can_be_made_gluten_free = EXCLUDED.can_be_made_gluten_free,
      customization_rules = EXCLUDED.customization_rules,
      serving_notes = EXCLUDED.serving_notes,
      active = EXCLUDED.active,
      seasonal = EXCLUDED.seasonal,
      limited_time = EXCLUDED.limited_time,
      sold_out = EXCLUDED.sold_out,
      display_order = EXCLUDED.display_order,
      image_url = EXCLUDED.image_url
    RETURNING id
    INTO v_item_id;
  END LOOP;

  IF NOT p_replace_modifiers THEN
    RETURN jsonb_build_object(
      'itemsProcessed', COALESCE(jsonb_array_length(p_items), 0),
      'modifierGroupsProcessed', 0,
      'modifierOptionsProcessed', 0,
      'replaceModifiers', false
    );
  END IF;

  IF jsonb_array_length(COALESCE(p_modifier_groups, '[]'::jsonb)) = 0 THEN
    RETURN jsonb_build_object(
      'itemsProcessed', COALESCE(jsonb_array_length(p_items), 0),
      'modifierGroupsProcessed', 0,
      'modifierOptionsProcessed', 0,
      'replaceModifiers', true
    );
  END IF;

  FOR v_group IN SELECT value FROM jsonb_array_elements(COALESCE(p_modifier_groups, '[]'::jsonb))
  LOOP
    v_group_index := v_group_index + 1;
    IF jsonb_typeof(v_group) <> 'object' THEN
      RAISE EXCEPTION 'modifierGroups[%] must be an object', v_group_index;
    END IF;

    v_group_external_id := NULLIF(BTRIM(COALESCE(v_group ->> 'externalModifierGroupId', '')), '');
    IF v_group_external_id IS NULL THEN
      RAISE EXCEPTION 'modifierGroups[%].externalModifierGroupId is required', v_group_index;
    END IF;

    IF (v_group_id_map ? v_group_external_id) THEN
      RAISE EXCEPTION 'Duplicate modifier group external id: %', v_group_external_id;
    END IF;

    v_item_external_id := NULLIF(BTRIM(COALESCE(v_group ->> 'externalItemId', '')), '');
    IF v_item_external_id IS NULL THEN
      RAISE EXCEPTION 'modifierGroups[%].externalItemId is required', v_group_index;
    END IF;

    SELECT id
    INTO v_item_id
    FROM public.restaurant_menu_items
    WHERE restaurant_id = p_restaurant_id
      AND external_item_id = v_item_external_id;

    IF v_item_id IS NULL THEN
      RAISE EXCEPTION 'modifierGroups[%] references unknown item external id %', v_group_index, v_item_external_id;
    END IF;

    IF NOT (v_item_id = ANY(v_impacted_item_ids)) THEN
      v_impacted_item_ids := array_append(v_impacted_item_ids, v_item_id);
    END IF;
  END LOOP;

  DELETE FROM public.restaurant_menu_modifier_groups
  WHERE restaurant_id = p_restaurant_id
    AND menu_item_id = ANY(v_impacted_item_ids);

  v_group_index := 0;
  FOR v_group IN SELECT value FROM jsonb_array_elements(COALESCE(p_modifier_groups, '[]'::jsonb))
  LOOP
    v_group_index := v_group_index + 1;
    v_group_external_id := BTRIM(v_group ->> 'externalModifierGroupId');
    v_item_external_id := BTRIM(v_group ->> 'externalItemId');

    IF NULLIF(BTRIM(COALESCE(v_group ->> 'groupName', '')), '') IS NULL THEN
      RAISE EXCEPTION 'modifierGroups[%].groupName is required', v_group_index;
    END IF;

    IF COALESCE((v_group ->> 'minSelect')::integer, 0) > COALESCE((v_group ->> 'maxSelect')::integer, 0) THEN
      RAISE EXCEPTION 'modifierGroups[%] minSelect cannot exceed maxSelect', v_group_index;
    END IF;

    IF COALESCE((v_group ->> 'required')::boolean, false) AND COALESCE((v_group ->> 'minSelect')::integer, 0) < 1 THEN
      RAISE EXCEPTION 'modifierGroups[%] required groups must have minSelect >= 1', v_group_index;
    END IF;

    SELECT id
    INTO v_item_id
    FROM public.restaurant_menu_items
    WHERE restaurant_id = p_restaurant_id
      AND external_item_id = v_item_external_id;

    INSERT INTO public.restaurant_menu_modifier_groups (
      restaurant_id,
      menu_item_id,
      external_modifier_group_id,
      group_name,
      required,
      min_select,
      max_select,
      display_order
    )
    VALUES (
      p_restaurant_id,
      v_item_id,
      v_group_external_id,
      BTRIM(v_group ->> 'groupName'),
      COALESCE((v_group ->> 'required')::boolean, false),
      COALESCE((v_group ->> 'minSelect')::integer, 0),
      COALESCE((v_group ->> 'maxSelect')::integer, 0),
      COALESCE((v_group ->> 'displayOrder')::integer, 0)
    )
    RETURNING id
    INTO v_group_id;

    v_group_id_map := v_group_id_map || jsonb_build_object(v_group_external_id, v_group_id::text);
  END LOOP;

  FOR v_option IN SELECT value FROM jsonb_array_elements(COALESCE(p_modifier_options, '[]'::jsonb))
  LOOP
    v_option_index := v_option_index + 1;
    IF jsonb_typeof(v_option) <> 'object' THEN
      RAISE EXCEPTION 'modifierOptions[%] must be an object', v_option_index;
    END IF;

    IF NULLIF(BTRIM(COALESCE(v_option ->> 'externalModifierOptionId', '')), '') IS NULL THEN
      RAISE EXCEPTION 'modifierOptions[%].externalModifierOptionId is required', v_option_index;
    END IF;

    IF NULLIF(BTRIM(COALESCE(v_option ->> 'optionName', '')), '') IS NULL THEN
      RAISE EXCEPTION 'modifierOptions[%].optionName is required', v_option_index;
    END IF;

    v_group_external_id := NULLIF(BTRIM(COALESCE(v_option ->> 'externalModifierGroupId', '')), '');
    IF v_group_external_id IS NULL THEN
      RAISE EXCEPTION 'modifierOptions[%].externalModifierGroupId is required', v_option_index;
    END IF;

    IF NOT (v_group_id_map ? v_group_external_id) THEN
      RAISE EXCEPTION 'modifierOptions[%] references unknown modifier group external id %', v_option_index, v_group_external_id;
    END IF;

    IF LOWER(COALESCE(NULLIF(BTRIM(v_option ->> 'availabilityStatus'), ''), 'available')) NOT IN ('available', 'unavailable') THEN
      RAISE EXCEPTION 'modifierOptions[%].availabilityStatus must be available or unavailable', v_option_index;
    END IF;

    v_group_id := (v_group_id_map ->> v_group_external_id)::uuid;

    INSERT INTO public.restaurant_menu_modifier_options (
      restaurant_id,
      modifier_group_id,
      external_modifier_option_id,
      option_name,
      price_delta,
      default_selected,
      availability_status,
      display_order
    )
    VALUES (
      p_restaurant_id,
      v_group_id,
      BTRIM(v_option ->> 'externalModifierOptionId'),
      BTRIM(v_option ->> 'optionName'),
      COALESCE((v_option ->> 'priceDelta')::numeric(10, 2), 0),
      COALESCE((v_option ->> 'defaultSelected')::boolean, false),
      LOWER(COALESCE(NULLIF(BTRIM(v_option ->> 'availabilityStatus'), ''), 'available')),
      COALESCE((v_option ->> 'displayOrder')::integer, 0)
    );
  END LOOP;

  RETURN jsonb_build_object(
    'itemsProcessed', COALESCE(jsonb_array_length(p_items), 0),
    'modifierGroupsProcessed', COALESCE(jsonb_array_length(COALESCE(p_modifier_groups, '[]'::jsonb)), 0),
    'modifierOptionsProcessed', COALESCE(jsonb_array_length(COALESCE(p_modifier_options, '[]'::jsonb)), 0),
    'replaceModifiers', true
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_restaurant_menu_item_with_modifiers(uuid, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.import_restaurant_menu_bundle(uuid, jsonb, jsonb, jsonb, boolean) TO service_role;

COMMIT;
