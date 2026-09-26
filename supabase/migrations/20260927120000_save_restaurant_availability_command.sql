-- Availability save command: one transaction for the restaurant-owned part of "Save availability".
--
-- Why:
--   The Availability page saved hours, meal times, turn bands and the booking-rule fields on
--   `restaurants` through 3-4 separate endpoints, one after another. A failure part-way left a
--   mix of old and new settings, and nothing stopped two staff members overwriting each other.
--
-- What this migration does:
--   1. Adds the per-restaurant advisory lock that `replace_restaurant_operating_hours` already
--      takes to `replace_restaurant_service_periods` and `replace_restaurant_turn_bands`
--      (bodies otherwise unchanged from 20260516082800), so concurrent replacements of the same
--      restaurant queue instead of interleaving their upsert and delete phases.
--   2. `restaurant_availability_revisions(uuid)`: one content hash per section
--      ({hours, servicePeriods, turnBands, rules}), and `restaurant_availability_revision(uuid)`,
--      the hash of those four (the whole-page revision). Row ids and timestamps are excluded, so
--      replaying an already-applied save produces the same revisions.
--   3. `restaurant_availability_snapshot(uuid)`: the stored hours, service periods, turn bands and
--      booking-rule fields plus their revision and per-section revisions, built in ONE statement
--      so the rows and the revisions always describe the same state (NULL when the restaurant does
--      not exist). The Availability page loads from it, and the command returns it.
--   4. `save_restaurant_availability(...)`: replaces any subset of hours (weekly + special dates),
--      service periods, turn bands and the booking-rule fields in ONE transaction, reusing the
--      three replace_* functions. It takes the command lock and then every per-resource lock in a
--      fixed order, locks the restaurant row, checks the optional expected revisions, validates
--      the resulting configuration (meal times inside open weekly hours) and returns the snapshot
--      (as in 3) read inside the same transaction. Any failure rolls back every part.
--
-- Error contract (SQLSTATE, read by server/restaurants/availabilityCommand.ts):
--   NT400  malformed command (no parts, or a part of the wrong JSON type)
--   NT409  STALE_WRITE: a section this command writes changed since the caller loaded it
--          (p_expected_revisions, per section), or, for callers that still send only the
--          whole-page p_expected_revision, anything changed since it was loaded
--   NT422  SERVICE_PERIOD_OUTSIDE_HOURS: a weekday service period lies outside that day's hours
--   P0002  restaurant not found
--   23503  unknown booking option (FK), 23514 check constraints, P0001 from the replace_* helpers
--
-- Grants: service_role only, like the replace_* functions.
--
-- Rollback (manual, forward-only repo): DROP FUNCTION public.save_restaurant_availability(uuid,
--   jsonb, jsonb, jsonb, jsonb, text, jsonb); DROP FUNCTION public.restaurant_availability_snapshot(uuid);
--   DROP FUNCTION public.restaurant_availability_revision(uuid);
--   DROP FUNCTION public.restaurant_availability_revisions(uuid);
--   and re-apply the replace_restaurant_service_periods / replace_restaurant_turn_bands bodies from
--   20260516082800_atomic_restaurant_schedule_replacements.sql (without the advisory lock). No data
--   is changed by this migration, so rolling back needs no data repair.

BEGIN;

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

