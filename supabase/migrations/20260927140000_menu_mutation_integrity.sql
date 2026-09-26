-- Menu mutation integrity (wave 2, stream S7).
--
-- Adds transactional RPCs for the canonical menu hierarchy so that multi-row writes are atomic
-- and ordering is computed on the server:
--   * create_restaurant_menu_item_v1        item + extensions (+ options) in one transaction,
--                                          optional per-restaurant idempotency key bound to a
--                                          fingerprint of the request payload, server-side
--                                          display_order (max + 1) when none is supplied.
--   * update_restaurant_menu_item_v1        item + extensions in one transaction. Accepts full
--                                          replacement values and shallow jsonb merge patches
--                                          (google_attributes || patch, extension column || patch)
--                                          so partial edits never overwrite concurrent changes.
--   * create_restaurant_menu_section_v1     server-side display_order (max + 1).
--   * create_restaurant_menu_item_option_v1 server-side display_order (max + 1).
--   * reorder_restaurant_menu_sections_v1, reorder_restaurant_menu_items_v1,
--     reorder_restaurant_menu_item_options_v1
--                                          renumber 0..n-1 in one statement after checking that
--                                          the ordered ids are exactly the parent's children.
--   * restaurant_menu_item_snapshot_v1      internal: item row, extension row and options.
--
-- Error contract (mapped by server/menu-hierarchy/errors.ts, never sent to clients verbatim):
--   P0002 menu_not_found | menu_section_not_found | menu_item_not_found
--   P0001 menu_order_stale | menu_idempotency_key_reused
--   22023 menu_invalid_argument
--   23505 unique violations (for example restaurant_id + external_item_id) pass through.
--
-- Schema change: restaurant_menu_items.create_idempotency_key (nullable text) with a partial
-- unique index on (restaurant_id, create_idempotency_key), and
-- restaurant_menu_items.create_request_fingerprint (nullable text): md5 of the normalised jsonb
-- create payload (item + extensions + options). A retry with the same key replays the original
-- item only when the fingerprint matches; an edited payload under the same key is refused with
-- menu_idempotency_key_reused (the route answers 409 IDEMPOTENCY_KEY_REUSED). New columns, so no
-- existing row can conflict; no data is rewritten.
--
-- Every function is SECURITY DEFINER with a pinned search_path and is executable by
-- service_role only, like delete_restaurant_menu_hierarchy.
--
-- Rollback (forward-only in production; run as a new migration if needed):
--   DROP FUNCTION IF EXISTS public.reorder_restaurant_menu_item_options_v1(uuid, uuid, uuid, uuid, uuid[]);
--   DROP FUNCTION IF EXISTS public.reorder_restaurant_menu_items_v1(uuid, uuid, uuid, uuid[]);
--   DROP FUNCTION IF EXISTS public.reorder_restaurant_menu_sections_v1(uuid, uuid, uuid[]);
--   DROP FUNCTION IF EXISTS public.create_restaurant_menu_item_option_v1(uuid, uuid, uuid, uuid, jsonb);
--   DROP FUNCTION IF EXISTS public.create_restaurant_menu_section_v1(uuid, uuid, jsonb);
--   DROP FUNCTION IF EXISTS public.update_restaurant_menu_item_v1(uuid, uuid, uuid, uuid, jsonb, jsonb, jsonb, jsonb);
--   DROP FUNCTION IF EXISTS public.create_restaurant_menu_item_v1(uuid, uuid, uuid, jsonb, jsonb, jsonb, text);
--   DROP FUNCTION IF EXISTS public.restaurant_menu_item_snapshot_v1(uuid, uuid);
--   DROP FUNCTION IF EXISTS public.restaurant_menu_order_matches_v1(uuid[], uuid[]);
--   DROP INDEX IF EXISTS public.restaurant_menu_items_create_idempotency_key_idx;
--   ALTER TABLE public.restaurant_menu_items DROP COLUMN IF EXISTS create_request_fingerprint;
--   ALTER TABLE public.restaurant_menu_items DROP COLUMN IF EXISTS create_idempotency_key;
-- The application falls back to nothing: roll the app back first (the previous repository did
-- not call these functions).

ALTER TABLE public.restaurant_menu_items
  ADD COLUMN IF NOT EXISTS create_idempotency_key text;

ALTER TABLE public.restaurant_menu_items
  ADD COLUMN IF NOT EXISTS create_request_fingerprint text;

