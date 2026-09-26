-- Onboarding layout step: replace a restaurant's zones and tables in one transaction.
--
-- Why: the onboarding wizard used to POST zones and then POST tables as separate,
-- append-only writes, so a retry or a Back/Next round trip duplicated zones (or failed on
-- the unique zone name index) and left half-written layouts behind. This RPC applies the
-- submitted layout with replace semantics in one transaction:
--   * zones are upserted by (restaurant_id, lower(name)); tables by (restaurant_id, table_number),
--     so ids stay stable and re-sending the same payload is a no-op (idempotent);
--   * zones and tables that are not in the payload are deleted;
--   * the capacities used are registered in allowed_capacities (table_inventory has a
--     (restaurant_id, capacity) FK to it), ON CONFLICT DO NOTHING.
--
-- Safety: replace semantics are only allowed while the restaurant has no bookings and no
-- table holds. Once a booking or hold exists the call raises SQLSTATE 55000 with message
-- 'ONBOARDING_LAYOUT_LOCKED' and nothing changes; later layout edits go through the ops
-- tables/zones screens. A concurrent assignment that races the delete hits the RESTRICT
-- FKs, which is mapped to the same error. The restaurant row is locked FOR UPDATE so two
-- replaces for one restaurant serialize.
--
-- Errors (the app maps them to C1 codes):
--   P0002  ONBOARDING_RESTAURANT_NOT_FOUND
--   55000  ONBOARDING_LAYOUT_LOCKED
--   22023  ONBOARDING_LAYOUT_INVALID: <reason>
--
-- Privileges: SECURITY DEFINER, service_role only (the route authorizes the restaurant
-- admin first). Nothing else changes.
--
-- Rollback: DROP FUNCTION IF EXISTS public.onboarding_replace_layout(uuid, jsonb, jsonb);
-- No table, index or data is created by this migration, so dropping the function restores
-- the previous state. The app route that calls it (PUT /api/onboarding/restaurant/[id]/layout)
-- must be reverted with it.
--
-- Precondition: the ON CONFLICT targets need a non-partial unique index on
-- zones (restaurant_id, lower(name)) and on table_inventory (restaurant_id, table_number).
-- No repo migration creates them (they come from the baseline schema), so the migration
-- checks for them first and refuses to apply where either is missing, instead of shipping
-- a function that fails at runtime with 42P10.
BEGIN;

DO $precondition$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_index i
    WHERE i.indrelid = 'public.zones'::regclass
      AND i.indisunique
      AND i.indpred IS NULL
      AND pg_get_indexdef(i.indexrelid) LIKE '%(restaurant_id, lower(name))'
  ) THEN
    RAISE EXCEPTION 'onboarding_replace_layout requires a unique index on public.zones (restaurant_id, lower(name))'
      USING ERRCODE = '55000';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_index i
    WHERE i.indrelid = 'public.table_inventory'::regclass
      AND i.indisunique
      AND i.indpred IS NULL
      AND pg_get_indexdef(i.indexrelid) LIKE '%(restaurant_id, table_number)'
  ) THEN
    RAISE EXCEPTION 'onboarding_replace_layout requires a unique index on public.table_inventory (restaurant_id, table_number)'
      USING ERRCODE = '55000';
  END IF;
END
$precondition$;