CREATE OR REPLACE FUNCTION public.replace_restaurant_turn_bands(
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
    hashtextextended('replace_restaurant_turn_bands:' || p_restaurant_id::text, 0)
  );

  DROP TABLE IF EXISTS pg_temp.replace_restaurant_turn_bands_rows;

  CREATE TEMP TABLE replace_restaurant_turn_bands_rows ON COMMIT DROP AS
  SELECT
    row.restaurant_id,
    lower(trim(row.booking_option)) AS booking_option,
    row.max_party_size,
    row.duration_minutes
  FROM jsonb_to_recordset(COALESCE(p_rows, '[]'::jsonb)) AS row(
    restaurant_id uuid,
    booking_option text,
    max_party_size integer,
    duration_minutes integer
  );

  IF EXISTS (
    SELECT 1
    FROM pg_temp.replace_restaurant_turn_bands_rows
    WHERE restaurant_id <> p_restaurant_id
  ) THEN
    RAISE EXCEPTION 'turn-band replacement row belongs to another restaurant';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_temp.replace_restaurant_turn_bands_rows
    WHERE restaurant_id IS NULL
      OR booking_option IS NULL
      OR booking_option = ''
      OR max_party_size IS NULL
      OR duration_minutes IS NULL
  ) THEN
    RAISE EXCEPTION 'invalid turn-band replacement row';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_temp.replace_restaurant_turn_bands_rows
    GROUP BY booking_option, max_party_size
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'duplicate turn-band replacement row';
  END IF;

  INSERT INTO public.restaurant_turn_bands (
    restaurant_id,
    booking_option,
    max_party_size,
    duration_minutes
  )
  SELECT
    p_restaurant_id,
    incoming.booking_option,
    incoming.max_party_size,
    incoming.duration_minutes
  FROM pg_temp.replace_restaurant_turn_bands_rows incoming
  ON CONFLICT (restaurant_id, booking_option, max_party_size) DO UPDATE
  SET
    duration_minutes = EXCLUDED.duration_minutes,
    updated_at = now();

  DELETE FROM public.restaurant_turn_bands existing
  WHERE existing.restaurant_id = p_restaurant_id
    AND NOT EXISTS (
      SELECT 1
      FROM pg_temp.replace_restaurant_turn_bands_rows incoming
      WHERE incoming.booking_option = existing.booking_option
        AND incoming.max_party_size = existing.max_party_size
    );
END;
$$;