CREATE UNIQUE INDEX IF NOT EXISTS restaurant_menu_items_create_idempotency_key_idx
  ON public.restaurant_menu_items (restaurant_id, create_idempotency_key)
  WHERE create_idempotency_key IS NOT NULL;

-- ---------------------------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.restaurant_menu_order_matches_v1(
  p_existing uuid[],
  p_ordered uuid[]
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT p_ordered IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM unnest(p_ordered) AS o(id) WHERE o.id IS NULL)
    AND cardinality(p_ordered) = (SELECT count(DISTINCT o.id) FROM unnest(p_ordered) AS o(id))
    AND coalesce((SELECT array_agg(o.id ORDER BY o.id) FROM unnest(p_ordered) AS o(id)), ARRAY[]::uuid[])
      = coalesce((SELECT array_agg(e.id ORDER BY e.id) FROM unnest(p_existing) AS e(id)), ARRAY[]::uuid[]);
$$;

CREATE OR REPLACE FUNCTION public.restaurant_menu_item_snapshot_v1(
  p_restaurant_id uuid,
  p_item_id uuid
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'item', to_jsonb(i) - 'create_idempotency_key' - 'create_request_fingerprint',
    'extension', (
      SELECT to_jsonb(e)
      FROM public.restaurant_menu_item_extensions e
      WHERE e.restaurant_id = i.restaurant_id
        AND e.menu_item_id = i.id
    ),
    'options', coalesce((
      SELECT jsonb_agg(to_jsonb(o) ORDER BY o.display_order, o.created_at, o.id)
      FROM public.restaurant_menu_item_options o
      WHERE o.restaurant_id = i.restaurant_id
        AND o.menu_item_id = i.id
    ), '[]'::jsonb)
  )
  FROM public.restaurant_menu_items i
  WHERE i.restaurant_id = p_restaurant_id
    AND i.id = p_item_id;
$$;

