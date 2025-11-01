-- 1. Zone tracking on bookings.
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS assigned_zone_id uuid;

COMMENT ON COLUMN public.bookings.assigned_zone_id IS 'Zone enforced for all table assignments tied to the booking.';

ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_assigned_zone_id_fkey
  FOREIGN KEY (assigned_zone_id)
  REFERENCES public.zones(id)
  ON DELETE SET NULL;

-- Backfill consistent zones where all assignments agree.
WITH zone_per_booking AS (
  SELECT bta.booking_id,
         CASE WHEN COUNT(DISTINCT ti.zone_id) = 1 THEN (array_agg(ti.zone_id))[1] ELSE NULL END AS zone_id
  FROM public.booking_table_assignments bta
  JOIN public.table_inventory ti ON ti.id = bta.table_id
  GROUP BY bta.booking_id
)
UPDATE public.bookings b
SET assigned_zone_id = z.zone_id
FROM zone_per_booking z
WHERE b.id = z.booking_id
  AND z.zone_id IS NOT NULL
  AND (b.assigned_zone_id IS DISTINCT FROM z.zone_id);

-- 2. Link assignments to allocations to prevent orphan rows.
ALTER TABLE public.booking_table_assignments
  ADD COLUMN IF NOT EXISTS allocation_id uuid;

COMMENT ON COLUMN public.booking_table_assignments.allocation_id IS 'Allocation row backing the assignment; used for overlap enforcement.';

-- Backfill allocation ids using existing allocation records.
WITH ordered_allocations AS (
  SELECT bta.id AS assignment_id,
         a.id AS allocation_id,
         ROW_NUMBER() OVER (
           PARTITION BY bta.id
           ORDER BY
             GREATEST(lower(a."window"), bta.start_at) DESC NULLS LAST,
             a.updated_at DESC
         ) AS row_rank
  FROM public.booking_table_assignments bta
  JOIN public.allocations a
    ON a.resource_type = 'table'
   AND a.resource_id = bta.table_id
   AND (a.booking_id = bta.booking_id OR a.booking_id IS NULL)
   AND (bta.start_at IS NULL OR a."window" && tstzrange(bta.start_at, COALESCE(bta.end_at, bta.start_at + interval '1 minute'), '[)'))
)
UPDATE public.booking_table_assignments bta
SET allocation_id = oa.allocation_id
FROM ordered_allocations oa
WHERE oa.assignment_id = bta.id
  AND oa.row_rank = 1
  AND (bta.allocation_id IS DISTINCT FROM oa.allocation_id);

ALTER TABLE public.booking_table_assignments
  ADD CONSTRAINT booking_table_assignments_allocation_id_fkey
  FOREIGN KEY (allocation_id)
  REFERENCES public.allocations(id)
  ON DELETE SET NULL;

-- 3. Strengthen idempotency uniqueness via hashed table set.
ALTER TABLE public.booking_assignment_idempotency
  ADD COLUMN IF NOT EXISTS table_set_hash text;

COMMENT ON COLUMN public.booking_assignment_idempotency.table_set_hash IS 'MD5 hash of sorted table ids used to dedupe idempotency payloads.';

WITH existing_hashes AS (
  SELECT booking_id,
         idempotency_key,
         CASE
           WHEN table_ids IS NULL OR array_length(table_ids, 1) = 0 THEN NULL
           ELSE md5(array_to_string(array(SELECT unnest(table_ids) ORDER BY 1), ','))
         END AS table_set_hash
  FROM public.booking_assignment_idempotency
)
UPDATE public.booking_assignment_idempotency b
SET table_set_hash = e.table_set_hash
FROM existing_hashes e
WHERE b.booking_id = e.booking_id
  AND b.idempotency_key = e.idempotency_key
  AND (b.table_set_hash IS DISTINCT FROM e.table_set_hash);

CREATE UNIQUE INDEX IF NOT EXISTS booking_assignment_idempotency_booking_hash_key
  ON public.booking_assignment_idempotency (booking_id, table_set_hash)
  WHERE table_set_hash IS NOT NULL;

