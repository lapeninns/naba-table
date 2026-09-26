-- Atomic booking-type (booking_occasions) creation for POST /api/ops/occasions.
--
-- Why:
--   The route read the row by key, returned 409 if it was active, and otherwise upserted it. Two
--   concurrent creates could both pass the read, and the upsert then silently overwrote the first
--   one. Reviving a soft-deleted key also kept `deleted_at`, so the "created" row stayed hidden.
--   The next display_order (max + 10) was read in a separate statement, so concurrent creates
--   could also land on the same position.
--
-- What this migration does:
--   `create_booking_occasion(p_occasion jsonb, p_actor_id uuid) RETURNS jsonb`
--   - takes one catalog-wide advisory lock (booking types are a global catalog), so the
--     display_order read and the insert are serialised;
--   - resolves display_order: the requested value when no other active type uses it, otherwise
--     max + 10 (the order is a sort hint; a collision is resolved to the end, never an error);
--   - inserts, or revives a soft-deleted key, in ONE statement:
--     INSERT ... ON CONFLICT (key) DO UPDATE ... WHERE deleted_at IS NOT NULL.
--     An active row makes the statement a no-op, which is reported as SQLSTATE 23505
--     (OCCASION_ALREADY_EXISTS); there is no separate existence check to race;
--   - writes the audit row in the same transaction.
--
-- Grants: service_role only.
--
-- Rollback (manual): DROP FUNCTION public.create_booking_occasion(jsonb, uuid); the route then
--   needs its pre-2026-09-27 read-then-upsert code. No data is changed by this migration.

BEGIN;

CREATE OR REPLACE FUNCTION public.create_booking_occasion(
  p_occasion jsonb,
  p_actor_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key text := btrim(COALESCE(p_occasion ->> 'key', ''));
  v_label text := btrim(COALESCE(p_occasion ->> 'label', ''));
  v_requested_order integer;
  v_display_order integer;
  v_before jsonb;
  v_row public.booking_occasions;
BEGIN
  IF p_occasion IS NULL OR jsonb_typeof(p_occasion) <> 'object' THEN
    RAISE EXCEPTION 'occasion payload must be an object' USING ERRCODE = '22023';
  END IF;
  IF v_key !~ '^[a-z0-9_-]+$' THEN
    RAISE EXCEPTION 'invalid occasion key' USING ERRCODE = '22023';
  END IF;
  IF v_label = '' THEN
    RAISE EXCEPTION 'occasion label is required' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('booking_occasions:catalog', 0));

  IF jsonb_typeof(p_occasion -> 'display_order') = 'number' THEN
    v_requested_order := (p_occasion ->> 'display_order')::integer;
  END IF;

  IF v_requested_order IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.booking_occasions o
      WHERE o.display_order = v_requested_order
        AND o.deleted_at IS NULL
        AND o.key <> v_key
    ) THEN
    v_display_order := v_requested_order;
  ELSE
    SELECT COALESCE(MAX(o.display_order), 0) + 10
    INTO v_display_order
    FROM public.booking_occasions o;
  END IF;

  SELECT to_jsonb(o) INTO v_before
  FROM public.booking_occasions o
  WHERE o.key = v_key;

  INSERT INTO public.booking_occasions AS o (
    key,
    label,
    short_label,
    description,
    availability,
    default_duration_minutes,
    display_order,
    is_active,
    is_builtin,
    deleted_at,
    created_by,
    updated_by
  )
  VALUES (
    v_key,
    v_label,
    COALESCE(NULLIF(btrim(p_occasion ->> 'short_label'), ''), v_label),
    NULLIF(btrim(p_occasion ->> 'description'), ''),
    CASE
      WHEN jsonb_typeof(p_occasion -> 'availability') = 'array' THEN p_occasion -> 'availability'
      ELSE '[]'::jsonb
    END,
    COALESCE((p_occasion ->> 'default_duration_minutes')::integer, 90),
    v_display_order,
    COALESCE((p_occasion ->> 'is_active')::boolean, true),
    v_key IN ('lunch', 'dinner'),
    NULL,
    p_actor_id,
    p_actor_id
  )
  ON CONFLICT (key) DO UPDATE
  SET
    label = EXCLUDED.label,
    short_label = EXCLUDED.short_label,
    description = EXCLUDED.description,
    availability = EXCLUDED.availability,
    default_duration_minutes = EXCLUDED.default_duration_minutes,
    display_order = EXCLUDED.display_order,
    is_active = EXCLUDED.is_active,
    is_builtin = EXCLUDED.is_builtin,
    deleted_at = NULL,
    updated_by = EXCLUDED.updated_by,
    updated_at = now()
  WHERE o.deleted_at IS NOT NULL
  RETURNING o.* INTO v_row;

  IF v_row.key IS NULL THEN
    RAISE EXCEPTION 'OCCASION_ALREADY_EXISTS' USING ERRCODE = '23505';
  END IF;

  INSERT INTO public.booking_occasions_audit (
    occasion_key,
    action,
    before_change,
    after_change,
    changed_by
  )
  VALUES (v_key, 'create', v_before, to_jsonb(v_row), p_actor_id);

  RETURN to_jsonb(v_row);
END;
$$;

REVOKE ALL ON FUNCTION public.create_booking_occasion(jsonb, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_booking_occasion(jsonb, uuid) TO service_role;

COMMIT;