-- ---------------------------------------------------------------------------------------------
-- Item create: item + extensions + options in one transaction, idempotent per restaurant key.
-- ---------------------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_restaurant_menu_item_v1(
  p_restaurant_id uuid,
  p_menu_id uuid,
  p_section_id uuid,
  p_item jsonb,
  p_extensions jsonb DEFAULT '{}'::jsonb,
  p_options jsonb DEFAULT '[]'::jsonb,
  p_idempotency_key text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_section public.restaurant_menu_sections%ROWTYPE;
  v_item public.restaurant_menu_items%ROWTYPE;
  v_replayed boolean := false;
  v_display_order integer;
  v_attributes jsonb := coalesce(p_item -> 'google_attributes', '{}'::jsonb);
  v_extensions jsonb := coalesce(p_extensions, '{}'::jsonb);
  v_options jsonb := coalesce(p_options, '[]'::jsonb);
  v_category text;
  v_fingerprint text;
BEGIN
  IF p_item IS NULL OR jsonb_typeof(p_item) <> 'object'
    OR jsonb_typeof(v_extensions) <> 'object'
    OR jsonb_typeof(v_options) <> 'array'
    OR jsonb_typeof(v_attributes) <> 'object' THEN
    RAISE EXCEPTION 'menu_invalid_argument' USING ERRCODE = '22023';
  END IF;

  IF p_idempotency_key IS NOT NULL
    AND (btrim(p_idempotency_key) = '' OR length(p_idempotency_key) > 200) THEN
    RAISE EXCEPTION 'menu_invalid_argument' USING ERRCODE = '22023';
  END IF;

  -- What this request asks for. jsonb text is normalised (sorted keys, no insignificant
  -- whitespace), so the same draft always gives the same fingerprint.
  v_fingerprint := md5(
    jsonb_build_object('item', p_item, 'extensions', v_extensions, 'options', v_options)::text
  );

  -- Locks the parent: validates tenant scope and serialises display_order allocation.
  SELECT * INTO v_section
  FROM public.restaurant_menu_sections
  WHERE restaurant_id = p_restaurant_id
    AND menu_id = p_menu_id
    AND id = p_section_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'menu_section_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    SELECT * INTO v_item
    FROM public.restaurant_menu_items
    WHERE restaurant_id = p_restaurant_id
      AND create_idempotency_key = p_idempotency_key;
    v_replayed := FOUND;
  END IF;

  IF NOT v_replayed THEN
    IF jsonb_typeof(p_item -> 'display_order') = 'number' THEN
      v_display_order := (p_item ->> 'display_order')::integer;
    ELSE
      SELECT coalesce(max(display_order) + 1, 0)
      INTO v_display_order
      FROM public.restaurant_menu_items
      WHERE restaurant_id = p_restaurant_id
        AND menu_id = p_menu_id
        AND section_id = p_section_id;
    END IF;

    v_category := coalesce(
      v_section.legacy_category,
      (
        SELECT btrim(label ->> 'displayName')
        FROM jsonb_array_elements(
          CASE WHEN jsonb_typeof(v_section.labels) = 'array' THEN v_section.labels ELSE '[]'::jsonb END
        ) WITH ORDINALITY AS entry(label, position)
        WHERE nullif(btrim(label ->> 'displayName'), '') IS NOT NULL
        ORDER BY position
        LIMIT 1
      ),
      'Menu'
    );

    INSERT INTO public.restaurant_menu_items (
      restaurant_id,
      menu_id,
      section_id,
      item_kind,
      external_item_id,
      item_name,
      category,
      subcategory,
      short_description,
      base_price,
      currency,
      display_order,
      active,
      labels,
      google_attributes,
      google_media_keys,
      local_media,
      image_url,
      legacy_source,
      create_idempotency_key,
      create_request_fingerprint
    )
    VALUES (
      p_restaurant_id,
      p_menu_id,
      p_section_id,
      coalesce(p_item ->> 'item_kind', 'food'),
      p_item ->> 'external_item_id',
      p_item ->> 'item_name',
      v_category,
      v_section.legacy_subcategory,
      p_item ->> 'short_description',
      coalesce((v_attributes -> 'price' ->> 'amount')::numeric, 0),
      coalesce(nullif(v_attributes -> 'price' ->> 'currencyCode', ''), 'GBP'),
      v_display_order,
      coalesce((p_item ->> 'active')::boolean, true),
      coalesce(p_item -> 'labels', '[]'::jsonb),
      v_attributes,
      ARRAY(SELECT jsonb_array_elements_text(coalesce(p_item -> 'google_media_keys', '[]'::jsonb))),
      coalesce(p_item -> 'local_media', '{}'::jsonb),
      p_item ->> 'image_url',
      coalesce(p_item -> 'legacy_source', '{}'::jsonb),
      p_idempotency_key,
      CASE WHEN p_idempotency_key IS NULL THEN NULL ELSE v_fingerprint END
    )
    ON CONFLICT (restaurant_id, create_idempotency_key)
      WHERE create_idempotency_key IS NOT NULL
      DO NOTHING
    RETURNING * INTO v_item;

    IF NOT FOUND THEN
      -- A concurrent request with the same key won the insert: replay its result.
      SELECT * INTO v_item
      FROM public.restaurant_menu_items
      WHERE restaurant_id = p_restaurant_id
        AND create_idempotency_key = p_idempotency_key;
      v_replayed := true;
    ELSE
      INSERT INTO public.restaurant_menu_item_extensions (
        restaurant_id,
        menu_item_id,
        drink_profile,
        recommendation_metadata,
        availability_policy,
        customization_controls,
        source_metadata
      )
      VALUES (
        p_restaurant_id,
        v_item.id,
        coalesce(v_extensions -> 'drink_profile', '{}'::jsonb),
        coalesce(v_extensions -> 'recommendation_metadata', '{}'::jsonb),
        coalesce(v_extensions -> 'availability_policy', '{}'::jsonb),
        coalesce(v_extensions -> 'customization_controls', '{}'::jsonb),
        coalesce(v_extensions -> 'source_metadata', '{}'::jsonb)
      );

      INSERT INTO public.restaurant_menu_item_options (
        restaurant_id,
        menu_item_id,
        external_option_id,
        labels,
        google_attributes,
        google_media_keys,
        display_order,
        active,
        legacy_source
      )
      SELECT
        p_restaurant_id,
        v_item.id,
        option_row.value ->> 'external_option_id',
        coalesce(option_row.value -> 'labels', '[]'::jsonb),
        coalesce(option_row.value -> 'google_attributes', '{}'::jsonb),
        ARRAY(SELECT jsonb_array_elements_text(coalesce(option_row.value -> 'google_media_keys', '[]'::jsonb))),
        CASE
          WHEN jsonb_typeof(option_row.value -> 'display_order') = 'number'
            THEN (option_row.value ->> 'display_order')::integer
          ELSE (option_row.position - 1)::integer
        END,
        coalesce((option_row.value ->> 'active')::boolean, true),
        coalesce(option_row.value -> 'legacy_source', '{}'::jsonb)
      FROM jsonb_array_elements(v_options) WITH ORDINALITY AS option_row(value, position);
    END IF;
  END IF;

  -- A replay must be the same request: same parent and same payload. Anything else (the user
  -- edited the draft after an ambiguous failure, or a client reused a key) is refused rather than
  -- silently answered with the original item.
  IF v_replayed AND (
    v_item.menu_id IS DISTINCT FROM p_menu_id
    OR v_item.section_id IS DISTINCT FROM p_section_id
    OR v_item.create_request_fingerprint IS DISTINCT FROM v_fingerprint
  ) THEN
    RAISE EXCEPTION 'menu_idempotency_key_reused' USING ERRCODE = 'P0001';
  END IF;

  RETURN public.restaurant_menu_item_snapshot_v1(p_restaurant_id, v_item.id)
    || jsonb_build_object('replayed', v_replayed);
END;
$$;

-- ---------------------------------------------------------------------------------------------
-- Item update: replacement values (p_set, p_extensions) and shallow merge patches
-- (p_attributes_merge, p_extensions_merge) applied under one row lock.
-- ---------------------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.update_restaurant_menu_item_v1(
  p_restaurant_id uuid,
  p_menu_id uuid,
  p_section_id uuid,
  p_item_id uuid,
  p_set jsonb DEFAULT '{}'::jsonb,
  p_attributes_merge jsonb DEFAULT NULL,
  p_extensions jsonb DEFAULT NULL,
  p_extensions_merge jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item public.restaurant_menu_items%ROWTYPE;
  v_set jsonb := coalesce(p_set, '{}'::jsonb);
  v_attributes jsonb;
  v_attributes_changed boolean;
  v_extensions jsonb := coalesce(p_extensions, '{}'::jsonb);
  v_extensions_merge jsonb := coalesce(p_extensions_merge, '{}'::jsonb);
BEGIN
  IF jsonb_typeof(v_set) <> 'object'
    OR (p_attributes_merge IS NOT NULL AND jsonb_typeof(p_attributes_merge) <> 'object')
    OR jsonb_typeof(v_extensions) <> 'object'
    OR jsonb_typeof(v_extensions_merge) <> 'object'
    OR (v_set ? 'google_attributes' AND jsonb_typeof(v_set -> 'google_attributes') <> 'object') THEN
    RAISE EXCEPTION 'menu_invalid_argument' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_item
  FROM public.restaurant_menu_items
  WHERE restaurant_id = p_restaurant_id
    AND menu_id = p_menu_id
    AND section_id = p_section_id
    AND id = p_item_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'menu_item_not_found' USING ERRCODE = 'P0002';
  END IF;

  v_attributes := CASE
    WHEN v_set ? 'google_attributes' THEN v_set -> 'google_attributes'
    ELSE v_item.google_attributes
  END || coalesce(p_attributes_merge, '{}'::jsonb);
  v_attributes_changed := v_set ? 'google_attributes' OR p_attributes_merge IS NOT NULL;

  UPDATE public.restaurant_menu_items
  SET
    item_kind = CASE WHEN v_set ? 'item_kind' THEN v_set ->> 'item_kind' ELSE item_kind END,
    external_item_id = CASE
      WHEN v_set ? 'external_item_id' THEN v_set ->> 'external_item_id'
      ELSE external_item_id
    END,
    labels = CASE WHEN v_set ? 'labels' THEN v_set -> 'labels' ELSE labels END,
    item_name = CASE WHEN v_set ? 'item_name' THEN v_set ->> 'item_name' ELSE item_name END,
    short_description = CASE
      WHEN v_set ? 'short_description' THEN v_set ->> 'short_description'
      ELSE short_description
    END,
    google_attributes = v_attributes,
    base_price = CASE
      WHEN v_attributes_changed THEN coalesce((v_attributes -> 'price' ->> 'amount')::numeric, 0)
      ELSE base_price
    END,
    currency = CASE
      WHEN v_attributes_changed
        THEN coalesce(nullif(v_attributes -> 'price' ->> 'currencyCode', ''), 'GBP')
      ELSE currency
    END,
    google_media_keys = CASE
      WHEN v_set ? 'google_media_keys'
        THEN ARRAY(SELECT jsonb_array_elements_text(v_set -> 'google_media_keys'))
      ELSE google_media_keys
    END,
    local_media = CASE WHEN v_set ? 'local_media' THEN v_set -> 'local_media' ELSE local_media END,
    image_url = CASE WHEN v_set ? 'image_url' THEN v_set ->> 'image_url' ELSE image_url END,
    display_order = CASE
      WHEN v_set ? 'display_order' THEN (v_set ->> 'display_order')::integer
      ELSE display_order
    END,
    active = CASE WHEN v_set ? 'active' THEN (v_set ->> 'active')::boolean ELSE active END,
    legacy_source = CASE
      WHEN v_set ? 'legacy_source' THEN v_set -> 'legacy_source'
      ELSE legacy_source
    END
  WHERE restaurant_id = p_restaurant_id
    AND id = p_item_id;

  IF p_extensions IS NOT NULL OR p_extensions_merge IS NOT NULL THEN
    INSERT INTO public.restaurant_menu_item_extensions AS ext (
      restaurant_id,
      menu_item_id,
      drink_profile,
      recommendation_metadata,
      availability_policy,
      customization_controls,
      source_metadata
    )
    VALUES (
      p_restaurant_id,
      p_item_id,
      coalesce(v_extensions -> 'drink_profile', '{}'::jsonb)
        || coalesce(v_extensions_merge -> 'drink_profile', '{}'::jsonb),
      coalesce(v_extensions -> 'recommendation_metadata', '{}'::jsonb)
        || coalesce(v_extensions_merge -> 'recommendation_metadata', '{}'::jsonb),
      coalesce(v_extensions -> 'availability_policy', '{}'::jsonb)
        || coalesce(v_extensions_merge -> 'availability_policy', '{}'::jsonb),
      coalesce(v_extensions -> 'customization_controls', '{}'::jsonb)
        || coalesce(v_extensions_merge -> 'customization_controls', '{}'::jsonb),
      coalesce(v_extensions -> 'source_metadata', '{}'::jsonb)
        || coalesce(v_extensions_merge -> 'source_metadata', '{}'::jsonb)
    )
    ON CONFLICT (restaurant_id, menu_item_id) DO UPDATE
    SET
      drink_profile = CASE
        WHEN v_extensions ? 'drink_profile' THEN v_extensions -> 'drink_profile'
        ELSE ext.drink_profile
      END || coalesce(v_extensions_merge -> 'drink_profile', '{}'::jsonb),
      recommendation_metadata = CASE
        WHEN v_extensions ? 'recommendation_metadata' THEN v_extensions -> 'recommendation_metadata'
        ELSE ext.recommendation_metadata
      END || coalesce(v_extensions_merge -> 'recommendation_metadata', '{}'::jsonb),
      availability_policy = CASE
        WHEN v_extensions ? 'availability_policy' THEN v_extensions -> 'availability_policy'
        ELSE ext.availability_policy
      END || coalesce(v_extensions_merge -> 'availability_policy', '{}'::jsonb),
      customization_controls = CASE
        WHEN v_extensions ? 'customization_controls' THEN v_extensions -> 'customization_controls'
        ELSE ext.customization_controls
      END || coalesce(v_extensions_merge -> 'customization_controls', '{}'::jsonb),
      source_metadata = CASE
        WHEN v_extensions ? 'source_metadata' THEN v_extensions -> 'source_metadata'
        ELSE ext.source_metadata
      END || coalesce(v_extensions_merge -> 'source_metadata', '{}'::jsonb);
  END IF;

  RETURN public.restaurant_menu_item_snapshot_v1(p_restaurant_id, p_item_id);
END;
$$;

-- ---------------------------------------------------------------------------------------------
-- Section and option creates with server-side display_order.
-- ---------------------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_restaurant_menu_section_v1(
  p_restaurant_id uuid,
  p_menu_id uuid,
  p_section jsonb
)
RETURNS public.restaurant_menu_sections
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_display_order integer;
  v_section public.restaurant_menu_sections%ROWTYPE;
BEGIN
  IF p_section IS NULL OR jsonb_typeof(p_section) <> 'object' THEN
    RAISE EXCEPTION 'menu_invalid_argument' USING ERRCODE = '22023';
  END IF;

  PERFORM 1
  FROM public.restaurant_menus
  WHERE restaurant_id = p_restaurant_id
    AND id = p_menu_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'menu_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF jsonb_typeof(p_section -> 'display_order') = 'number' THEN
    v_display_order := (p_section ->> 'display_order')::integer;
  ELSE
    SELECT coalesce(max(display_order) + 1, 0)
    INTO v_display_order
    FROM public.restaurant_menu_sections
    WHERE restaurant_id = p_restaurant_id
      AND menu_id = p_menu_id;
  END IF;

  INSERT INTO public.restaurant_menu_sections (
    restaurant_id,
    menu_id,
    labels,
    display_order,
    active,
    legacy_category,
    legacy_subcategory,
    legacy_source
  )
  VALUES (
    p_restaurant_id,
    p_menu_id,
    coalesce(p_section -> 'labels', '[]'::jsonb),
    v_display_order,
    coalesce((p_section ->> 'active')::boolean, true),
    p_section ->> 'legacy_category',
    p_section ->> 'legacy_subcategory',
    coalesce(p_section -> 'legacy_source', '{}'::jsonb)
  )
  RETURNING * INTO v_section;

  RETURN v_section;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_restaurant_menu_item_option_v1(
  p_restaurant_id uuid,
  p_menu_id uuid,
  p_section_id uuid,
  p_item_id uuid,
  p_option jsonb
)
RETURNS public.restaurant_menu_item_options
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_display_order integer;
  v_option public.restaurant_menu_item_options%ROWTYPE;
BEGIN
  IF p_option IS NULL OR jsonb_typeof(p_option) <> 'object' THEN
    RAISE EXCEPTION 'menu_invalid_argument' USING ERRCODE = '22023';
  END IF;

  PERFORM 1
  FROM public.restaurant_menu_items
  WHERE restaurant_id = p_restaurant_id
    AND menu_id = p_menu_id
    AND section_id = p_section_id
    AND id = p_item_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'menu_item_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF jsonb_typeof(p_option -> 'display_order') = 'number' THEN
    v_display_order := (p_option ->> 'display_order')::integer;
  ELSE
    SELECT coalesce(max(display_order) + 1, 0)
    INTO v_display_order
    FROM public.restaurant_menu_item_options
    WHERE restaurant_id = p_restaurant_id
      AND menu_item_id = p_item_id;
  END IF;

  INSERT INTO public.restaurant_menu_item_options (
    restaurant_id,
    menu_item_id,
    external_option_id,
    labels,
    google_attributes,
    google_media_keys,
    display_order,
    active,
    legacy_source
  )
  VALUES (
    p_restaurant_id,
    p_item_id,
    p_option ->> 'external_option_id',
    coalesce(p_option -> 'labels', '[]'::jsonb),
    coalesce(p_option -> 'google_attributes', '{}'::jsonb),
    ARRAY(SELECT jsonb_array_elements_text(coalesce(p_option -> 'google_media_keys', '[]'::jsonb))),
    v_display_order,
    coalesce((p_option ->> 'active')::boolean, true),
    coalesce(p_option -> 'legacy_source', '{}'::jsonb)
  )
  RETURNING * INTO v_option;

  RETURN v_option;
END;
$$;

-- ---------------------------------------------------------------------------------------------
-- Reorder: one command per level. p_ordered_ids must be exactly the parent's children.
-- ---------------------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.reorder_restaurant_menu_sections_v1(
  p_restaurant_id uuid,
  p_menu_id uuid,
  p_ordered_ids uuid[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing uuid[];
BEGIN
  PERFORM 1
  FROM public.restaurant_menus
  WHERE restaurant_id = p_restaurant_id
    AND id = p_menu_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'menu_not_found' USING ERRCODE = 'P0002';
  END IF;

  SELECT coalesce(array_agg(id), ARRAY[]::uuid[])
  INTO v_existing
  FROM (
    SELECT id
    FROM public.restaurant_menu_sections
    WHERE restaurant_id = p_restaurant_id
      AND menu_id = p_menu_id
    FOR UPDATE
  ) locked_sections;

  IF NOT public.restaurant_menu_order_matches_v1(v_existing, p_ordered_ids) THEN
    RAISE EXCEPTION 'menu_order_stale' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.restaurant_menu_sections AS target
  SET display_order = (ordered.position - 1)::integer
  FROM unnest(p_ordered_ids) WITH ORDINALITY AS ordered(id, position)
  WHERE target.restaurant_id = p_restaurant_id
    AND target.menu_id = p_menu_id
    AND target.id = ordered.id
    AND target.display_order IS DISTINCT FROM (ordered.position - 1)::integer;

  RETURN coalesce((
    SELECT jsonb_agg(
      jsonb_build_object('id', ordered.id, 'displayOrder', ordered.position - 1)
      ORDER BY ordered.position
    )
    FROM unnest(p_ordered_ids) WITH ORDINALITY AS ordered(id, position)
  ), '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.reorder_restaurant_menu_items_v1(
  p_restaurant_id uuid,
  p_menu_id uuid,
  p_section_id uuid,
  p_ordered_ids uuid[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing uuid[];
BEGIN
  PERFORM 1
  FROM public.restaurant_menu_sections
  WHERE restaurant_id = p_restaurant_id
    AND menu_id = p_menu_id
    AND id = p_section_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'menu_section_not_found' USING ERRCODE = 'P0002';
  END IF;

  SELECT coalesce(array_agg(id), ARRAY[]::uuid[])
  INTO v_existing
  FROM (
    SELECT id
    FROM public.restaurant_menu_items
    WHERE restaurant_id = p_restaurant_id
      AND menu_id = p_menu_id
      AND section_id = p_section_id
    FOR UPDATE
  ) locked_items;

  IF NOT public.restaurant_menu_order_matches_v1(v_existing, p_ordered_ids) THEN
    RAISE EXCEPTION 'menu_order_stale' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.restaurant_menu_items AS target
  SET display_order = (ordered.position - 1)::integer
  FROM unnest(p_ordered_ids) WITH ORDINALITY AS ordered(id, position)
  WHERE target.restaurant_id = p_restaurant_id
    AND target.menu_id = p_menu_id
    AND target.section_id = p_section_id
    AND target.id = ordered.id
    AND target.display_order IS DISTINCT FROM (ordered.position - 1)::integer;

  RETURN coalesce((
    SELECT jsonb_agg(
      jsonb_build_object('id', ordered.id, 'displayOrder', ordered.position - 1)
      ORDER BY ordered.position
    )
    FROM unnest(p_ordered_ids) WITH ORDINALITY AS ordered(id, position)
  ), '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.reorder_restaurant_menu_item_options_v1(
  p_restaurant_id uuid,
  p_menu_id uuid,
  p_section_id uuid,
  p_item_id uuid,
  p_ordered_ids uuid[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing uuid[];
BEGIN
  PERFORM 1
  FROM public.restaurant_menu_items
  WHERE restaurant_id = p_restaurant_id
    AND menu_id = p_menu_id
    AND section_id = p_section_id
    AND id = p_item_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'menu_item_not_found' USING ERRCODE = 'P0002';
  END IF;

  SELECT coalesce(array_agg(id), ARRAY[]::uuid[])
  INTO v_existing
  FROM (
    SELECT id
    FROM public.restaurant_menu_item_options
    WHERE restaurant_id = p_restaurant_id
      AND menu_item_id = p_item_id
    FOR UPDATE
  ) locked_options;

  IF NOT public.restaurant_menu_order_matches_v1(v_existing, p_ordered_ids) THEN
    RAISE EXCEPTION 'menu_order_stale' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.restaurant_menu_item_options AS target
  SET display_order = (ordered.position - 1)::integer
  FROM unnest(p_ordered_ids) WITH ORDINALITY AS ordered(id, position)
  WHERE target.restaurant_id = p_restaurant_id
    AND target.menu_item_id = p_item_id
    AND target.id = ordered.id
    AND target.display_order IS DISTINCT FROM (ordered.position - 1)::integer;

  RETURN coalesce((
    SELECT jsonb_agg(
      jsonb_build_object('id', ordered.id, 'displayOrder', ordered.position - 1)
      ORDER BY ordered.position
    )
    FROM unnest(p_ordered_ids) WITH ORDINALITY AS ordered(id, position)
  ), '[]'::jsonb);
END;
$$;

-- ---------------------------------------------------------------------------------------------
-- Privileges: service_role only.
-- ---------------------------------------------------------------------------------------------

REVOKE ALL ON FUNCTION public.restaurant_menu_order_matches_v1(uuid[], uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.restaurant_menu_order_matches_v1(uuid[], uuid[]) FROM anon;
REVOKE ALL ON FUNCTION public.restaurant_menu_order_matches_v1(uuid[], uuid[]) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.restaurant_menu_order_matches_v1(uuid[], uuid[]) TO service_role;

REVOKE ALL ON FUNCTION public.restaurant_menu_item_snapshot_v1(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.restaurant_menu_item_snapshot_v1(uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.restaurant_menu_item_snapshot_v1(uuid, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.restaurant_menu_item_snapshot_v1(uuid, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.create_restaurant_menu_item_v1(uuid, uuid, uuid, jsonb, jsonb, jsonb, text)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_restaurant_menu_item_v1(uuid, uuid, uuid, jsonb, jsonb, jsonb, text)
  FROM anon;
REVOKE ALL ON FUNCTION public.create_restaurant_menu_item_v1(uuid, uuid, uuid, jsonb, jsonb, jsonb, text)
  FROM authenticated;
GRANT EXECUTE ON FUNCTION public.create_restaurant_menu_item_v1(uuid, uuid, uuid, jsonb, jsonb, jsonb, text)
  TO service_role;

REVOKE ALL ON FUNCTION public.update_restaurant_menu_item_v1(uuid, uuid, uuid, uuid, jsonb, jsonb, jsonb, jsonb)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_restaurant_menu_item_v1(uuid, uuid, uuid, uuid, jsonb, jsonb, jsonb, jsonb)
  FROM anon;
REVOKE ALL ON FUNCTION public.update_restaurant_menu_item_v1(uuid, uuid, uuid, uuid, jsonb, jsonb, jsonb, jsonb)
  FROM authenticated;
GRANT EXECUTE ON FUNCTION public.update_restaurant_menu_item_v1(uuid, uuid, uuid, uuid, jsonb, jsonb, jsonb, jsonb)
  TO service_role;

REVOKE ALL ON FUNCTION public.create_restaurant_menu_section_v1(uuid, uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_restaurant_menu_section_v1(uuid, uuid, jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.create_restaurant_menu_section_v1(uuid, uuid, jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.create_restaurant_menu_section_v1(uuid, uuid, jsonb) TO service_role;

REVOKE ALL ON FUNCTION public.create_restaurant_menu_item_option_v1(uuid, uuid, uuid, uuid, jsonb)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_restaurant_menu_item_option_v1(uuid, uuid, uuid, uuid, jsonb)
  FROM anon;
REVOKE ALL ON FUNCTION public.create_restaurant_menu_item_option_v1(uuid, uuid, uuid, uuid, jsonb)
  FROM authenticated;
GRANT EXECUTE ON FUNCTION public.create_restaurant_menu_item_option_v1(uuid, uuid, uuid, uuid, jsonb)
  TO service_role;

REVOKE ALL ON FUNCTION public.reorder_restaurant_menu_sections_v1(uuid, uuid, uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reorder_restaurant_menu_sections_v1(uuid, uuid, uuid[]) FROM anon;
REVOKE ALL ON FUNCTION public.reorder_restaurant_menu_sections_v1(uuid, uuid, uuid[]) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.reorder_restaurant_menu_sections_v1(uuid, uuid, uuid[]) TO service_role;

REVOKE ALL ON FUNCTION public.reorder_restaurant_menu_items_v1(uuid, uuid, uuid, uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reorder_restaurant_menu_items_v1(uuid, uuid, uuid, uuid[]) FROM anon;
REVOKE ALL ON FUNCTION public.reorder_restaurant_menu_items_v1(uuid, uuid, uuid, uuid[]) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.reorder_restaurant_menu_items_v1(uuid, uuid, uuid, uuid[]) TO service_role;

REVOKE ALL ON FUNCTION public.reorder_restaurant_menu_item_options_v1(uuid, uuid, uuid, uuid, uuid[])
  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reorder_restaurant_menu_item_options_v1(uuid, uuid, uuid, uuid, uuid[])
  FROM anon;
REVOKE ALL ON FUNCTION public.reorder_restaurant_menu_item_options_v1(uuid, uuid, uuid, uuid, uuid[])
  FROM authenticated;
GRANT EXECUTE ON FUNCTION public.reorder_restaurant_menu_item_options_v1(uuid, uuid, uuid, uuid, uuid[])
  TO service_role;