-- 4. Hold enforcement: ensure table_hold_windows always synchronises and mirrors into allocations.
CREATE OR REPLACE FUNCTION public.sync_table_hold_windows()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_hold RECORD;
  v_window tstzrange;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.table_hold_windows
    WHERE hold_id = OLD.hold_id AND table_id = OLD.table_id;

    DELETE FROM public.allocations
    WHERE resource_type = 'table'
      AND resource_id = OLD.table_id
      AND shadow = true
      AND booking_id IS NOT DISTINCT FROM (
        SELECT booking_id FROM public.table_holds WHERE id = OLD.hold_id
      );

    RETURN OLD;
  END IF;

  SELECT *
  INTO v_hold
  FROM public.table_holds
  WHERE id = COALESCE(NEW.hold_id, OLD.hold_id)
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  v_window := tstzrange(v_hold.start_at, v_hold.end_at, '[)');

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.table_hold_windows (hold_id, table_id, restaurant_id, booking_id, start_at, end_at, expires_at)
    VALUES (NEW.hold_id, NEW.table_id, v_hold.restaurant_id, v_hold.booking_id, v_hold.start_at, v_hold.end_at, v_hold.expires_at)
    ON CONFLICT (hold_id, table_id) DO UPDATE
      SET start_at = EXCLUDED.start_at,
          end_at = EXCLUDED.end_at,
          expires_at = EXCLUDED.expires_at,
          restaurant_id = EXCLUDED.restaurant_id,
          booking_id = EXCLUDED.booking_id;
  END IF;

  INSERT INTO public.allocations (
    booking_id,
    restaurant_id,
    resource_type,
    resource_id,
    "window",
    created_by,
    shadow,
    created_at,
    updated_at
  ) VALUES (
    v_hold.booking_id,
    v_hold.restaurant_id,
    'table',
    COALESCE(NEW.table_id, OLD.table_id),
    v_window,
    v_hold.created_by,
    true,
    timezone('utc', now()),
    timezone('utc', now())
  )
  ON CONFLICT ON CONSTRAINT allocations_booking_resource_key DO UPDATE
    SET "window" = EXCLUDED."window",
        restaurant_id = EXCLUDED.restaurant_id,
        shadow = true,
        updated_at = timezone('utc', now());

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_table_hold_windows()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_window tstzrange := tstzrange(NEW.start_at, NEW.end_at, '[)');
BEGIN
  UPDATE public.table_hold_windows
  SET start_at = NEW.start_at,
      end_at = NEW.end_at,
      expires_at = NEW.expires_at,
      restaurant_id = NEW.restaurant_id,
      booking_id = NEW.booking_id
  WHERE hold_id = NEW.id;

  UPDATE public.allocations
  SET "window" = v_window,
      restaurant_id = NEW.restaurant_id,
      booking_id = NEW.booking_id,
      shadow = CASE WHEN shadow THEN shadow ELSE false END,
      updated_at = timezone('utc', now())
  WHERE resource_type = 'table'
    AND resource_id IN (
      SELECT table_id FROM public.table_hold_members WHERE hold_id = NEW.id
    )
    AND booking_id IS NOT DISTINCT FROM NEW.booking_id
    AND shadow = true;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS table_hold_members_sync_insert ON public.table_hold_members;
DROP TRIGGER IF EXISTS table_hold_members_sync_delete ON public.table_hold_members;
DROP TRIGGER IF EXISTS table_holds_sync_update ON public.table_holds;

CREATE TRIGGER table_hold_members_sync_insert
AFTER INSERT ON public.table_hold_members
FOR EACH ROW EXECUTE FUNCTION public.sync_table_hold_windows();

CREATE TRIGGER table_hold_members_sync_delete
AFTER DELETE ON public.table_hold_members
FOR EACH ROW EXECUTE FUNCTION public.sync_table_hold_windows();

CREATE TRIGGER table_holds_sync_update
AFTER UPDATE OF start_at, end_at, expires_at, restaurant_id, booking_id ON public.table_holds
FOR EACH ROW EXECUTE FUNCTION public.update_table_hold_windows();

