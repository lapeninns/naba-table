CREATE OR REPLACE FUNCTION public.replace_restaurant_operating_hours(
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
    hashtextextended('replace_restaurant_operating_hours:' || p_restaurant_id::text, 0)
  );

  DROP TABLE IF EXISTS pg_temp.replace_restaurant_operating_hours_rows;

  CREATE TEMP TABLE replace_restaurant_operating_hours_rows ON COMMIT DROP AS
  SELECT
    row.id,
    row.day_of_week,
    row.effective_date,
    row.opens_at,
    row.closes_at,
    COALESCE(row.is_closed, false) AS is_closed,
    row.notes,
    row.reservation_interval_minutes,
    row.reservation_slot_times
  FROM jsonb_to_recordset(COALESCE(p_rows, '[]'::jsonb)) AS row(
    id uuid,
    day_of_week integer,
    effective_date date,
    opens_at time,
    closes_at time,
    is_closed boolean,
    notes text,
    reservation_interval_minutes integer,
    reservation_slot_times jsonb
  );

  IF EXISTS (
    SELECT 1
    FROM pg_temp.replace_restaurant_operating_hours_rows
    GROUP BY id
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'duplicate operating-hours replacement id';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.restaurant_operating_hours existing
    JOIN pg_temp.replace_restaurant_operating_hours_rows incoming
      ON incoming.id = existing.id
    WHERE existing.restaurant_id <> p_restaurant_id
  ) THEN
    RAISE EXCEPTION 'operating-hours replacement id belongs to another restaurant';
  END IF;

  INSERT INTO public.restaurant_operating_hours (
    id,
    restaurant_id,
    day_of_week,
    effective_date,
    opens_at,
    closes_at,
    is_closed,
    notes,
    reservation_interval_minutes,
    reservation_slot_times
  )
  SELECT
    incoming.id,
    p_restaurant_id,
    incoming.day_of_week,
    incoming.effective_date,
    incoming.opens_at,
    incoming.closes_at,
    incoming.is_closed,
    incoming.notes,
    incoming.reservation_interval_minutes,
    CASE
      WHEN incoming.reservation_slot_times IS NULL THEN NULL
      ELSE ARRAY(
        SELECT jsonb_array_elements_text(incoming.reservation_slot_times)
      )
    END
  FROM pg_temp.replace_restaurant_operating_hours_rows incoming
  ON CONFLICT (id) DO UPDATE
  SET
    day_of_week = EXCLUDED.day_of_week,
    effective_date = EXCLUDED.effective_date,
    opens_at = EXCLUDED.opens_at,
    closes_at = EXCLUDED.closes_at,
    is_closed = EXCLUDED.is_closed,
    notes = EXCLUDED.notes,
    reservation_interval_minutes = EXCLUDED.reservation_interval_minutes,
    reservation_slot_times = EXCLUDED.reservation_slot_times,
    updated_at = now()
  WHERE public.restaurant_operating_hours.restaurant_id = p_restaurant_id;

  DELETE FROM public.restaurant_operating_hours existing
  WHERE existing.restaurant_id = p_restaurant_id
    AND NOT EXISTS (
      SELECT 1
      FROM pg_temp.replace_restaurant_operating_hours_rows incoming
      WHERE incoming.id = existing.id
    );
END;
$$;

REVOKE ALL ON FUNCTION public.replace_restaurant_operating_hours(uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.replace_restaurant_operating_hours(uuid, jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.replace_restaurant_operating_hours(uuid, jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.replace_restaurant_operating_hours(uuid, jsonb) TO service_role;