REVOKE ALL ON FUNCTION public.replace_restaurant_turn_bands(uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.replace_restaurant_turn_bands(uuid, jsonb) TO service_role;

-- One content hash per section, so a save is only checked against the sections it writes: two
-- managers editing different sections (for example hours and booking rules) do not refuse each
-- other. Keys match the command parts: hours, servicePeriods, turnBands, rules.
CREATE OR REPLACE FUNCTION public.restaurant_availability_revisions(p_restaurant_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
      'hours',
      md5(COALESCE(
        (
          SELECT jsonb_agg(
            jsonb_build_array(
              h.day_of_week,
              h.effective_date,
              h.opens_at,
              h.closes_at,
              h.is_closed,
              h.notes,
              h.reservation_interval_minutes,
              h.reservation_slot_times
            )
            ORDER BY h.effective_date NULLS FIRST, h.day_of_week NULLS FIRST, h.opens_at,
              h.closes_at, h.is_closed, h.notes
          )
          FROM public.restaurant_operating_hours h
          WHERE h.restaurant_id = p_restaurant_id
        ),
        '[]'::jsonb
      )::text),
      'servicePeriods',
      md5(COALESCE(
        (
          SELECT jsonb_agg(
            jsonb_build_array(p.day_of_week, p.start_time, p.end_time, p.booking_option, p.name)
            ORDER BY p.day_of_week NULLS FIRST, p.start_time, p.end_time, p.booking_option, p.name
          )
          FROM public.restaurant_service_periods p
          WHERE p.restaurant_id = p_restaurant_id
        ),
        '[]'::jsonb
      )::text),
      'turnBands',
      md5(COALESCE(
        (
          SELECT jsonb_agg(
            jsonb_build_array(b.booking_option, b.max_party_size, b.duration_minutes)
            ORDER BY b.booking_option, b.max_party_size
          )
          FROM public.restaurant_turn_bands b
          WHERE b.restaurant_id = p_restaurant_id
        ),
        '[]'::jsonb
      )::text),
      'rules',
      md5(COALESCE((
        SELECT jsonb_build_array(
          r.reservation_interval_minutes,
          r.reservation_default_duration_minutes,
          r.reservation_last_seating_buffer_minutes,
          r.reservation_lifecycle_grace_minutes,
          r.booking_policy
        )
        FROM public.restaurants r
        WHERE r.id = p_restaurant_id
      ), 'null'::jsonb)::text)
    );
$$;

REVOKE ALL ON FUNCTION public.restaurant_availability_revisions(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.restaurant_availability_revisions(uuid) TO service_role;

-- The whole-page revision: a hash of the four section revisions. Kept for callers that send a
-- single expected revision.
CREATE OR REPLACE FUNCTION public.restaurant_availability_revision(p_restaurant_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT md5(public.restaurant_availability_revisions(p_restaurant_id)::text);
$$;


REVOKE ALL ON FUNCTION public.restaurant_availability_revision(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.restaurant_availability_revision(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.restaurant_availability_snapshot(p_restaurant_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- One statement, so the rows and the revision come from the same database snapshot.
  SELECT jsonb_build_object(
    'revision', public.restaurant_availability_revision(r.id),
    'revisions', public.restaurant_availability_revisions(r.id),
    'restaurant', jsonb_build_object(
      'timezone', r.timezone,
      'reservation_interval_minutes', r.reservation_interval_minutes,
      'reservation_default_duration_minutes', r.reservation_default_duration_minutes,
      'reservation_last_seating_buffer_minutes', r.reservation_last_seating_buffer_minutes,
      'reservation_lifecycle_grace_minutes', r.reservation_lifecycle_grace_minutes,
      'booking_policy', r.booking_policy,
      'updated_at', r.updated_at
    ),
    'operating_hours',
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', h.id,
            'day_of_week', h.day_of_week,
            'effective_date', h.effective_date,
            'opens_at', h.opens_at,
            'closes_at', h.closes_at,
            'is_closed', h.is_closed,
            'notes', h.notes,
            'reservation_interval_minutes', h.reservation_interval_minutes,
            'reservation_slot_times', h.reservation_slot_times,
            'updated_at', h.updated_at
          )
          ORDER BY h.effective_date NULLS FIRST, h.day_of_week NULLS FIRST, h.opens_at
        )
        FROM public.restaurant_operating_hours h
        WHERE h.restaurant_id = r.id
      ),
      '[]'::jsonb
    ),
    'service_periods',
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', p.id,
            'name', p.name,
            'day_of_week', p.day_of_week,
            'start_time', p.start_time,
            'end_time', p.end_time,
            'booking_option', p.booking_option,
            'updated_at', p.updated_at
          )
          ORDER BY p.day_of_week NULLS LAST, p.start_time
        )
        FROM public.restaurant_service_periods p
        WHERE p.restaurant_id = r.id
      ),
      '[]'::jsonb
    ),
    'turn_bands',
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'booking_option', b.booking_option,
            'max_party_size', b.max_party_size,
            'duration_minutes', b.duration_minutes
          )
          ORDER BY b.booking_option, b.max_party_size
        )
        FROM public.restaurant_turn_bands b
        WHERE b.restaurant_id = r.id
      ),
      '[]'::jsonb
    )
  )
  FROM public.restaurants r
  WHERE r.id = p_restaurant_id;
$$;