-- 5. Post-assignment capacity validation helper.
CREATE OR REPLACE FUNCTION public.validate_booking_capacity_after_assignment(p_booking_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_booking RECORD;
  v_service_period RECORD;
  v_capacity_rule RECORD;
  v_timezone text;
  v_start timestamptz;
  v_end timestamptz;
  v_total_covers integer;
  v_total_parties integer;
  v_max_covers integer := 999999;
  v_max_parties integer := 999999;
  v_allow_after_hours boolean := false;
  v_policy RECORD;
  v_service_id uuid;
BEGIN
  SELECT b.*, r.timezone AS restaurant_timezone
  INTO v_booking
  FROM public.bookings b
  JOIN public.restaurants r ON r.id = b.restaurant_id
  WHERE b.id = p_booking_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  v_timezone := COALESCE(NULLIF(v_booking.restaurant_timezone, ''), 'UTC');
  v_start := v_booking.start_at;
  v_end := v_booking.end_at;

  IF v_start IS NULL OR v_end IS NULL THEN
    RETURN;
  END IF;

  SELECT allow_after_hours
  INTO v_allow_after_hours
  FROM public.service_policy
  ORDER BY created_at DESC
  LIMIT 1;

  SELECT sp.*
  INTO v_service_period
  FROM public.restaurant_service_periods sp
  WHERE sp.restaurant_id = v_booking.restaurant_id
    AND (sp.day_of_week IS NULL OR sp.day_of_week = EXTRACT(DOW FROM v_booking.booking_date)::smallint)
    AND v_booking.start_time >= sp.start_time
    AND v_booking.start_time < sp.end_time
  ORDER BY sp.day_of_week DESC NULLS LAST, sp.start_time ASC
  LIMIT 1;

  v_service_id := v_service_period.id;

  SELECT
    COALESCE(cr.max_covers, v_max_covers) AS max_covers,
    COALESCE(cr.max_parties, v_max_parties) AS max_parties
  INTO v_capacity_rule
  FROM public.restaurant_capacity_rules cr
  WHERE cr.restaurant_id = v_booking.restaurant_id
    AND (cr.service_period_id IS NULL OR cr.service_period_id = v_service_id)
    AND (cr.day_of_week IS NULL OR cr.day_of_week = EXTRACT(DOW FROM v_booking.booking_date)::smallint)
    AND (cr.effective_date IS NULL OR cr.effective_date <= v_booking.booking_date)
  ORDER BY cr.effective_date DESC NULLS LAST,
           cr.day_of_week DESC NULLS LAST,
           cr.service_period_id DESC NULLS LAST
  LIMIT 1
  FOR UPDATE;

  v_max_covers := COALESCE(v_capacity_rule.max_covers, v_max_covers);
  v_max_parties := COALESCE(v_capacity_rule.max_parties, v_max_parties);

  SELECT
    COALESCE(SUM(b.party_size), 0) AS total_covers,
    COUNT(*) AS total_parties
  INTO v_total_covers, v_total_parties
  FROM public.bookings b
  WHERE b.restaurant_id = v_booking.restaurant_id
    AND b.booking_date = v_booking.booking_date
    AND b.status IN ('confirmed', 'pending', 'checked_in')
    AND (
      v_service_id IS NULL
      OR (b.start_time >= v_service_period.start_time AND b.start_time < v_service_period.end_time)
    );

  IF v_total_covers > v_max_covers OR v_total_parties > v_max_parties THEN
    RAISE EXCEPTION 'capacity_exceeded_post_assignment'
      USING ERRCODE = 'P0001',
            DETAIL = format('Capacity exceeded after assignment: covers %s/%s, parties %s/%s', v_total_covers, v_max_covers, v_total_parties, v_max_parties),
            HINT = 'Release tables or adjust capacity overrides before retrying.';
  END IF;
END;
$$;

-- 6. Optimistic slot creation with ON CONFLICT.
CREATE OR REPLACE FUNCTION public.get_or_create_booking_slot(
  p_restaurant_id uuid,
  p_slot_date date,
  p_slot_time time without time zone,
  p_default_capacity integer DEFAULT 999
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_slot_id uuid;
  v_service_period_id uuid;
  v_capacity integer;
  v_rules_exist boolean := to_regclass('public.restaurant_capacity_rules') IS NOT NULL;
BEGIN
  SELECT id
  INTO v_slot_id
  FROM public.booking_slots
  WHERE restaurant_id = p_restaurant_id
    AND slot_date = p_slot_date
    AND slot_time = p_slot_time;

  IF FOUND THEN
    RETURN v_slot_id;
  END IF;

  SELECT id
  INTO v_service_period_id
  FROM public.restaurant_service_periods
  WHERE restaurant_id = p_restaurant_id
    AND (day_of_week IS NULL OR day_of_week = EXTRACT(DOW FROM p_slot_date)::smallint)
    AND p_slot_time >= start_time
    AND p_slot_time < end_time
  ORDER BY day_of_week DESC NULLS LAST, start_time ASC
  LIMIT 1;

  IF v_rules_exist THEN
    SELECT COALESCE(max_covers, p_default_capacity)
    INTO v_capacity
    FROM public.restaurant_capacity_rules
    WHERE restaurant_id = p_restaurant_id
      AND (service_period_id IS NULL OR service_period_id = v_service_period_id)
      AND (day_of_week IS NULL OR day_of_week = EXTRACT(DOW FROM p_slot_date)::smallint)
      AND (effective_date IS NULL OR effective_date <= p_slot_date)
    ORDER BY effective_date DESC NULLS LAST,
             day_of_week DESC NULLS LAST,
             service_period_id DESC NULLS LAST
    LIMIT 1;
  END IF;

  v_capacity := COALESCE(v_capacity, p_default_capacity);

  INSERT INTO public.booking_slots (
    restaurant_id,
    slot_date,
    slot_time,
    service_period_id,
    available_capacity,
    reserved_count
  ) VALUES (
    p_restaurant_id,
    p_slot_date,
    p_slot_time,
    v_service_period_id,
    v_capacity,
    0
  )
  ON CONFLICT ON CONSTRAINT booking_slots_restaurant_slot_key DO UPDATE
    SET service_period_id = EXCLUDED.service_period_id,
        available_capacity = greatest(public.booking_slots.available_capacity, EXCLUDED.available_capacity),
        updated_at = timezone('utc', now())
  RETURNING id INTO v_slot_id;

  RETURN v_slot_id;
END;
$$;

-- 7. Update assign_tables_atomic_v2 with zone enforcement, allocation linkage, and capacity recheck.
CREATE OR REPLACE FUNCTION public.assign_tables_atomic_v2(
  p_booking_id uuid,
  p_table_ids uuid[],
  p_idempotency_key text DEFAULT NULL,
  p_require_adjacency boolean DEFAULT false,
  p_assigned_by uuid DEFAULT NULL,
  p_start_at timestamptz DEFAULT NULL,
  p_end_at timestamptz DEFAULT NULL
) RETURNS TABLE (
  table_id uuid,
  start_at timestamptz,
  end_at timestamptz,
  merge_group_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_booking RECORD;
  v_zone_id uuid;
  v_restaurant_id uuid;
  v_service_date date;
  v_lock_zone int4;
  v_lock_bucket int4;
  v_now timestamptz := timezone('utc', now());
  v_table_ids uuid[];
  v_table_count integer;
  v_table RECORD;
  v_loaded_count integer := 0;
  v_slot_id uuid := NULL;
  v_start_at timestamptz;
  v_end_at timestamptz;
  v_window tstzrange;
  v_timezone text := NULL;
  v_merge_allocation_id uuid := NULL;
  v_table_assignment_id uuid;
  v_existing RECORD;
  v_adjacency_count integer;
  v_table_id uuid;
  v_merge_group_supported boolean := false;
  v_conflict RECORD;
  v_existing_zones uuid[] := ARRAY[]::uuid[];
  v_table_set_hash text;
  v_hold_conflict uuid;
  v_allocation_id uuid;
  v_capacity_check_enabled boolean := true;
  v_bucket_minutes integer := 60;
BEGIN
  IF p_table_ids IS NULL OR array_length(p_table_ids, 1) = 0 THEN
    RAISE EXCEPTION 'assign_tables_atomic_v2 requires at least one table id'
      USING ERRCODE = '23514';
  END IF;

  SELECT array_agg(DISTINCT t.table_id ORDER BY t.table_id)
  INTO v_table_ids
  FROM unnest(p_table_ids) AS t(table_id);

  IF v_table_ids IS NULL OR array_length(v_table_ids, 1) = 0 THEN
    RAISE EXCEPTION 'assign_tables_atomic_v2 requires at least one valid table id'
      USING ERRCODE = '23514';
  END IF;

  v_table_count := array_length(v_table_ids, 1);
  v_table_set_hash := md5(array_to_string(v_table_ids, ','));

  SELECT b.*, r.timezone AS restaurant_timezone
  INTO v_booking
  FROM public.bookings b
  LEFT JOIN public.restaurants r ON r.id = b.restaurant_id
  WHERE b.id = p_booking_id
  FOR UPDATE OF b;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking % not found', p_booking_id
      USING ERRCODE = 'P0002';
  END IF;

  v_restaurant_id := v_booking.restaurant_id;
  v_timezone := COALESCE(NULLIF(v_booking.restaurant_timezone, ''), 'UTC');

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'booking_table_assignments'
      AND column_name = 'merge_group_id'
  ) INTO v_merge_group_supported;

  IF (p_start_at IS NULL) <> (p_end_at IS NULL) THEN
    RAISE EXCEPTION 'assign_tables_atomic_v2 requires both start and end when providing custom window'
      USING ERRCODE = '22023';
  END IF;

  IF p_start_at IS NOT NULL AND p_end_at IS NOT NULL THEN
    v_start_at := p_start_at;
    v_end_at := p_end_at;
  ELSIF v_booking.start_at IS NOT NULL AND v_booking.end_at IS NOT NULL THEN
    v_start_at := v_booking.start_at;
    v_end_at := v_booking.end_at;
  ELSIF v_booking.booking_date IS NOT NULL AND v_booking.start_time IS NOT NULL AND v_booking.end_time IS NOT NULL THEN
    v_start_at := make_timestamptz(
      EXTRACT(YEAR FROM v_booking.booking_date)::int,
      EXTRACT(MONTH FROM v_booking.booking_date)::int,
      EXTRACT(DAY FROM v_booking.booking_date)::int,
      EXTRACT(HOUR FROM v_booking.start_time)::int,
      EXTRACT(MINUTE FROM v_booking.start_time)::int,
      EXTRACT(SECOND FROM v_booking.start_time),
      v_timezone
    );
    v_end_at := make_timestamptz(
      EXTRACT(YEAR FROM v_booking.booking_date)::int,
      EXTRACT(MONTH FROM v_booking.booking_date)::int,
      EXTRACT(DAY FROM v_booking.booking_date)::int,
      EXTRACT(HOUR FROM v_booking.end_time)::int,
      EXTRACT(MINUTE FROM v_booking.end_time)::int,
      EXTRACT(SECOND FROM v_booking.end_time),
      v_timezone
    );
  ELSE
    RAISE EXCEPTION 'Booking % missing start/end window', p_booking_id
      USING ERRCODE = '22000';
  END IF;

  IF v_start_at >= v_end_at THEN
    RAISE EXCEPTION 'Booking % has invalid time window', p_booking_id
      USING ERRCODE = '22000';
  END IF;

  v_window := tstzrange(v_start_at, v_end_at, '[)');
  v_service_date := (v_start_at AT TIME ZONE v_timezone)::date;

  FOR v_table IN
    SELECT id, restaurant_id, zone_id, active, status, mobility
    FROM public.table_inventory
    WHERE id = ANY (v_table_ids)
    ORDER BY id
    FOR UPDATE
  LOOP
    IF v_table.restaurant_id <> v_restaurant_id THEN
      RAISE EXCEPTION 'Table % belongs to a different restaurant', v_table.id
        USING ERRCODE = '23503';
    END IF;

    IF v_table.zone_id IS NULL THEN
      RAISE EXCEPTION 'Table % is not assigned to a zone', v_table.id
        USING ERRCODE = '23514';
    END IF;

    IF v_table.active IS NOT TRUE THEN
      RAISE EXCEPTION 'Table % is inactive', v_table.id
        USING ERRCODE = '23514';
    END IF;

    IF v_zone_id IS NULL THEN
      v_zone_id := v_table.zone_id;
    ELSIF v_zone_id <> v_table.zone_id THEN
      RAISE EXCEPTION 'All tables must belong to the same zone (found %, expected %)', v_table.zone_id, v_zone_id
        USING ERRCODE = '23514';
    END IF;

    IF v_table_count > 1 AND v_table.mobility <> 'movable'::public.table_mobility THEN
      RAISE EXCEPTION 'Merged assignments require movable tables (% is %)', v_table.id, v_table.mobility
        USING ERRCODE = '23514';
    END IF;

    v_loaded_count := v_loaded_count + 1;
  END LOOP;

  IF v_loaded_count <> v_table_count THEN
    RAISE EXCEPTION 'Unable to load all requested tables for booking %', p_booking_id
      USING ERRCODE = 'P0002';
  END IF;

  SELECT array_agg(DISTINCT ti.zone_id)
  INTO v_existing_zones
  FROM public.booking_table_assignments existing
  JOIN public.table_inventory ti ON ti.id = existing.table_id
  WHERE existing.booking_id = p_booking_id;

  IF array_length(v_existing_zones, 1) IS NOT NULL AND array_length(v_existing_zones, 1) > 0 THEN
    IF v_zone_id IS NULL OR EXISTS (
      SELECT 1 FROM unnest(v_existing_zones) AS z WHERE z IS DISTINCT FROM v_zone_id
    ) THEN
      RAISE EXCEPTION 'Booking % already has assignments in a different zone', p_booking_id
        USING ERRCODE = '23514';
    END IF;
  END IF;

  IF v_booking.assigned_zone_id IS NULL THEN
    UPDATE public.bookings
    SET assigned_zone_id = v_zone_id,
        updated_at = v_now
    WHERE id = p_booking_id;
  ELSIF v_booking.assigned_zone_id IS DISTINCT FROM v_zone_id THEN
    RAISE EXCEPTION 'Booking % locked to zone %, cannot assign zone %', p_booking_id, v_booking.assigned_zone_id, v_zone_id
      USING ERRCODE = '23514';
  END IF;

  IF p_require_adjacency AND v_table_count > 1 THEN
    FOR v_table IN
      SELECT id FROM unnest(v_table_ids) AS t(id)
    LOOP
      SELECT COUNT(*)
      INTO v_adjacency_count
      FROM public.table_adjacencies
      WHERE (
        table_a = v_table.id AND table_b = ANY (v_table_ids) AND table_b <> v_table.id
      ) OR (
        table_b = v_table.id AND table_a = ANY (v_table_ids) AND table_a <> v_table.id
      );

      IF COALESCE(v_adjacency_count, 0) = 0 THEN
        RAISE EXCEPTION 'Table % is not adjacent to the selected set', v_table.id
          USING ERRCODE = '23514';
      END IF;
    END LOOP;
  END IF;

  v_lock_zone := hashtext(COALESCE(v_zone_id::text, ''));
  v_lock_bucket := COALESCE((EXTRACT(EPOCH FROM date_trunc('hour', v_start_at))::bigint / 60)::int, 0);
  PERFORM pg_advisory_xact_lock(v_lock_zone, v_lock_bucket);

  IF p_idempotency_key IS NOT NULL THEN
    SELECT *
    INTO v_existing
    FROM public.booking_assignment_idempotency
    WHERE booking_id = p_booking_id
      AND idempotency_key = p_idempotency_key;

    IF FOUND THEN
      IF v_existing.table_set_hash IS DISTINCT FROM v_table_set_hash THEN
        RAISE EXCEPTION 'assign_tables_atomic_v2 idempotency mismatch for booking %', p_booking_id
          USING ERRCODE = 'P0003',
                DETAIL = 'Idempotency key reuse detected with a different table set';
      END IF;

      RETURN QUERY
        SELECT
          bta.table_id,
          COALESCE(bta.start_at, lower(v_existing.assignment_window)) AS start_at,
          COALESCE(bta.end_at, upper(v_existing.assignment_window)) AS end_at,
          v_existing.merge_group_allocation_id
        FROM public.booking_table_assignments bta
        WHERE bta.booking_id = p_booking_id
          AND bta.idempotency_key = p_idempotency_key
          AND bta.table_id = ANY (v_table_ids)
        ORDER BY bta.table_id;

      RETURN;
    END IF;
  END IF;

  SELECT th.id
  INTO v_hold_conflict
  FROM public.table_hold_windows thw
  JOIN public.table_holds th ON th.id = thw.hold_id
  WHERE thw.table_id = ANY (v_table_ids)
    AND thw.expires_at > v_now
    AND (th.booking_id IS NULL OR th.booking_id <> p_booking_id)
    AND thw.hold_window && v_window
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION 'Hold conflict prevents assignment for booking %', p_booking_id
      USING ERRCODE = 'P0001',
            DETAIL = format('Hold % overlaps requested window', v_hold_conflict),
            HINT = 'Retry after hold expiration or confirm existing hold.';
  END IF;

  IF v_booking.booking_date IS NOT NULL AND v_booking.start_time IS NOT NULL THEN
    SELECT id
    INTO v_slot_id
    FROM public.booking_slots
    WHERE restaurant_id = v_restaurant_id
      AND slot_date = v_booking.booking_date
      AND slot_time = v_booking.start_time
    LIMIT 1;

    IF v_slot_id IS NULL THEN
      SELECT public.get_or_create_booking_slot(v_restaurant_id, v_booking.booking_date, v_booking.start_time, 999)
      INTO v_slot_id;
    END IF;
  END IF;

  IF v_merge_group_supported AND v_table_count > 1 THEN
    v_merge_allocation_id := gen_random_uuid();

    BEGIN
      INSERT INTO public.allocations (
        id,
        booking_id,
        restaurant_id,
        resource_type,
        resource_id,
        "window",
        created_by,
        shadow,
        created_at,
        updated_at
      ) VALUES (
        v_merge_allocation_id,
        p_booking_id,
        v_restaurant_id,
        'merge_group',
        v_merge_allocation_id,
        v_window,
        p_assigned_by,
        false,
        v_now,
        v_now
      )
      ON CONFLICT ON CONSTRAINT allocations_booking_resource_key DO UPDATE
      SET "window" = EXCLUDED."window",
          created_by = COALESCE(EXCLUDED.created_by, public.allocations.created_by),
          updated_at = v_now;
    EXCEPTION
      WHEN unique_violation OR exclusion_violation THEN
        RAISE EXCEPTION 'allocations_no_overlap'
          USING ERRCODE = 'P0001',
                DETAIL = format('Merge group overlaps requested window for booking %s', p_booking_id);
    END;
  END IF;

  FOREACH v_table_id IN ARRAY v_table_ids LOOP
    BEGIN
      INSERT INTO public.allocations (
        booking_id,
        restaurant_id,
        resource_type,
        resource_id,
        "window",
        created_by,
        shadow,
        created_at,
        updated_at
      ) VALUES (
        p_booking_id,
        v_restaurant_id,
        'table',
        v_table_id,
        v_window,
        p_assigned_by,
        false,
        v_now,
        v_now
      )
      ON CONFLICT ON CONSTRAINT allocations_booking_resource_key DO UPDATE
      SET "window" = EXCLUDED."window",
          created_by = COALESCE(EXCLUDED.created_by, public.allocations.created_by),
          shadow = false,
          updated_at = v_now
      RETURNING id INTO v_allocation_id;
    EXCEPTION
      WHEN unique_violation OR exclusion_violation THEN
        RAISE EXCEPTION 'allocations_no_overlap'
          USING ERRCODE = 'P0001',
                DETAIL = format('Resource %s overlaps requested window for booking %s', v_table_id, p_booking_id);
    END;

    BEGIN
      INSERT INTO public.booking_table_assignments (
        booking_id,
        table_id,
        slot_id,
        assigned_by,
        idempotency_key,
        merge_group_id,
        start_at,
        end_at,
        allocation_id
      ) VALUES (
        p_booking_id,
        v_table_id,
        v_slot_id,
        p_assigned_by,
        p_idempotency_key,
        v_merge_allocation_id,
        v_start_at,
        v_end_at,
        v_allocation_id
      )
      ON CONFLICT ON CONSTRAINT booking_table_assignments_booking_table_key DO UPDATE
      SET assigned_at = v_now,
          assigned_by = COALESCE(EXCLUDED.assigned_by, public.booking_table_assignments.assigned_by),
          idempotency_key = COALESCE(EXCLUDED.idempotency_key, public.booking_table_assignments.idempotency_key),
          merge_group_id = COALESCE(EXCLUDED.merge_group_id, public.booking_table_assignments.merge_group_id),
          slot_id = COALESCE(EXCLUDED.slot_id, public.booking_table_assignments.slot_id),
          start_at = EXCLUDED.start_at,
          end_at = EXCLUDED.end_at,
          allocation_id = EXCLUDED.allocation_id,
          updated_at = v_now
      RETURNING id INTO v_table_assignment_id;
    EXCEPTION
      WHEN unique_violation THEN
        UPDATE public.booking_table_assignments AS bta
        SET assigned_at = v_now,
            assigned_by = COALESCE(p_assigned_by, bta.assigned_by),
            idempotency_key = COALESCE(p_idempotency_key, bta.idempotency_key),
            merge_group_id = COALESCE(v_merge_allocation_id, bta.merge_group_id),
            slot_id = COALESCE(v_slot_id, bta.slot_id),
            start_at = v_start_at,
            end_at = v_end_at,
            allocation_id = COALESCE(v_allocation_id, bta.allocation_id),
            updated_at = v_now
        WHERE bta.booking_id = p_booking_id
          AND bta.table_id = v_table_id
        RETURNING bta.id INTO v_table_assignment_id;

        IF NOT FOUND THEN
          RAISE EXCEPTION 'assign_tables_atomic_v2 assignment duplicate for table %', v_table_id
            USING ERRCODE = 'P0001';
        END IF;
    END;

    PERFORM public.refresh_table_status(v_table_id);

    table_id := v_table_id;
    start_at := v_start_at;
    end_at := v_end_at;
    merge_group_id := CASE WHEN v_merge_group_supported THEN v_merge_allocation_id ELSE NULL END;
    RETURN NEXT;
  END LOOP;

  IF p_idempotency_key IS NOT NULL THEN
    INSERT INTO public.booking_assignment_idempotency (
      booking_id,
      idempotency_key,
      table_ids,
      assignment_window,
      merge_group_allocation_id,
      table_set_hash,
      created_at
    ) VALUES (
      p_booking_id,
      p_idempotency_key,
      v_table_ids,
      v_window,
      v_merge_allocation_id,
      v_table_set_hash,
      v_now
    )
    ON CONFLICT (booking_id, idempotency_key) DO UPDATE
      SET table_ids = EXCLUDED.table_ids,
          assignment_window = EXCLUDED.assignment_window,
          merge_group_allocation_id = EXCLUDED.merge_group_allocation_id,
          table_set_hash = EXCLUDED.table_set_hash;
  END IF;

  IF current_setting('app.capacity.post_assignment.enabled', true) = 'off' THEN
    v_capacity_check_enabled := false;
  END IF;

  IF v_capacity_check_enabled THEN
    PERFORM public.validate_booking_capacity_after_assignment(p_booking_id);
  END IF;
END;
$$;

ALTER FUNCTION public.assign_tables_atomic_v2(uuid, uuid[], text, boolean, uuid, timestamptz, timestamptz)
  OWNER TO postgres;

GRANT ALL ON FUNCTION public.assign_tables_atomic_v2(uuid, uuid[], text, boolean, uuid, timestamptz, timestamptz)
  TO service_role;
