-- Atomic booking-type (booking_occasions) removal for DELETE /api/ops/occasions/[key].
--
-- Why:
--   The route counted the meal times and upcoming bookings that use a type, and then soft-deleted
--   it in a separate statement. A meal time or booking written in between (it only needs the FK,
--   which a soft-deleted row still satisfies) was left pointing at a removed type, and every later
--   meal-time save for that restaurant was then refused with UNKNOWN_BOOKING_TYPE.
--
-- What this migration does:
--   1. `delete_booking_occasion(p_key text, p_actor_id uuid) RETURNS jsonb`
--      - takes the catalog advisory lock that `create_booking_occasion` takes;
--      - locks the type's row FOR UPDATE. That conflicts with the FOR KEY SHARE lock every FK
--        insert into restaurant_service_periods / bookings takes on it, so an in-flight writer
--        that references the type finishes first (and is then counted), and a new one waits until
--        this transaction ends;
--      - counts the references and soft-deletes in the same transaction, and writes the audit row.
--      Refusals are results, not errors (nothing was written):
--        {"status":"not_found"} | {"status":"builtin"}
--        {"status":"in_use","future_bookings":n,"service_periods":n}
--        {"status":"deleted","before":{...},"after":{...}}
--   2. `replace_restaurant_service_periods` refuses rows whose booking type is soft-deleted
--      (SQLSTATE 23503, like an unknown type). It takes FOR KEY SHARE on the referenced types
--      first, so a concurrent removal is either seen here or waits for this write and then counts
--      it. The single-resource route and the availability command already validated this in the
--      application; this closes the window between that read and the write. The body is otherwise
--      the one from 20260927120000 (with its advisory lock).
--
-- Grants: service_role only.
--
-- Rollback (manual): DROP FUNCTION public.delete_booking_occasion(text, uuid) (the route then needs
--   its count-then-update code back), and re-apply replace_restaurant_service_periods from
--   20260927120000_save_restaurant_availability_command.sql. No data is changed by this migration.

BEGIN;

CREATE OR REPLACE FUNCTION public.delete_booking_occasion(
  p_key text,
  p_actor_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.booking_occasions;
  v_after public.booking_occasions;
  v_service_periods integer;
  v_future_bookings integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('booking_occasions:catalog', 0));

  SELECT o.* INTO v_row
  FROM public.booking_occasions o
  WHERE o.key = p_key
  FOR UPDATE;

  IF v_row.key IS NULL OR v_row.deleted_at IS NOT NULL THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  IF v_row.is_builtin THEN
    RETURN jsonb_build_object('status', 'builtin');
  END IF;

  -- New statements, so rows committed by a writer this lock waited for are counted.
  SELECT count(*) INTO v_service_periods
  FROM public.restaurant_service_periods sp
  WHERE sp.booking_option = p_key;

  SELECT count(*) INTO v_future_bookings
  FROM public.bookings b
  WHERE b.booking_type = p_key
    AND b.booking_date >= (now() AT TIME ZONE 'UTC')::date;

  IF v_service_periods > 0 OR v_future_bookings > 0 THEN
    RETURN jsonb_build_object(
      'status', 'in_use',
      'service_periods', v_service_periods,
      'future_bookings', v_future_bookings
    );
  END IF;

  UPDATE public.booking_occasions o
  SET
    deleted_at = now(),
    is_active = false,
    updated_by = p_actor_id,
    updated_at = now()
  WHERE o.key = p_key
  RETURNING o.* INTO v_after;

  INSERT INTO public.booking_occasions_audit (
    occasion_key,
    action,
    before_change,
    after_change,
    changed_by
  )
  VALUES (p_key, 'delete', to_jsonb(v_row), to_jsonb(v_after), p_actor_id);

  RETURN jsonb_build_object(
    'status', 'deleted',
    'before', to_jsonb(v_row),
    'after', to_jsonb(v_after)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.delete_booking_occasion(text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_booking_occasion(text, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.replace_restaurant_service_periods(
  p_restaurant_id uuid,
  p_rows jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(
    hashtextextended('replace_restaurant_service_periods:' || p_restaurant_id::text, 0)
  );

  DROP TABLE IF EXISTS pg_temp.replace_restaurant_service_periods_rows;

  CREATE TEMP TABLE replace_restaurant_service_periods_rows ON COMMIT DROP AS
  SELECT
    row.id,
    row.name,
    row.day_of_week,
    row.start_time,
    row.end_time,
    row.booking_option
  FROM jsonb_to_recordset(COALESCE(p_rows, '[]'::jsonb)) AS row(
    id uuid,
    name text,
    day_of_week integer,
    start_time time,
    end_time time,
    booking_option text
  );

  IF EXISTS (
    SELECT 1
    FROM pg_temp.replace_restaurant_service_periods_rows
    GROUP BY id
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'duplicate service-period replacement id';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.restaurant_service_periods existing
    JOIN pg_temp.replace_restaurant_service_periods_rows incoming
      ON incoming.id = existing.id
    WHERE existing.restaurant_id <> p_restaurant_id
  ) THEN
    RAISE EXCEPTION 'service-period replacement id belongs to another restaurant';
  END IF;

  -- Serialise with delete_booking_occasion (FOR UPDATE on the type row), then refuse removed
  -- types. The check is a new statement, so a removal committed while waiting is seen.
  PERFORM 1
  FROM public.booking_occasions o
  WHERE o.key IN (SELECT incoming.booking_option FROM pg_temp.replace_restaurant_service_periods_rows incoming)
  FOR KEY SHARE;

  IF EXISTS (
    SELECT 1
    FROM public.booking_occasions o
    WHERE o.key IN (SELECT incoming.booking_option FROM pg_temp.replace_restaurant_service_periods_rows incoming)
      AND o.deleted_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'service period uses a removed booking type' USING ERRCODE = '23503';
  END IF;

  INSERT INTO public.restaurant_service_periods (
    id,
    restaurant_id,
    name,
    day_of_week,
    start_time,
    end_time,
    booking_option
  )
  SELECT
    incoming.id,
    p_restaurant_id,
    incoming.name,
    incoming.day_of_week,
    incoming.start_time,
    incoming.end_time,
    incoming.booking_option
  FROM pg_temp.replace_restaurant_service_periods_rows incoming
  ON CONFLICT (id) DO UPDATE
  SET
    name = EXCLUDED.name,
    day_of_week = EXCLUDED.day_of_week,
    start_time = EXCLUDED.start_time,
    end_time = EXCLUDED.end_time,
    booking_option = EXCLUDED.booking_option,
    updated_at = now()
  WHERE public.restaurant_service_periods.restaurant_id = p_restaurant_id;

  DELETE FROM public.restaurant_service_periods existing
  WHERE existing.restaurant_id = p_restaurant_id
    AND NOT EXISTS (
      SELECT 1
      FROM pg_temp.replace_restaurant_service_periods_rows incoming
      WHERE incoming.id = existing.id
    );
END;
$$;

REVOKE ALL ON FUNCTION public.replace_restaurant_service_periods(uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.replace_restaurant_service_periods(uuid, jsonb) TO service_role;

COMMIT;