REVOKE ALL ON FUNCTION public.restaurant_availability_snapshot(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.restaurant_availability_snapshot(uuid) TO service_role;

-- An earlier draft of this file defined the six-argument form; drop it so no overload remains.
DROP FUNCTION IF EXISTS public.save_restaurant_availability(uuid, jsonb, jsonb, jsonb, jsonb, text);

CREATE OR REPLACE FUNCTION public.save_restaurant_availability(
  p_restaurant_id uuid,
  p_operating_hours jsonb DEFAULT NULL,
  p_service_periods jsonb DEFAULT NULL,
  p_turn_bands jsonb DEFAULT NULL,
  p_rules jsonb DEFAULT NULL,
  p_expected_revision text DEFAULT NULL,
  p_expected_revisions jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_before text;
  v_after text;
  v_before_sections jsonb;
  v_after_sections jsonb;
  v_section text;
  v_written text[];
BEGIN
  IF p_restaurant_id IS NULL THEN
    RAISE EXCEPTION 'restaurant id is required' USING ERRCODE = 'NT400';
  END IF;

  IF p_operating_hours IS NULL
    AND p_service_periods IS NULL
    AND p_turn_bands IS NULL
    AND p_rules IS NULL THEN
    RAISE EXCEPTION 'availability command has no parts' USING ERRCODE = 'NT400';
  END IF;

  IF (p_operating_hours IS NOT NULL AND jsonb_typeof(p_operating_hours) <> 'array')
    OR (p_service_periods IS NOT NULL AND jsonb_typeof(p_service_periods) <> 'array')
    OR (p_turn_bands IS NOT NULL AND jsonb_typeof(p_turn_bands) <> 'array')
    OR (p_rules IS NOT NULL AND jsonb_typeof(p_rules) <> 'object')
    OR (p_expected_revisions IS NOT NULL AND jsonb_typeof(p_expected_revisions) <> 'object') THEN
    RAISE EXCEPTION 'availability command part has the wrong shape' USING ERRCODE = 'NT400';
  END IF;

  -- Command lock first, then every single-resource lock in a fixed order. The replace_*
  -- helpers take their own lock again (advisory locks are re-entrant within a session), and a
  -- single-resource writer only ever holds one of them, so no lock cycle is possible.
  PERFORM pg_advisory_xact_lock(
    hashtextextended('save_restaurant_availability:' || p_restaurant_id::text, 0)
  );
  PERFORM pg_advisory_xact_lock(
    hashtextextended('replace_restaurant_operating_hours:' || p_restaurant_id::text, 0)
  );
  PERFORM pg_advisory_xact_lock(
    hashtextextended('replace_restaurant_service_periods:' || p_restaurant_id::text, 0)
  );
  PERFORM pg_advisory_xact_lock(
    hashtextextended('replace_restaurant_turn_bands:' || p_restaurant_id::text, 0)
  );

  -- The booking-rule fields live on the restaurant row; the row lock serialises this command with
  -- the restaurant profile PATCH (an UPDATE also takes FOR NO KEY UPDATE). NO KEY, not FOR UPDATE:
  -- no key column changes, and FOR UPDATE would block every FK child insert (bookings, holds,
  -- periods, bands take FOR KEY SHARE on the restaurant) for the whole command.
  PERFORM 1 FROM public.restaurants WHERE id = p_restaurant_id FOR NO KEY UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'restaurant not found' USING ERRCODE = 'P0002';
  END IF;

  v_before_sections := public.restaurant_availability_revisions(p_restaurant_id);
  v_before := md5(v_before_sections::text);

  IF p_operating_hours IS NOT NULL THEN
    PERFORM public.replace_restaurant_operating_hours(p_restaurant_id, p_operating_hours);
  END IF;

  IF p_service_periods IS NOT NULL THEN
    PERFORM public.replace_restaurant_service_periods(p_restaurant_id, p_service_periods);
  END IF;

  IF p_turn_bands IS NOT NULL THEN
    PERFORM public.replace_restaurant_turn_bands(p_restaurant_id, p_turn_bands);
  END IF;

  IF p_rules IS NOT NULL THEN
    UPDATE public.restaurants r
    SET
      reservation_interval_minutes = CASE
        WHEN p_rules ? 'reservation_interval_minutes'
          THEN (p_rules ->> 'reservation_interval_minutes')::integer
        ELSE r.reservation_interval_minutes
      END,
      reservation_default_duration_minutes = CASE
        WHEN p_rules ? 'reservation_default_duration_minutes'
          THEN (p_rules ->> 'reservation_default_duration_minutes')::integer
        ELSE r.reservation_default_duration_minutes
      END,
      reservation_last_seating_buffer_minutes = CASE
        WHEN p_rules ? 'reservation_last_seating_buffer_minutes'
          THEN (p_rules ->> 'reservation_last_seating_buffer_minutes')::integer
        ELSE r.reservation_last_seating_buffer_minutes
      END,
      reservation_lifecycle_grace_minutes = CASE
        WHEN p_rules ? 'reservation_lifecycle_grace_minutes'
          THEN (p_rules ->> 'reservation_lifecycle_grace_minutes')::integer
        ELSE r.reservation_lifecycle_grace_minutes
      END,
      booking_policy = CASE
        WHEN p_rules ? 'booking_policy'
          THEN NULLIF(btrim(p_rules ->> 'booking_policy'), '')
        ELSE r.booking_policy
      END
    WHERE r.id = p_restaurant_id;
  END IF;

  -- Validate the resulting configuration, not just the parts sent: a meal time on a weekday must
  -- sit inside that day's open hours. Only checked when hours or meal times change, so an
  -- unrelated rules-only save is never blocked by older data. Closed days, all-day periods and
  -- hours that wrap past midnight are left to the booking engine, as before.
  IF p_operating_hours IS NOT NULL OR p_service_periods IS NOT NULL THEN
    IF EXISTS (
      SELECT 1
      FROM public.restaurant_service_periods sp
      JOIN public.restaurant_operating_hours oh
        ON oh.restaurant_id = sp.restaurant_id
        AND oh.effective_date IS NULL
        AND oh.day_of_week = sp.day_of_week
      WHERE sp.restaurant_id = p_restaurant_id
        AND NOT oh.is_closed
        AND oh.opens_at IS NOT NULL
        AND oh.closes_at IS NOT NULL
        AND oh.opens_at < oh.closes_at
        AND (sp.start_time < oh.opens_at OR sp.end_time > oh.closes_at)
    ) THEN
      RAISE EXCEPTION 'SERVICE_PERIOD_OUTSIDE_HOURS' USING ERRCODE = 'NT422';
    END IF;
  END IF;

  v_after_sections := public.restaurant_availability_revisions(p_restaurant_id);
  v_after := md5(v_after_sections::text);

  -- Stale check. A caller whose revision no longer matches is refused, unless this command
  -- changed nothing (a replay of a save that already committed, e.g. a retry after a lost
  -- response), in which case the stored state is already what the caller asked for.
  v_written := array_remove(ARRAY[
    CASE WHEN p_operating_hours IS NOT NULL THEN 'hours' END,
    CASE WHEN p_service_periods IS NOT NULL THEN 'servicePeriods' END,
    CASE WHEN p_turn_bands IS NOT NULL THEN 'turnBands' END,
    CASE WHEN p_rules IS NOT NULL THEN 'rules' END
  ], NULL);

  IF p_expected_revisions IS NOT NULL THEN
    -- Per section, and only for the sections this command writes: a concurrent save of another
    -- section is not a conflict. Cross-section consistency (meal times inside hours) is
    -- validated above on the resulting state, whatever the revisions say.
    FOREACH v_section IN ARRAY v_written LOOP
      IF p_expected_revisions ? v_section
        AND (p_expected_revisions ->> v_section) IS DISTINCT FROM (v_before_sections ->> v_section)
        AND (v_after_sections ->> v_section) IS DISTINCT FROM (v_before_sections ->> v_section) THEN
        RAISE EXCEPTION 'STALE_WRITE' USING ERRCODE = 'NT409';
      END IF;
    END LOOP;
  ELSIF p_expected_revision IS NOT NULL
    AND p_expected_revision <> v_before
    AND v_after <> v_before THEN
    -- Whole-page revision (callers that predate per-section revisions).
    RAISE EXCEPTION 'STALE_WRITE' USING ERRCODE = 'NT409';
  END IF;

  -- The canonical stored state, read inside this transaction so it matches v_after exactly.
  RETURN public.restaurant_availability_snapshot(p_restaurant_id);
END;
$$;

REVOKE ALL ON FUNCTION public.save_restaurant_availability(uuid, jsonb, jsonb, jsonb, jsonb, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_restaurant_availability(uuid, jsonb, jsonb, jsonb, jsonb, text, jsonb) TO service_role;

COMMIT;