CREATE OR REPLACE FUNCTION public.onboarding_replace_layout(
  p_restaurant_id uuid,
  p_zones jsonb,
  p_tables jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_zone_count integer;
  v_table_count integer;
  v_result jsonb;
BEGIN
  IF p_restaurant_id IS NULL THEN
    RAISE EXCEPTION 'ONBOARDING_LAYOUT_INVALID: restaurant id is required' USING ERRCODE = '22023';
  END IF;

  PERFORM 1 FROM public.restaurants WHERE id = p_restaurant_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ONBOARDING_RESTAURANT_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  IF EXISTS (SELECT 1 FROM public.bookings WHERE restaurant_id = p_restaurant_id)
     OR EXISTS (SELECT 1 FROM public.table_holds WHERE restaurant_id = p_restaurant_id) THEN
    RAISE EXCEPTION 'ONBOARDING_LAYOUT_LOCKED' USING ERRCODE = '55000';
  END IF;

  IF p_zones IS NULL OR jsonb_typeof(p_zones) <> 'array' THEN
    RAISE EXCEPTION 'ONBOARDING_LAYOUT_INVALID: zones must be an array' USING ERRCODE = '22023';
  END IF;
  IF p_tables IS NULL OR jsonb_typeof(p_tables) <> 'array' THEN
    RAISE EXCEPTION 'ONBOARDING_LAYOUT_INVALID: tables must be an array' USING ERRCODE = '22023';
  END IF;

  v_zone_count := jsonb_array_length(p_zones);
  v_table_count := jsonb_array_length(p_tables);
  IF v_zone_count < 1 OR v_zone_count > 25 THEN
    RAISE EXCEPTION 'ONBOARDING_LAYOUT_INVALID: between 1 and 25 zones are required' USING ERRCODE = '22023';
  END IF;
  IF v_table_count > 200 THEN
    RAISE EXCEPTION 'ONBOARDING_LAYOUT_INVALID: too many tables' USING ERRCODE = '22023';
  END IF;

  CREATE TEMP TABLE tmp_onboarding_zones (
    ord integer NOT NULL,
    name text NOT NULL,
    name_key text NOT NULL,
    sort_order smallint NOT NULL,
    active boolean NOT NULL
  ) ON COMMIT DROP;

  INSERT INTO tmp_onboarding_zones (ord, name, name_key, sort_order, active)
  SELECT z.ord::integer,
         btrim(COALESCE(z.value->>'name', '')),
         lower(btrim(COALESCE(z.value->>'name', ''))),
         COALESCE((z.value->>'sort_order')::smallint, (z.ord - 1)::smallint),
         COALESCE((z.value->>'active')::boolean, true)
  FROM jsonb_array_elements(p_zones) WITH ORDINALITY AS z(value, ord);

  IF EXISTS (SELECT 1 FROM tmp_onboarding_zones WHERE name = '' OR char_length(name) > 80) THEN
    RAISE EXCEPTION 'ONBOARDING_LAYOUT_INVALID: zone names must be 1 to 80 characters' USING ERRCODE = '22023';
  END IF;
  IF (SELECT count(DISTINCT name_key) FROM tmp_onboarding_zones) <> v_zone_count THEN
    RAISE EXCEPTION 'ONBOARDING_LAYOUT_INVALID: zone names must be unique' USING ERRCODE = '22023';
  END IF;

  CREATE TEMP TABLE tmp_onboarding_tables (
    ord integer NOT NULL,
    table_number text NOT NULL,
    capacity integer NOT NULL,
    min_party_size integer NOT NULL,
    max_party_size integer,
    zone_key text,
    category public.table_category NOT NULL,
    seating_type public.table_seating_type NOT NULL,
    mobility public.table_mobility NOT NULL
  ) ON COMMIT DROP;

  BEGIN
    INSERT INTO tmp_onboarding_tables (
      ord, table_number, capacity, min_party_size, max_party_size, zone_key,
      category, seating_type, mobility
    )
    SELECT t.ord::integer,
           btrim(COALESCE(t.value->>'table_number', '')),
           (t.value->>'capacity')::integer,
           COALESCE((t.value->>'min_party_size')::integer, 1),
           (t.value->>'max_party_size')::integer,
           lower(btrim(NULLIF(t.value->>'zone_name', ''))),
           COALESCE(NULLIF(t.value->>'category', ''), 'dining')::public.table_category,
           COALESCE(NULLIF(t.value->>'seating_type', ''), 'standard')::public.table_seating_type,
           COALESCE(NULLIF(t.value->>'mobility', ''), 'fixed')::public.table_mobility
    FROM jsonb_array_elements(p_tables) WITH ORDINALITY AS t(value, ord);
  EXCEPTION
    WHEN invalid_text_representation OR not_null_violation OR numeric_value_out_of_range THEN
      RAISE EXCEPTION 'ONBOARDING_LAYOUT_INVALID: table fields are malformed' USING ERRCODE = '22023';
  END;

  IF EXISTS (
    SELECT 1 FROM tmp_onboarding_tables
    WHERE table_number = ''
       OR char_length(table_number) > 50
       OR capacity < 1 OR capacity > 100
       OR min_party_size < 1
       OR (max_party_size IS NOT NULL AND max_party_size < min_party_size)
  ) THEN
    RAISE EXCEPTION 'ONBOARDING_LAYOUT_INVALID: table number, capacity or party size is out of range' USING ERRCODE = '22023';
  END IF;
  IF (SELECT count(DISTINCT table_number) FROM tmp_onboarding_tables) <> v_table_count THEN
    RAISE EXCEPTION 'ONBOARDING_LAYOUT_INVALID: table numbers must be unique' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM tmp_onboarding_tables t
    WHERE t.zone_key IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM tmp_onboarding_zones z WHERE z.name_key = t.zone_key)
  ) THEN
    RAISE EXCEPTION 'ONBOARDING_LAYOUT_INVALID: every table must reference a submitted zone' USING ERRCODE = '22023';
  END IF;

  -- Tables without a zone go to the first submitted zone.
  UPDATE tmp_onboarding_tables
  SET zone_key = (SELECT name_key FROM tmp_onboarding_zones ORDER BY ord LIMIT 1)
  WHERE zone_key IS NULL;

  -- 1. Zones: upsert by the unique (restaurant_id, lower(name)) index. Unchanged rows are
  --    not touched, so a replay does not bump updated_at or fire the adjacency trigger.
  INSERT INTO public.zones AS z (restaurant_id, name, sort_order, active)
  SELECT p_restaurant_id, s.name, s.sort_order, s.active
  FROM tmp_onboarding_zones s
  ORDER BY s.ord
  ON CONFLICT (restaurant_id, lower(name)) DO UPDATE
    SET name = EXCLUDED.name,
        sort_order = EXCLUDED.sort_order,
        active = EXCLUDED.active
    WHERE (z.name, z.sort_order, z.active)
          IS DISTINCT FROM (EXCLUDED.name, EXCLUDED.sort_order, EXCLUDED.active);

  -- 2. Capacities referenced by table_inventory's (restaurant_id, capacity) FK.
  INSERT INTO public.allowed_capacities (restaurant_id, capacity)
  SELECT DISTINCT p_restaurant_id, s.capacity::smallint
  FROM tmp_onboarding_tables s
  ON CONFLICT (restaurant_id, capacity) DO NOTHING;

  BEGIN
    -- 3. Tables: upsert by (restaurant_id, table_number); new rows start 'available'.
    INSERT INTO public.table_inventory AS ti (
      restaurant_id, table_number, capacity, min_party_size, max_party_size, zone_id,
      category, seating_type, mobility, status
    )
    SELECT p_restaurant_id,
           s.table_number,
           s.capacity,
           s.min_party_size,
           s.max_party_size,
           zr.id,
           s.category,
           s.seating_type,
           s.mobility,
           'available'::public.table_status
    FROM tmp_onboarding_tables s
    JOIN public.zones zr
      ON zr.restaurant_id = p_restaurant_id
     AND lower(zr.name) = s.zone_key
    ORDER BY s.ord
    ON CONFLICT (restaurant_id, table_number) DO UPDATE
      SET capacity = EXCLUDED.capacity,
          min_party_size = EXCLUDED.min_party_size,
          max_party_size = EXCLUDED.max_party_size,
          zone_id = EXCLUDED.zone_id,
          category = EXCLUDED.category,
          seating_type = EXCLUDED.seating_type,
          mobility = EXCLUDED.mobility
      WHERE (ti.capacity, ti.min_party_size, ti.max_party_size, ti.zone_id,
             ti.category, ti.seating_type, ti.mobility)
            IS DISTINCT FROM
            (EXCLUDED.capacity, EXCLUDED.min_party_size, EXCLUDED.max_party_size, EXCLUDED.zone_id,
             EXCLUDED.category, EXCLUDED.seating_type, EXCLUDED.mobility);

    -- 4. Remove what the payload no longer contains (tables first: zone FK is RESTRICT).
    DELETE FROM public.table_inventory ti
    WHERE ti.restaurant_id = p_restaurant_id
      AND NOT EXISTS (
        SELECT 1 FROM tmp_onboarding_tables s WHERE s.table_number = ti.table_number
      );

    DELETE FROM public.zones z
    WHERE z.restaurant_id = p_restaurant_id
      AND NOT EXISTS (
        SELECT 1 FROM tmp_onboarding_zones s WHERE s.name_key = lower(z.name)
      );
  EXCEPTION
    WHEN foreign_key_violation THEN
      -- A booking assignment or hold member raced this call and references a table.
      RAISE EXCEPTION 'ONBOARDING_LAYOUT_LOCKED' USING ERRCODE = '55000';
  END;

  SELECT jsonb_build_object(
    'zones', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object('id', z.id, 'name', z.name, 'sort_order', z.sort_order, 'active', z.active)
        ORDER BY z.sort_order, z.name
      )
      FROM public.zones z
      WHERE z.restaurant_id = p_restaurant_id
    ), '[]'::jsonb),
    'tables', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', ti.id,
          'table_number', ti.table_number,
          'capacity', ti.capacity,
          'min_party_size', ti.min_party_size,
          'max_party_size', ti.max_party_size,
          'zone_id', ti.zone_id,
          'category', ti.category,
          'seating_type', ti.seating_type,
          'mobility', ti.mobility,
          'status', ti.status
        )
        ORDER BY s.ord
      )
      FROM public.table_inventory ti
      JOIN tmp_onboarding_tables s ON s.table_number = ti.table_number
      WHERE ti.restaurant_id = p_restaurant_id
    ), '[]'::jsonb)
  )
  INTO v_result;

  DROP TABLE IF EXISTS tmp_onboarding_tables;
  DROP TABLE IF EXISTS tmp_onboarding_zones;

  RETURN v_result;
END;
$function$;

COMMENT ON FUNCTION public.onboarding_replace_layout(uuid, jsonb, jsonb) IS
  'Onboarding only: replace a restaurant''s zones and tables in one transaction (idempotent upsert + delete). Refused with ONBOARDING_LAYOUT_LOCKED once bookings or table holds exist.';

REVOKE ALL ON FUNCTION public.onboarding_replace_layout(uuid, jsonb, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.onboarding_replace_layout(uuid, jsonb, jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.onboarding_replace_layout(uuid, jsonb, jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.onboarding_replace_layout(uuid, jsonb, jsonb) TO service_role;

COMMIT;
