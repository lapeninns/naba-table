


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE TYPE "public"."analytics_event_type" AS ENUM (
    'booking.created',
    'booking.cancelled',
    'booking.allocated',
    'booking.waitlisted'
);


ALTER TYPE "public"."analytics_event_type" OWNER TO "postgres";


CREATE TYPE "public"."booking_change_type" AS ENUM (
    'created',
    'updated',
    'cancelled',
    'deleted'
);


ALTER TYPE "public"."booking_change_type" OWNER TO "postgres";


CREATE TYPE "public"."booking_status" AS ENUM (
    'confirmed',
    'pending',
    'cancelled',
    'completed',
    'PRIORITY_WAITLIST',
    'no_show',
    'pending_allocation',
    'checked_in'
);


ALTER TYPE "public"."booking_status" OWNER TO "postgres";


COMMENT ON TYPE "public"."booking_status" IS 'Lifecycle status of a booking (pending, confirmed, checked_in, completed, cancelled, no_show, etc).';



CREATE TYPE "public"."capacity_override_type" AS ENUM (
    'holiday',
    'event',
    'manual',
    'emergency'
);


ALTER TYPE "public"."capacity_override_type" OWNER TO "postgres";


CREATE TYPE "public"."manual_assignment_session_state" AS ENUM (
    'none',
    'proposed',
    'held',
    'confirmed',
    'expired',
    'conflicted',
    'cancelled'
);


ALTER TYPE "public"."manual_assignment_session_state" OWNER TO "postgres";


CREATE TYPE "public"."seating_preference_type" AS ENUM (
    'any',
    'indoor',
    'outdoor',
    'bar',
    'window',
    'quiet',
    'booth'
);


ALTER TYPE "public"."seating_preference_type" OWNER TO "postgres";


CREATE TYPE "public"."table_category" AS ENUM (
    'bar',
    'dining',
    'lounge',
    'patio',
    'private'
);


ALTER TYPE "public"."table_category" OWNER TO "postgres";


CREATE TYPE "public"."table_hold_status" AS ENUM (
    'active',
    'expired',
    'confirmed',
    'cancelled'
);


ALTER TYPE "public"."table_hold_status" OWNER TO "postgres";


CREATE TYPE "public"."table_mobility" AS ENUM (
    'movable',
    'fixed'
);


ALTER TYPE "public"."table_mobility" OWNER TO "postgres";


CREATE TYPE "public"."table_seating_type" AS ENUM (
    'standard',
    'sofa',
    'booth',
    'high_top'
);


ALTER TYPE "public"."table_seating_type" OWNER TO "postgres";


CREATE TYPE "public"."table_status" AS ENUM (
    'available',
    'reserved',
    'occupied',
    'out_of_service'
);


ALTER TYPE "public"."table_status" OWNER TO "postgres";


COMMENT ON TYPE "public"."table_status" IS 'Status of a restaurant table: available, reserved (booked), occupied (guests seated), out_of_service (maintenance)';



CREATE OR REPLACE FUNCTION "public"."acquire_soft_holds_atomic"("p_table_ids" "uuid"[], "p_window" "tstzrange", "p_session_token" "uuid", "p_restaurant_id" "uuid", "p_booking_id" "uuid" DEFAULT NULL::"uuid", "p_ttl_seconds" integer DEFAULT 10) RETURNS TABLE("table_id" "uuid", "acquired" boolean, "blocking_session" "uuid", "blocking_expires_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_now timestamptz := timezone('utc', now());
  v_expires_at timestamptz;
  v_table_id uuid;
  v_sorted_table_ids uuid[];
  v_blocking RECORD;
  v_all_acquired boolean := true;
  v_acquired_ids uuid[] := ARRAY[]::uuid[];
BEGIN
  IF p_table_ids IS NULL OR array_length(p_table_ids, 1) = 0 THEN
    RAISE EXCEPTION 'acquire_soft_holds_atomic requires at least one table id'
      USING ERRCODE = '23514';
  END IF;

  IF p_window IS NULL THEN
    RAISE EXCEPTION 'acquire_soft_holds_atomic requires a valid window'
      USING ERRCODE = '23514';
  END IF;

  IF p_session_token IS NULL THEN
    RAISE EXCEPTION 'acquire_soft_holds_atomic requires a session token'
      USING ERRCODE = '23514';
  END IF;

  v_expires_at := v_now + (p_ttl_seconds || ' seconds')::interval;

  -- Sort IDs so concurrent acquisitions always lock in the same order (deadlock avoidance).
  SELECT array_agg(DISTINCT t.id ORDER BY t.id)
  INTO v_sorted_table_ids
  FROM unnest(p_table_ids) AS t(id);

  -- Best-effort cleanup for these tables.
  DELETE FROM public.table_soft_holds
  WHERE table_id = ANY(v_sorted_table_ids)
    AND expires_at <= v_now;

  FOREACH v_table_id IN ARRAY v_sorted_table_ids LOOP
    SELECT sh.session_token, sh.expires_at
    INTO v_blocking
    FROM public.table_soft_holds sh
    WHERE sh.table_id = v_table_id
      AND sh.expires_at > v_now
      AND sh.hold_window && p_window
      AND sh.session_token <> p_session_token
    LIMIT 1;

    IF FOUND THEN
      v_all_acquired := false;
      table_id := v_table_id;
      acquired := false;
      blocking_session := v_blocking.session_token;
      blocking_expires_at := v_blocking.expires_at;
      RETURN NEXT;
    ELSE
      -- If already held by this session, extend expiry; else insert.
      IF EXISTS (
        SELECT 1
        FROM public.table_soft_holds sh
        WHERE sh.table_id = v_table_id
          AND sh.session_token = p_session_token
          AND sh.expires_at > v_now
          AND sh.hold_window && p_window
      ) THEN
        UPDATE public.table_soft_holds
        SET expires_at = v_expires_at
        WHERE table_id = v_table_id
          AND session_token = p_session_token
          AND expires_at > v_now;
      ELSE
        BEGIN
          INSERT INTO public.table_soft_holds (
            table_id,
            hold_window,
            session_token,
            restaurant_id,
            booking_id,
            expires_at
          ) VALUES (
            v_table_id,
            p_window,
            p_session_token,
            p_restaurant_id,
            p_booking_id,
            v_expires_at
          );
        EXCEPTION
          WHEN exclusion_violation THEN
            SELECT sh.session_token, sh.expires_at
            INTO v_blocking
            FROM public.table_soft_holds sh
            WHERE sh.table_id = v_table_id
              AND sh.expires_at > v_now
              AND sh.hold_window && p_window
            LIMIT 1;

            v_all_acquired := false;
            table_id := v_table_id;
            acquired := false;
            blocking_session := COALESCE(v_blocking.session_token, NULL);
            blocking_expires_at := COALESCE(v_blocking.expires_at, NULL);
            RETURN NEXT;
            CONTINUE;
        END;
      END IF;

      v_acquired_ids := array_append(v_acquired_ids, v_table_id);
      table_id := v_table_id;
      acquired := true;
      blocking_session := NULL;
      blocking_expires_at := NULL;
      RETURN NEXT;
    END IF;
  END LOOP;

  -- Roll back partial acquisitions.
  IF NOT v_all_acquired AND array_length(v_acquired_ids, 1) > 0 THEN
    DELETE FROM public.table_soft_holds
    WHERE table_id = ANY(v_acquired_ids)
      AND session_token = p_session_token;
  END IF;
END;
$$;


ALTER FUNCTION "public"."acquire_soft_holds_atomic"("p_table_ids" "uuid"[], "p_window" "tstzrange", "p_session_token" "uuid", "p_restaurant_id" "uuid", "p_booking_id" "uuid", "p_ttl_seconds" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."acquire_zone_floorplan_lock_v1"("p_zone_id" "uuid", "p_restaurant_id" "uuid", "p_user_id" "uuid", "p_ttl_seconds" integer DEFAULT 600) RETURNS TABLE("acquired" boolean, "zone_id" "uuid", "restaurant_id" "uuid", "locked_by" "uuid", "locked_at" timestamp with time zone, "heartbeat_at" timestamp with time zone, "expires_at" timestamp with time zone)
    LANGUAGE "plpgsql"
    AS $$
declare
  now_ts timestamptz := now();
  ttl interval := make_interval(secs => greatest(30, least(coalesce(p_ttl_seconds, 600), 3600)));
  existing public.zone_floorplan_edit_locks%rowtype;
begin
  if p_zone_id is null or p_restaurant_id is null or p_user_id is null then
    raise exception 'Missing required inputs' using errcode = '22023';
  end if;

  -- Validate zone belongs to restaurant (defense-in-depth).
  if not exists (
    select 1
    from public.zones z
    where z.id = p_zone_id
      and z.restaurant_id = p_restaurant_id
  ) then
    raise exception 'Zone not found' using errcode = 'P0002';
  end if;

  select * into existing
  from public.zone_floorplan_edit_locks
  where zone_id = p_zone_id
  for update;

  if not found then
    insert into public.zone_floorplan_edit_locks(
      zone_id,
      restaurant_id,
      locked_by,
      locked_at,
      heartbeat_at,
      expires_at
    ) values (
      p_zone_id,
      p_restaurant_id,
      p_user_id,
      now_ts,
      now_ts,
      now_ts + ttl
    )
    returning true, zone_id, restaurant_id, locked_by, locked_at, heartbeat_at, expires_at
    into acquired, zone_id, restaurant_id, locked_by, locked_at, heartbeat_at, expires_at;

    return;
  end if;

  if existing.locked_by = p_user_id then
    update public.zone_floorplan_edit_locks
      set heartbeat_at = now_ts,
          expires_at = now_ts + ttl
      where zone_id = p_zone_id
      returning true, zone_id, restaurant_id, locked_by, locked_at, heartbeat_at, expires_at
      into acquired, zone_id, restaurant_id, locked_by, locked_at, heartbeat_at, expires_at;

    return;
  end if;

  if existing.expires_at <= now_ts then
    update public.zone_floorplan_edit_locks
      set locked_by = p_user_id,
          locked_at = now_ts,
          heartbeat_at = now_ts,
          expires_at = now_ts + ttl
      where zone_id = p_zone_id
      returning true, zone_id, restaurant_id, locked_by, locked_at, heartbeat_at, expires_at
      into acquired, zone_id, restaurant_id, locked_by, locked_at, heartbeat_at, expires_at;

    return;
  end if;

  acquired := false;
  zone_id := existing.zone_id;
  restaurant_id := existing.restaurant_id;
  locked_by := existing.locked_by;
  locked_at := existing.locked_at;
  heartbeat_at := existing.heartbeat_at;
  expires_at := existing.expires_at;
  return;
end;
$$;


ALTER FUNCTION "public"."acquire_zone_floorplan_lock_v1"("p_zone_id" "uuid", "p_restaurant_id" "uuid", "p_user_id" "uuid", "p_ttl_seconds" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."allocations_overlap"("a" "tstzrange", "b" "tstzrange") RETURNS boolean
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'public', 'extensions'
    AS $$
  SELECT COALESCE(a && b, false);
$$;


ALTER FUNCTION "public"."allocations_overlap"("a" "tstzrange", "b" "tstzrange") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."allocations_overlap"("a" "tstzrange", "b" "tstzrange") IS 'Returns true when two timestamptz ranges overlap (half-open [start,end) semantics).';



CREATE OR REPLACE FUNCTION "public"."allowed_capacities_set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'extensions'
    AS $$
BEGIN
  NEW.updated_at := timezone('utc', now());
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."allowed_capacities_set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."apply_booking_state_transition"("p_booking_id" "uuid", "p_status" "public"."booking_status", "p_checked_in_at" timestamp with time zone, "p_checked_out_at" timestamp with time zone, "p_updated_at" timestamp with time zone, "p_history_from" "public"."booking_status", "p_history_to" "public"."booking_status", "p_history_changed_by" "uuid", "p_history_changed_at" timestamp with time zone, "p_history_reason" "text", "p_history_metadata" "jsonb" DEFAULT '{}'::"jsonb") RETURNS TABLE("status" "public"."booking_status", "checked_in_at" timestamp with time zone, "checked_out_at" timestamp with time zone, "updated_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
  DECLARE
    v_updated public.bookings%ROWTYPE;
    v_current public.booking_status;
    v_rows integer;
  BEGIN
    UPDATE public.bookings
    SET status = p_status,
        checked_in_at = p_checked_in_at,
        checked_out_at = p_checked_out_at,
        updated_at = p_updated_at
    WHERE id = p_booking_id
      AND public.bookings.status = p_history_from
    RETURNING * INTO v_updated;

    GET DIAGNOSTICS v_rows = ROW_COUNT;

    IF v_rows = 0 THEN
      SELECT status INTO v_current FROM public.bookings WHERE id = p_booking_id;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Booking % not found', p_booking_id USING ERRCODE = 'P0002';
      END IF;
      RAISE EXCEPTION 'booking_state_conflict'
        USING ERRCODE = 'P0004',
              DETAIL = format('Current status %s does not match expected %s', v_current, p_history_from);
    END IF;

    INSERT INTO public.booking_state_history (
      booking_id, from_status, to_status, changed_by, changed_at, reason, metadata
    ) VALUES (
      p_booking_id, p_history_from, p_history_to, p_history_changed_by, p_history_changed_at, p_history_reason, COALESCE(p_history_metadata, '{}'::jsonb)
    );

    RETURN QUERY SELECT v_updated.status, v_updated.checked_in_at, v_updated.checked_out_at, v_updated.updated_at;
  END;
$$;


ALTER FUNCTION "public"."apply_booking_state_transition"("p_booking_id" "uuid", "p_status" "public"."booking_status", "p_checked_in_at" timestamp with time zone, "p_checked_out_at" timestamp with time zone, "p_updated_at" timestamp with time zone, "p_history_from" "public"."booking_status", "p_history_to" "public"."booking_status", "p_history_changed_by" "uuid", "p_history_changed_at" timestamp with time zone, "p_history_reason" "text", "p_history_metadata" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."apply_zone_floorplan_layout_v1"("p_zone_id" "uuid", "p_restaurant_id" "uuid", "p_user_id" "uuid", "p_payload" "jsonb", "p_note" "text" DEFAULT NULL::"text", "p_restored_from" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("version_id" "uuid", "version" integer, "pruned_edges" "jsonb")
    LANGUAGE "plpgsql"
    AS $$
declare
  now_ts timestamptz := now();
  lock_row public.zone_floorplan_edit_locks%rowtype;
  next_version integer;
  payload_positions jsonb;
  payload_edges jsonb;
  payload_overrides jsonb;
  edge_record jsonb;
  a uuid;
  b uuid;
  tmp uuid;
  ax integer;
  ay integer;
  bx integer;
  by_ integer;
  aw integer;
  ah integer;
  bw integer;
  bh integer;
  ra numeric;
  rb numeric;
  dist numeric;
  threshold numeric;
  extra numeric := 40;
  newest_ids uuid[];
begin
  if p_zone_id is null or p_restaurant_id is null or p_user_id is null or p_payload is null then
    raise exception 'Missing required inputs' using errcode = '22023';
  end if;

  -- Ensure zone belongs to restaurant.
  if not exists (
    select 1
    from public.zones z
    where z.id = p_zone_id
      and z.restaurant_id = p_restaurant_id
  ) then
    raise exception 'Zone not found' using errcode = 'P0002';
  end if;

  -- Validate active lock ownership.
  select * into lock_row
  from public.zone_floorplan_edit_locks
  where zone_id = p_zone_id;

  if not found then
    raise exception 'Edit lock required' using errcode = '42501';
  end if;

  if lock_row.locked_by <> p_user_id then
    raise exception 'Edit lock is owned by another user' using errcode = '42501';
  end if;

  if lock_row.expires_at <= now_ts then
    raise exception 'Edit lock expired' using errcode = '42501';
  end if;

  select coalesce(max(v.version), 0) + 1
    into next_version
  from public.zone_floorplan_layout_versions v
  where v.zone_id = p_zone_id;

  insert into public.zone_floorplan_layout_versions(
    restaurant_id,
    zone_id,
    version,
    schema_version,
    payload,
    note,
    created_at,
    created_by,
    restored_from
  ) values (
    p_restaurant_id,
    p_zone_id,
    next_version,
    1,
    p_payload,
    p_note,
    now_ts,
    p_user_id,
    p_restored_from
  )
  returning id into version_id;

  version := next_version;

  payload_positions := coalesce(p_payload->'tablePositions', '{}'::jsonb);
  payload_overrides := coalesce(p_payload->'tableOverrides', '{}'::jsonb);
  payload_edges := coalesce(p_payload#>'{adjacency,edges}', '[]'::jsonb);

  -- Apply table positions for tables in this zone/restaurant.
  -- position column is json-like in existing codebase.
  for a, edge_record in
    select (key)::uuid, value
    from jsonb_each(payload_positions)
  loop
    update public.table_inventory t
      set position = edge_record
    where t.id = a
      and t.restaurant_id = p_restaurant_id
      and t.zone_id = p_zone_id;
  end loop;

  -- Replace adjacency edges for this zone.
  -- 1) Delete existing edges where both endpoints are zone tables.
  delete from public.table_adjacencies ta
  using public.table_inventory a_tbl,
        public.table_inventory b_tbl
  where ta.table_a = a_tbl.id
    and ta.table_b = b_tbl.id
    and a_tbl.restaurant_id = p_restaurant_id
    and b_tbl.restaurant_id = p_restaurant_id
    and a_tbl.zone_id = p_zone_id
    and b_tbl.zone_id = p_zone_id;

  -- 2) Build kept_edges by canonicalizing, validating zone membership, and pruning by distance.
  create temporary table if not exists _fp_edges_kept(
    a uuid not null,
    b uuid not null,
    primary key (a, b)
  ) on commit drop;

  create temporary table if not exists _fp_edges_pruned(
    a uuid not null,
    b uuid not null,
    primary key (a, b)
  ) on commit drop;

  for edge_record in
    select value
    from jsonb_array_elements(payload_edges)
  loop
    if jsonb_typeof(edge_record) <> 'array' or jsonb_array_length(edge_record) <> 2 then
      continue;
    end if;

    a := (edge_record->>0)::uuid;
    b := (edge_record->>1)::uuid;

    if a is null or b is null or a = b then
      continue;
    end if;

    -- Canonicalize pair.
    if (a::text) > (b::text) then
      tmp := a;
      a := b;
      b := tmp;
    end if;

    -- Enforce zone membership.
    if not exists (
      select 1
      from public.table_inventory t
      where t.id = a
        and t.restaurant_id = p_restaurant_id
        and t.zone_id = p_zone_id
    ) then
      continue;
    end if;

    if not exists (
      select 1
      from public.table_inventory t
      where t.id = b
        and t.restaurant_id = p_restaurant_id
        and t.zone_id = p_zone_id
    ) then
      continue;
    end if;

    -- Distance pruning.
    ax := nullif((payload_positions->(a::text)->>'x')::int, null);
    ay := nullif((payload_positions->(a::text)->>'y')::int, null);
    bx := nullif((payload_positions->(b::text)->>'x')::int, null);
    by_ := nullif((payload_positions->(b::text)->>'y')::int, null);

    aw := nullif((payload_overrides->(a::text)->>'width')::int, null);
    ah := nullif((payload_overrides->(a::text)->>'height')::int, null);
    bw := nullif((payload_overrides->(b::text)->>'width')::int, null);
    bh := nullif((payload_overrides->(b::text)->>'height')::int, null);

    ra := case when aw is not null and ah is not null then sqrt(((aw::numeric)/2)^2 + ((ah::numeric)/2)^2) else 32 end;
    rb := case when bw is not null and bh is not null then sqrt(((bw::numeric)/2)^2 + ((bh::numeric)/2)^2) else 32 end;

    if ax is null or ay is null or bx is null or by_ is null then
      -- If positions are missing, keep edge (fail open).
      insert into _fp_edges_kept(a, b) values (a, b) on conflict do nothing;
      continue;
    end if;

    dist := sqrt(((ax - bx)::numeric)^2 + ((ay - by_)::numeric)^2);
    threshold := ra + rb + extra;

    if dist > threshold then
      insert into _fp_edges_pruned(a, b) values (a, b) on conflict do nothing;
    else
      insert into _fp_edges_kept(a, b) values (a, b) on conflict do nothing;
    end if;
  end loop;

  select coalesce(
    jsonb_agg(jsonb_build_array(a::text, b::text) order by a::text, b::text),
    '[]'::jsonb
  )
  into pruned_edges
  from _fp_edges_pruned;

  -- Insert edges both directions.
  insert into public.table_adjacencies(table_a, table_b)
  select a, b
  from _fp_edges_kept;

  insert into public.table_adjacencies(table_a, table_b)
  select b, a
  from _fp_edges_kept;

  -- Retention: keep last 20 versions.
  select array_agg(id)
    into newest_ids
  from (
    select id
    from public.zone_floorplan_layout_versions
    where zone_id = p_zone_id
    order by version desc
    limit 20
  ) newest;

  delete from public.zone_floorplan_layout_versions
  where zone_id = p_zone_id
    and (newest_ids is null or not (id = any(newest_ids)));

  return;
end;
$$;


ALTER FUNCTION "public"."apply_zone_floorplan_layout_v1"("p_zone_id" "uuid", "p_restaurant_id" "uuid", "p_user_id" "uuid", "p_payload" "jsonb", "p_note" "text", "p_restored_from" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."are_tables_connected"("table_ids" "uuid"[]) RETURNS boolean
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'extensions'
    AS $$
DECLARE
  unique_tables uuid[];
  start_table uuid;
  total_count integer;
  connected_count integer;
BEGIN
  SELECT array_agg(DISTINCT id)
  INTO unique_tables
  FROM unnest(table_ids) AS id
  WHERE id IS NOT NULL;

  total_count := array_length(unique_tables, 1);

  IF total_count IS NULL OR total_count = 0 THEN
    RETURN false;
  END IF;

  IF total_count = 1 THEN
    RETURN true;
  END IF;

  start_table := unique_tables[1];

  WITH RECURSIVE connected AS (
    SELECT start_table AS table_id
    UNION
    SELECT adj.table_b
    FROM connected
    JOIN public.table_adjacencies adj
      ON adj.table_a = connected.table_id
    WHERE adj.table_b = ANY(unique_tables)
  )
  SELECT COUNT(DISTINCT table_id)
  INTO connected_count
  FROM connected;

  RETURN connected_count = total_count;
END;
$$;


ALTER FUNCTION "public"."are_tables_connected"("table_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."assign_merged_tables"("p_booking_id" "uuid", "p_table_ids" "uuid"[], "p_require_adjacency" boolean DEFAULT true, "p_assigned_by" "uuid" DEFAULT NULL::"uuid", "p_idempotency_key" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_table_count integer;
BEGIN
  v_table_count := COALESCE(array_length(p_table_ids, 1), 0);

  IF v_table_count < 2 THEN
    RAISE EXCEPTION 'assign_merged_tables requires at least two table ids.';
  END IF;

  PERFORM public.assign_tables_atomic_v2(
    p_booking_id := p_booking_id,
    p_table_ids := p_table_ids,
    p_idempotency_key := p_idempotency_key,
    p_require_adjacency := p_require_adjacency,
    p_assigned_by := p_assigned_by
  );
END;
$$;


ALTER FUNCTION "public"."assign_merged_tables"("p_booking_id" "uuid", "p_table_ids" "uuid"[], "p_require_adjacency" boolean, "p_assigned_by" "uuid", "p_idempotency_key" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."assign_merged_tables"("p_booking_id" "uuid", "p_table_ids" "uuid"[], "p_require_adjacency" boolean, "p_assigned_by" "uuid", "p_idempotency_key" "text") IS 'Atomically assigns multiple tables to a booking with optional adjacency enforcement.';



CREATE OR REPLACE FUNCTION "public"."assign_single_table"("p_booking_id" "uuid", "p_table_id" "uuid", "p_assigned_by" "uuid" DEFAULT NULL::"uuid", "p_idempotency_key" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF p_table_id IS NULL THEN
    RAISE EXCEPTION 'assign_single_table requires a table id.';
  END IF;

  PERFORM public.assign_tables_atomic_v2(
    p_booking_id := p_booking_id,
    p_table_ids := ARRAY[p_table_id],
    p_idempotency_key := p_idempotency_key,
    p_require_adjacency := false,
    p_assigned_by := p_assigned_by
  );
END;
$$;


ALTER FUNCTION "public"."assign_single_table"("p_booking_id" "uuid", "p_table_id" "uuid", "p_assigned_by" "uuid", "p_idempotency_key" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."assign_single_table"("p_booking_id" "uuid", "p_table_id" "uuid", "p_assigned_by" "uuid", "p_idempotency_key" "text") IS 'Atomically assigns a single table to a booking; preferred entrypoint for standard seating.';



CREATE OR REPLACE FUNCTION "public"."assign_tables_atomic"("p_booking_id" "uuid", "p_table_ids" "uuid"[], "p_window" "tstzrange", "p_assigned_by" "uuid" DEFAULT NULL::"uuid", "p_idempotency_key" "text" DEFAULT NULL::"text") RETURNS TABLE("table_id" "uuid", "assignment_id" "uuid")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
    DECLARE
      v_booking RECORD;
      v_restaurant_id uuid;
      v_target_tables uuid[];
      v_target_table uuid;
      v_existing_tables uuid[];
      v_table RECORD;
      v_slot_id uuid := NULL;
      v_now timestamptz := now();
      v_window tstzrange := p_window;
      v_assignment_id uuid;
      v_lock_restaurant int4;
      v_lock_date int4;
    BEGIN
      IF p_table_ids IS NULL OR array_length(p_table_ids, 1) = 0 THEN
        RAISE EXCEPTION 'assign_tables_atomic requires at least one table id'
          USING ERRCODE = '23514';
      END IF;

      SELECT array_agg(DISTINCT table_id ORDER BY table_id)
      INTO v_target_tables
      FROM unnest(p_table_ids) AS t(table_id);

      IF v_target_tables IS NULL OR array_length(v_target_tables, 1) = 0 THEN
        RAISE EXCEPTION 'assign_tables_atomic requires at least one valid table id'
          USING ERRCODE = '23514';
      END IF;

      IF array_length(v_target_tables, 1) > 1 THEN
        RAISE EXCEPTION 'assign_tables_atomic only supports a single table after merge removal'
          USING ERRCODE = '23514';
      END IF;

      v_target_table := v_target_tables[1];

      SELECT *
      INTO v_booking
      FROM public.bookings
      WHERE id = p_booking_id
      FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Booking % not found', p_booking_id
          USING ERRCODE = 'P0002';
      END IF;

      v_restaurant_id := v_booking.restaurant_id;

      v_lock_restaurant := hashtext(v_restaurant_id::text);
      v_lock_date := COALESCE((v_booking.booking_date - DATE '2000-01-01')::int, 0);
      PERFORM pg_advisory_xact_lock(v_lock_restaurant, v_lock_date);

      IF v_window IS NULL THEN
        v_window := tstzrange(v_booking.start_at, v_booking.end_at, '[)');
      END IF;

      IF v_window IS NULL OR lower(v_window) IS NULL OR upper(v_window) IS NULL OR lower(v_window) >= upper(v_window) THEN
        RAISE EXCEPTION 'Invalid assignment window for booking %', p_booking_id
          USING ERRCODE = '22000';
      END IF;

      IF p_idempotency_key IS NOT NULL THEN
        SELECT array_agg(bta.table_id ORDER BY bta.table_id)
        INTO v_existing_tables
        FROM public.booking_table_assignments bta
        WHERE bta.booking_id = p_booking_id
          AND bta.idempotency_key = p_idempotency_key;

        IF v_existing_tables IS NOT NULL THEN
          IF v_existing_tables <> v_target_tables THEN
            RAISE EXCEPTION 'assign_tables_atomic idempotency key mismatch'
              USING ERRCODE = 'P0003',
                    DETAIL = 'Idempotency key reuse detected with a different table id';
          END IF;

          RETURN QUERY
            SELECT
              bta.table_id,
              bta.id AS assignment_id
            FROM public.booking_table_assignments bta
            WHERE bta.booking_id = p_booking_id
              AND bta.idempotency_key = p_idempotency_key;

          RETURN;
        END IF;
      END IF;

      SELECT id, restaurant_id
      INTO v_table
      FROM public.table_inventory
      WHERE id = v_target_table
      FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Table % not found', v_target_table
          USING ERRCODE = 'P0002';
      END IF;

      IF v_table.restaurant_id <> v_restaurant_id THEN
        RAISE EXCEPTION 'Table % belongs to a different restaurant', v_target_table
          USING ERRCODE = '23503';
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

      INSERT INTO public.booking_table_assignments (
        booking_id,
        table_id,
        slot_id,
        assigned_by,
        idempotency_key
      ) VALUES (
        p_booking_id,
        v_target_table,
        v_slot_id,
        p_assigned_by,
        p_idempotency_key
      )
      ON CONFLICT (booking_id, table_id) DO UPDATE
      SET assigned_by = EXCLUDED.assigned_by,
          assigned_at = v_now,
          idempotency_key = COALESCE(EXCLUDED.idempotency_key, public.booking_table_assignments.idempotency_key)
      RETURNING id INTO v_assignment_id;

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
          v_target_table,
          v_window,
          p_assigned_by,
          false,
          v_now,
          v_now
        )
        ON CONFLICT ON CONSTRAINT allocations_booking_resource_key DO UPDATE
        SET "window" = EXCLUDED."window",
            created_by = EXCLUDED.created_by,
            updated_at = v_now;
      EXCEPTION
        WHEN unique_violation OR exclusion_violation THEN
          RAISE EXCEPTION 'allocations_no_overlap'
            USING ERRCODE = 'P0001',
                  DETAIL = format('Resource %s overlaps requested window for booking %s', v_target_table, p_booking_id);
      END;

      UPDATE public.table_inventory
      SET status = 'reserved'::public.table_status
      WHERE id = v_target_table;

      table_id := v_target_table;
      assignment_id := v_assignment_id;
      RETURN NEXT;
    END;
    $$;


ALTER FUNCTION "public"."assign_tables_atomic"("p_booking_id" "uuid", "p_table_ids" "uuid"[], "p_window" "tstzrange", "p_assigned_by" "uuid", "p_idempotency_key" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."assign_tables_atomic"("p_booking_id" "uuid", "p_table_ids" "uuid"[], "p_window" "tstzrange", "p_assigned_by" "uuid", "p_idempotency_key" "text") IS 'DEPRECATED: prefer assign_single_table() or assign_merged_tables().';



CREATE OR REPLACE FUNCTION "public"."assign_tables_atomic_v2"("p_booking_id" "uuid", "p_table_ids" "uuid"[], "p_idempotency_key" "text" DEFAULT NULL::"text", "p_require_adjacency" boolean DEFAULT false, "p_assigned_by" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("table_id" "uuid", "start_at" timestamp with time zone, "end_at" timestamp with time zone, "merge_group_id" "uuid")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  DECLARE
    v_booking RECORD;
    v_zone_id uuid;
    v_restaurant_id uuid;
    v_service_date date;
    v_lock_zone int4;
    v_lock_date int4;
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
    v_hold_conflict uuid;
    v_merge_allocation_id uuid := NULL;
    v_table_assignment_id uuid;
    v_existing RECORD;
    v_adjacency_count integer;
    v_table_id uuid;
    v_merge_group_supported boolean := false;
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

    SELECT
      b.*,
      r.timezone AS restaurant_timezone
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
    )
    INTO v_merge_group_supported;

    IF v_booking.start_at IS NOT NULL AND v_booking.end_at IS NOT NULL THEN
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

    IF p_require_adjacency AND v_table_count > 1 THEN
      FOR v_table IN
        SELECT id FROM unnest(v_table_ids) AS t(id)
      LOOP
        SELECT COUNT(*)
        INTO v_adjacency_count
        FROM public.table_adjacencies
        WHERE table_a = v_table.id
          AND table_b = ANY (v_table_ids)
          AND table_b <> v_table.id;

        IF COALESCE(v_adjacency_count, 0) = 0 THEN
          RAISE EXCEPTION 'Table % is not adjacent to the selected set', v_table.id
            USING ERRCODE = '23514';
        END IF;
      END LOOP;
    END IF;

    v_service_date := v_booking.booking_date;
    IF v_service_date IS NULL THEN
      v_service_date := (v_start_at AT TIME ZONE v_timezone)::date;
    END IF;

    v_lock_zone := hashtext(COALESCE(v_zone_id::text, ''));
    v_lock_date := COALESCE((v_service_date - DATE '2000-01-01')::int, 0);
    PERFORM pg_advisory_xact_lock(v_lock_zone, v_lock_date);

    IF p_idempotency_key IS NOT NULL THEN
      SELECT *
      INTO v_existing
      FROM public.booking_assignment_idempotency
      WHERE booking_id = p_booking_id
        AND idempotency_key = p_idempotency_key;

      IF FOUND THEN
        IF v_existing.table_ids IS NULL OR array_length(v_existing.table_ids, 1) <> v_table_count
           OR (SELECT array_agg(elem ORDER BY elem) FROM unnest(v_existing.table_ids) AS e(elem))
              <> (SELECT array_agg(elem ORDER BY elem) FROM unnest(v_table_ids) AS e(elem)) THEN
          RAISE EXCEPTION 'assign_tables_atomic_v2 idempotency mismatch for booking %', p_booking_id
            USING ERRCODE = 'P0003',
                  DETAIL = 'Idempotency key reuse detected with a different table set';
        END IF;

        RETURN QUERY
          SELECT
            bta.table_id,
            lower(v_existing.assignment_window) AS start_at,
            upper(v_existing.assignment_window) AS end_at,
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
    FROM public.table_holds th
    JOIN public.table_hold_members thm ON thm.hold_id = th.id
    WHERE thm.table_id = ANY (v_table_ids)
      AND th.expires_at > v_now
      AND (th.booking_id IS NULL OR th.booking_id <> p_booking_id)
      AND tstzrange(th.start_at, th.end_at, '[)') && v_window
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
      IF v_merge_group_supported THEN
        BEGIN
          INSERT INTO public.booking_table_assignments (
            booking_id,
            table_id,
            slot_id,
            assigned_by,
            idempotency_key,
            merge_group_id
          ) VALUES (
            p_booking_id,
            v_table_id,
            v_slot_id,
            p_assigned_by,
            p_idempotency_key,
            v_merge_allocation_id
          )
          ON CONFLICT ON CONSTRAINT booking_table_assignments_booking_table_key DO UPDATE
          SET assigned_at = v_now,
              assigned_by = COALESCE(EXCLUDED.assigned_by, public.booking_table_assignments.assigned_by),
              idempotency_key = COALESCE(EXCLUDED.idempotency_key, public.booking_table_assignments.idempotency_key),
              merge_group_id = COALESCE(EXCLUDED.merge_group_id, public.booking_table_assignments.merge_group_id),
              slot_id = COALESCE(EXCLUDED.slot_id, public.booking_table_assignments.slot_id)
          RETURNING id INTO v_table_assignment_id;
        EXCEPTION
          WHEN unique_violation THEN
            RAISE EXCEPTION 'assign_tables_atomic_v2 assignment duplicate for table %', v_table_id
              USING ERRCODE = 'P0001';
        END;
      ELSE
        BEGIN
          INSERT INTO public.booking_table_assignments (
            booking_id,
            table_id,
            slot_id,
            assigned_by,
            idempotency_key
          ) VALUES (
            p_booking_id,
            v_table_id,
            v_slot_id,
            p_assigned_by,
            p_idempotency_key
          )
          ON CONFLICT ON CONSTRAINT booking_table_assignments_booking_table_key DO UPDATE
          SET assigned_at = v_now,
              assigned_by = COALESCE(EXCLUDED.assigned_by, public.booking_table_assignments.assigned_by),
              idempotency_key = COALESCE(EXCLUDED.idempotency_key, public.booking_table_assignments.idempotency_key),
              slot_id = COALESCE(EXCLUDED.slot_id, public.booking_table_assignments.slot_id)
          RETURNING id INTO v_table_assignment_id;
        EXCEPTION
          WHEN unique_violation THEN
            RAISE EXCEPTION 'assign_tables_atomic_v2 assignment duplicate for table %', v_table_id
              USING ERRCODE = 'P0001';
        END;
      END IF;

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
            updated_at = v_now;
      EXCEPTION
        WHEN unique_violation OR exclusion_violation THEN
          RAISE EXCEPTION 'allocations_no_overlap'
            USING ERRCODE = 'P0001',
                  DETAIL = format('Resource %s overlaps requested window for booking %s', v_table_id, p_booking_id);
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
        created_at
      ) VALUES (
        p_booking_id,
        p_idempotency_key,
        v_table_ids,
        v_window,
        v_merge_allocation_id,
        v_now
      )
      ON CONFLICT (booking_id, idempotency_key) DO NOTHING;
    END IF;
  END;
  $$;


ALTER FUNCTION "public"."assign_tables_atomic_v2"("p_booking_id" "uuid", "p_table_ids" "uuid"[], "p_idempotency_key" "text", "p_require_adjacency" boolean, "p_assigned_by" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."assign_tables_atomic_v2"("p_booking_id" "uuid", "p_table_ids" "uuid"[], "p_idempotency_key" "text", "p_require_adjacency" boolean, "p_assigned_by" "uuid") IS 'DEPRECATED: prefer assign_single_table() or assign_merged_tables().';



CREATE OR REPLACE FUNCTION "public"."assign_tables_atomic_v2"("p_booking_id" "uuid", "p_table_ids" "uuid"[], "p_idempotency_key" "text" DEFAULT NULL::"text", "p_require_adjacency" boolean DEFAULT false, "p_assigned_by" "uuid" DEFAULT NULL::"uuid", "p_start_at" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_end_at" timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS TABLE("table_id" "uuid", "start_at" timestamp with time zone, "end_at" timestamp with time zone, "merge_group_id" "uuid")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."assign_tables_atomic_v2"("p_booking_id" "uuid", "p_table_ids" "uuid"[], "p_idempotency_key" "text", "p_require_adjacency" boolean, "p_assigned_by" "uuid", "p_start_at" timestamp with time zone, "p_end_at" timestamp with time zone) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."assign_tables_atomic_v2"("p_booking_id" "uuid", "p_table_ids" "uuid"[], "p_idempotency_key" "text", "p_require_adjacency" boolean, "p_assigned_by" "uuid", "p_start_at" timestamp with time zone, "p_end_at" timestamp with time zone) IS 'DEPRECATED: prefer assign_single_table() or assign_merged_tables().';



CREATE OR REPLACE FUNCTION "public"."booking_status_summary"("p_restaurant_id" "uuid", "p_start_date" "date" DEFAULT NULL::"date", "p_end_date" "date" DEFAULT NULL::"date", "p_status_filter" "public"."booking_status"[] DEFAULT NULL::"public"."booking_status"[]) RETURNS TABLE("status" "public"."booking_status", "total" bigint)
    LANGUAGE "sql"
    SET "search_path" TO 'public', 'extensions'
    AS $$
    SELECT
        b.status,
        COUNT(*)::bigint AS total
    FROM public.bookings b
    WHERE b.restaurant_id = p_restaurant_id
      AND (p_start_date IS NULL OR b.booking_date >= p_start_date)
      AND (p_end_date IS NULL OR b.booking_date <= p_end_date)
      AND (p_status_filter IS NULL OR b.status = ANY(p_status_filter))
    GROUP BY b.status
    ORDER BY b.status;
$$;


ALTER FUNCTION "public"."booking_status_summary"("p_restaurant_id" "uuid", "p_start_date" "date", "p_end_date" "date", "p_status_filter" "public"."booking_status"[]) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."booking_status_summary"("p_restaurant_id" "uuid", "p_start_date" "date", "p_end_date" "date", "p_status_filter" "public"."booking_status"[]) IS 'Returns aggregated booking counts by status for a restaurant across an optional date range and status filter.';



CREATE OR REPLACE FUNCTION "public"."check_soft_hold_ownership"("p_session_token" "uuid", "p_table_ids" "uuid"[], "p_window" "tstzrange") RETURNS TABLE("table_id" "uuid", "owned" boolean, "expires_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_now timestamptz := timezone('utc', now());
  v_table_id uuid;
  v_hold RECORD;
BEGIN
  FOREACH v_table_id IN ARRAY p_table_ids LOOP
    SELECT sh.expires_at
    INTO v_hold
    FROM public.table_soft_holds sh
    WHERE sh.table_id = v_table_id
      AND sh.session_token = p_session_token
      AND sh.expires_at > v_now
      AND sh.hold_window && p_window
    LIMIT 1;

    table_id := v_table_id;
    IF FOUND THEN
      owned := true;
      expires_at := v_hold.expires_at;
    ELSE
      owned := false;
      expires_at := NULL;
    END IF;
    RETURN NEXT;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."check_soft_hold_ownership"("p_session_token" "uuid", "p_table_ids" "uuid"[], "p_window" "tstzrange") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_expired_soft_holds"("p_batch_size" integer DEFAULT 1000) RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_count integer;
BEGIN
  DELETE FROM public.table_soft_holds
  WHERE id IN (
    SELECT id
    FROM public.table_soft_holds
    WHERE expires_at <= timezone('utc', now())
    LIMIT p_batch_size
  );

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;


ALTER FUNCTION "public"."cleanup_expired_soft_holds"("p_batch_size" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."confirm_hold_assignment_tx"("p_hold_id" "uuid", "p_booking_id" "uuid", "p_idempotency_key" "text", "p_require_adjacency" boolean DEFAULT false, "p_assigned_by" "uuid" DEFAULT NULL::"uuid", "p_window_start" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_window_end" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_expected_policy_version" "text" DEFAULT NULL::"text", "p_expected_adjacency_hash" "text" DEFAULT NULL::"text", "p_target_status" "public"."booking_status" DEFAULT NULL::"public"."booking_status", "p_history_reason" "text" DEFAULT 'auto_assign_confirm'::"text", "p_history_metadata" "jsonb" DEFAULT '{}'::"jsonb", "p_history_changed_by" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("assignment_id" "uuid", "table_id" "uuid", "start_at" timestamp with time zone, "end_at" timestamp with time zone, "merge_group_id" "uuid")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
DECLARE
  v_hold public.table_holds%ROWTYPE;
  v_now timestamptz := timezone('utc', now());
  v_table_ids uuid[];
  v_zone_id uuid;
  v_policy_version text;
  v_snapshot_hash text;
  v_start_at timestamptz;
  v_end_at timestamptz;
  v_window tstzrange;
  v_rows integer;
  v_booking_status public.booking_status;
  v_payload_checksum text;
  v_dedupe_key text;
  v_table_list text;
  v_hold_payload jsonb;
BEGIN
  IF p_window_start IS NULL AND p_window_end IS NOT NULL THEN
    RAISE EXCEPTION 'confirm_hold_assignment_tx requires both start and end when providing custom window'
      USING ERRCODE = '22023';
  END IF;
  IF p_window_start IS NOT NULL AND p_window_end IS NULL THEN
    RAISE EXCEPTION 'confirm_hold_assignment_tx requires both start and end when providing custom window'
      USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_hold
  FROM public.table_holds
  WHERE id = p_hold_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Hold % not found', p_hold_id
      USING ERRCODE = 'P0002';
  END IF;

  IF v_hold.booking_id IS NOT NULL AND v_hold.booking_id <> p_booking_id THEN
    RAISE EXCEPTION 'Hold % belongs to booking % (expected %)', p_hold_id, v_hold.booking_id, p_booking_id
      USING ERRCODE = 'P0001';
  END IF;

  IF v_hold.expires_at <= v_now THEN
    RAISE EXCEPTION 'Hold % expired at %', p_hold_id, v_hold.expires_at
      USING ERRCODE = 'P0001';
  END IF;

  SELECT array_agg(thm.table_id ORDER BY thm.table_id)
  INTO v_table_ids
  FROM public.table_hold_members thm
  WHERE thm.hold_id = p_hold_id;

  IF v_table_ids IS NULL OR array_length(v_table_ids, 1) = 0 THEN
    RAISE EXCEPTION 'Hold % has no table members', p_hold_id
      USING ERRCODE = 'P0001';
  END IF;

  v_zone_id := v_hold.zone_id;
  v_policy_version := COALESCE((v_hold.metadata ->> 'policyVersion'), NULL);
  v_snapshot_hash := v_hold.metadata -> 'selection' -> 'snapshot' -> 'adjacency' ->> 'hash';

  IF p_expected_policy_version IS NOT NULL AND v_policy_version IS NOT NULL AND v_policy_version <> p_expected_policy_version THEN
    RAISE EXCEPTION 'Policy version changed (hold %, expected %, actual %)', p_hold_id, p_expected_policy_version, v_policy_version
      USING ERRCODE = 'P0003';
  END IF;

  IF p_expected_adjacency_hash IS NOT NULL AND v_snapshot_hash IS NOT NULL AND v_snapshot_hash <> p_expected_adjacency_hash THEN
    RAISE EXCEPTION 'Adjacency snapshot changed for hold %', p_hold_id
      USING ERRCODE = 'P0003';
  END IF;

  v_start_at := COALESCE(p_window_start, v_hold.start_at);
  v_end_at := COALESCE(p_window_end, v_hold.end_at);

  IF v_start_at IS NULL OR v_end_at IS NULL THEN
    RAISE EXCEPTION 'Hold % missing scheduling window', p_hold_id
      USING ERRCODE = '22000';
  END IF;

  IF v_start_at >= v_end_at THEN
    RAISE EXCEPTION 'Hold % has invalid window', p_hold_id
      USING ERRCODE = '22000';
  END IF;

  v_window := tstzrange(v_start_at, v_end_at, '[)');

  DROP TABLE IF EXISTS tmp_confirm_assignments_tx;
  CREATE TEMP TABLE tmp_confirm_assignments_tx ON COMMIT DROP AS
    SELECT *
    FROM public.assign_tables_atomic_v2(
      p_booking_id,
      v_table_ids,
      p_idempotency_key,
      p_require_adjacency,
      p_assigned_by,
      v_start_at,
      v_end_at
    );

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    RAISE EXCEPTION 'assign_tables_atomic_v2 returned no assignments for booking %', p_booking_id
      USING ERRCODE = 'P0003';
  END IF;

  IF p_target_status IS NOT NULL THEN
    SELECT status INTO v_booking_status
    FROM public.bookings
    WHERE id = p_booking_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Booking % not found during transition', p_booking_id
        USING ERRCODE = 'P0002';
    END IF;

    IF v_booking_status <> p_target_status THEN
      PERFORM public.apply_booking_state_transition(
        p_booking_id,
        p_target_status,
        NULL,
        NULL,
        v_now,
        v_booking_status,
        p_target_status,
        p_history_changed_by,
        v_now,
        COALESCE(p_history_reason, 'auto_assign_confirm'),
        COALESCE(p_history_metadata, '{}'::jsonb)
      );
    END IF;
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    v_payload_checksum := encode(
      digest(
        jsonb_build_object(
          'bookingId', p_booking_id,
          'tableIds', v_table_ids,
          'startAt', v_start_at,
          'endAt', v_end_at,
          'actorId', p_assigned_by,
          'holdId', p_hold_id
        )::text,
        'sha256'
      ),
      'hex'
    );

    UPDATE public.booking_assignment_idempotency
      SET payload_checksum = v_payload_checksum
    WHERE booking_id = p_booking_id
      AND idempotency_key = p_idempotency_key;
  END IF;

  v_table_list := array_to_string(v_table_ids, ',');
  v_dedupe_key := format('%s:%s:%s:%s', p_booking_id, to_char(v_start_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'), to_char(v_end_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'), v_table_list);

  BEGIN
    INSERT INTO public.capacity_outbox (
      event_type,
      dedupe_key,
      restaurant_id,
      booking_id,
      idempotency_key,
      payload
    ) VALUES (
      'capacity.assignment.sync',
      v_dedupe_key,
      v_hold.restaurant_id,
      p_booking_id,
      p_idempotency_key,
      jsonb_build_object(
        'bookingId', p_booking_id,
        'restaurantId', v_hold.restaurant_id,
        'tableIds', v_table_ids,
        'startAt', to_char(v_start_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
        'endAt', to_char(v_end_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
        'mergeGroupId', (SELECT tmp.merge_group_id FROM tmp_confirm_assignments_tx tmp LIMIT 1),
        'idempotencyKey', p_idempotency_key
      )
    )
    ON CONFLICT DO NOTHING;
  EXCEPTION
    WHEN undefined_table THEN NULL;
  END;

  BEGIN
    v_hold_payload := jsonb_build_object(
      'holdId', p_hold_id,
      'bookingId', p_booking_id,
      'restaurantId', v_hold.restaurant_id,
      'zoneId', v_zone_id,
      'tableIds', v_table_ids,
      'startAt', to_char(v_start_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      'endAt', to_char(v_end_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      'expiresAt', to_char(v_hold.expires_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      'actorId', p_assigned_by,
      'metadata', v_hold.metadata
    );

    INSERT INTO public.capacity_outbox (
      event_type,
      dedupe_key,
      restaurant_id,
      booking_id,
      idempotency_key,
      payload
    ) VALUES (
      'capacity.hold.confirmed',
      format('%s:%s:hold.confirmed', p_booking_id, p_hold_id),
      v_hold.restaurant_id,
      p_booking_id,
      p_idempotency_key,
      v_hold_payload
    )
    ON CONFLICT DO NOTHING;
  EXCEPTION
    WHEN undefined_table THEN NULL;
  END;

  IF p_idempotency_key IS NOT NULL THEN
    BEGIN
      INSERT INTO public.booking_confirmation_results (
        booking_id,
        hold_id,
        restaurant_id,
        idempotency_key,
        table_ids,
        assignment_window,
        actor_id,
        metadata
      ) VALUES (
        p_booking_id,
        p_hold_id,
        v_hold.restaurant_id,
        p_idempotency_key,
        v_table_ids,
        v_window,
        p_assigned_by,
        v_hold.metadata
      )
      ON CONFLICT (booking_id, idempotency_key) DO UPDATE
        SET table_ids = EXCLUDED.table_ids,
            assignment_window = EXCLUDED.assignment_window,
            restaurant_id = EXCLUDED.restaurant_id,
            hold_id = EXCLUDED.hold_id,
            actor_id = EXCLUDED.actor_id,
            metadata = EXCLUDED.metadata,
            created_at = EXCLUDED.created_at;
    EXCEPTION
      WHEN undefined_table THEN NULL;
      WHEN undefined_column THEN NULL;
    END;
  END IF;

  DELETE FROM public.table_holds WHERE id = p_hold_id;

  RETURN QUERY
    SELECT bta.id,
           tmp.table_id,
           tmp.start_at,
           tmp.end_at,
           tmp.merge_group_id
    FROM tmp_confirm_assignments_tx tmp
    JOIN public.booking_table_assignments bta
      ON bta.booking_id = p_booking_id
     AND bta.table_id = tmp.table_id;
END;
$$;


ALTER FUNCTION "public"."confirm_hold_assignment_tx"("p_hold_id" "uuid", "p_booking_id" "uuid", "p_idempotency_key" "text", "p_require_adjacency" boolean, "p_assigned_by" "uuid", "p_window_start" timestamp with time zone, "p_window_end" timestamp with time zone, "p_expected_policy_version" "text", "p_expected_adjacency_hash" "text", "p_target_status" "public"."booking_status", "p_history_reason" "text", "p_history_metadata" "jsonb", "p_history_changed_by" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."confirm_hold_assignment_with_transition"("p_booking_id" "uuid", "p_table_ids" "uuid"[], "p_idempotency_key" "text", "p_require_adjacency" boolean DEFAULT false, "p_assigned_by" "uuid" DEFAULT NULL::"uuid", "p_start_at" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_end_at" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_target_status" "public"."booking_status" DEFAULT 'confirmed'::"public"."booking_status", "p_history_changed_by" "uuid" DEFAULT NULL::"uuid", "p_history_reason" "text" DEFAULT 'auto_assign_atomic_confirm'::"text", "p_history_metadata" "jsonb" DEFAULT '{}'::"jsonb") RETURNS TABLE("table_id" "uuid", "start_at" timestamp with time zone, "end_at" timestamp with time zone, "merge_group_id" "uuid")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
DECLARE
  v_history_from public.booking_status;
  v_now timestamptz := timezone('utc', now());
  v_transition_needed boolean := true;
BEGIN
  SELECT status INTO v_history_from
  FROM public.bookings
  WHERE id = p_booking_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking % not found', p_booking_id
      USING ERRCODE = 'P0002';
  END IF;

  DROP TABLE IF EXISTS tmp_confirm_assignments;
  CREATE TEMP TABLE tmp_confirm_assignments ON COMMIT DROP AS
    SELECT ata.table_id, ata.start_at, ata.end_at, ata.merge_group_id
    FROM public.assign_tables_atomic_v2(
      p_booking_id,
      p_table_ids,
      p_idempotency_key,
      p_require_adjacency,
      p_assigned_by,
      p_start_at,
      p_end_at
    ) AS ata;

  IF NOT EXISTS (SELECT 1 FROM tmp_confirm_assignments) THEN
    RAISE EXCEPTION 'assign_tables_atomic_v2 returned no assignments for booking %', p_booking_id
      USING ERRCODE = 'P0003';
  END IF;

  IF v_history_from = p_target_status THEN
    v_transition_needed := false;
  END IF;

  IF v_transition_needed THEN
    PERFORM public.apply_booking_state_transition(
      p_booking_id,
      p_target_status,
      NULL,
      NULL,
      v_now,
      v_history_from,
      p_target_status,
      p_history_changed_by,
      v_now,
      COALESCE(p_history_reason, 'auto_assign_atomic_confirm'),
      COALESCE(p_history_metadata, '{}'::jsonb)
    );
  END IF;

  RETURN QUERY
    SELECT t.table_id, t.start_at, t.end_at, t.merge_group_id
    FROM tmp_confirm_assignments AS t;
END;
$$;


ALTER FUNCTION "public"."confirm_hold_assignment_with_transition"("p_booking_id" "uuid", "p_table_ids" "uuid"[], "p_idempotency_key" "text", "p_require_adjacency" boolean, "p_assigned_by" "uuid", "p_start_at" timestamp with time zone, "p_end_at" timestamp with time zone, "p_target_status" "public"."booking_status", "p_history_changed_by" "uuid", "p_history_reason" "text", "p_history_metadata" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_booking_with_capacity_check"("p_restaurant_id" "uuid", "p_customer_id" "uuid", "p_booking_date" "date", "p_start_time" time without time zone, "p_end_time" time without time zone, "p_party_size" integer, "p_booking_type" "text", "p_customer_name" "text", "p_customer_email" "text", "p_customer_phone" "text", "p_seating_preference" "text", "p_notes" "text" DEFAULT NULL::"text", "p_marketing_opt_in" boolean DEFAULT false, "p_idempotency_key" "text" DEFAULT NULL::"text", "p_source" "text" DEFAULT 'api'::"text", "p_auth_user_id" "uuid" DEFAULT NULL::"uuid", "p_client_request_id" "text" DEFAULT NULL::"text", "p_details" "jsonb" DEFAULT '{}'::"jsonb", "p_loyalty_points_awarded" integer DEFAULT 0) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
DECLARE
    v_service_period_id uuid;
    v_service_period_name text;
    v_max_covers integer;
    v_max_parties integer;
    v_booked_covers integer;
    v_booked_parties integer;
    v_booking_id uuid;
    v_booking_record jsonb;
    v_reference text;
    v_start_at timestamptz;
    v_end_at timestamptz;
    v_timezone text;
    v_timezone_raw text;
    v_allow_after_hours boolean;
    v_local_start timestamp without time zone;
    v_local_end timestamp without time zone;
    v_local_day smallint;
    v_is_open boolean;
    v_has_closure boolean;
    v_capacity_rules_exist boolean;
BEGIN
    -- =====================================================
    -- STEP 1: Idempotency Check
    -- =====================================================
    IF p_idempotency_key IS NOT NULL THEN
        SELECT id INTO v_booking_id
        FROM bookings
        WHERE restaurant_id = p_restaurant_id
          AND idempotency_key = p_idempotency_key
        LIMIT 1;

        IF FOUND THEN
            SELECT to_jsonb(b.*) INTO v_booking_record
            FROM bookings b
            WHERE id = v_booking_id;

            RETURN jsonb_build_object(
                'success', true,
                'duplicate', true,
                'booking', v_booking_record,
                'message', 'Booking already exists (idempotency)'
            );
        END IF;
    END IF;

    -- =====================================================
    -- STEP 2: Find Applicable Service Period
    -- =====================================================
    SELECT sp.id, sp.name INTO v_service_period_id, v_service_period_name
    FROM restaurant_service_periods sp
    WHERE sp.restaurant_id = p_restaurant_id
      AND (sp.day_of_week IS NULL OR sp.day_of_week = EXTRACT(DOW FROM p_booking_date)::smallint)
      AND p_start_time >= sp.start_time
      AND p_start_time < sp.end_time
    ORDER BY
      sp.day_of_week DESC NULLS LAST,
      sp.start_time ASC
    LIMIT 1;

    -- =====================================================
    -- STEP 3: Timezone & Operating Hours Validation
    -- =====================================================
    SELECT timezone INTO v_timezone_raw
    FROM restaurants
    WHERE id = p_restaurant_id;

    v_timezone_raw := COALESCE(BTRIM(v_timezone_raw), '');

    IF v_timezone_raw = '' THEN
        v_timezone := 'Europe/London';
    ELSE
        SELECT name INTO v_timezone
        FROM pg_timezone_names
        WHERE lower(name) = lower(v_timezone_raw)
        LIMIT 1;

        IF NOT FOUND OR v_timezone IS NULL THEN
            v_timezone := 'Europe/London';
        END IF;
    END IF;

    v_start_at := make_timestamptz(
        EXTRACT(YEAR FROM p_booking_date)::int,
        EXTRACT(MONTH FROM p_booking_date)::int,
        EXTRACT(DAY FROM p_booking_date)::int,
        EXTRACT(HOUR FROM p_start_time)::int,
        EXTRACT(MINUTE FROM p_start_time)::int,
        EXTRACT(SECOND FROM p_start_time),
        v_timezone
    );

    v_end_at := make_timestamptz(
        EXTRACT(YEAR FROM p_booking_date)::int,
        EXTRACT(MONTH FROM p_booking_date)::int,
        EXTRACT(DAY FROM p_booking_date)::int,
        EXTRACT(HOUR FROM p_end_time)::int,
        EXTRACT(MINUTE FROM p_end_time)::int,
        EXTRACT(SECOND FROM p_end_time),
        v_timezone
    );

    v_local_start := (v_start_at AT TIME ZONE v_timezone);
    v_local_end := (v_end_at AT TIME ZONE v_timezone);
    v_local_day := EXTRACT(DOW FROM v_local_start)::smallint;

    SELECT allow_after_hours
    INTO v_allow_after_hours
    FROM service_policy
    ORDER BY created_at DESC
    LIMIT 1;

    v_allow_after_hours := COALESCE(v_allow_after_hours, false);

    IF NOT v_allow_after_hours THEN
        SELECT EXISTS (
            SELECT 1
            FROM restaurant_operating_hours h
            WHERE h.restaurant_id = p_restaurant_id
              AND h.is_closed = true
              AND (
                    (h.effective_date IS NOT NULL AND h.effective_date = v_local_start::date)
                 OR (h.effective_date IS NULL AND h.day_of_week = v_local_day)
              )
        ) INTO v_has_closure;

        IF v_has_closure THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'BOOKING_OUTSIDE_OPERATING_HOURS',
                'message', 'The restaurant is closed during the requested window.',
                'retryable', false,
                'details', jsonb_build_object(
                    'requestedStart', to_char(v_local_start, 'YYYY-MM-DD"T"HH24:MI:SS'),
                    'requestedEnd', to_char(v_local_end, 'YYYY-MM-DD"T"HH24:MI:SS'),
                    'timezone', v_timezone,
                    'allowAfterHours', v_allow_after_hours
                )
            );
        END IF;

        SELECT EXISTS (
            SELECT 1
            FROM restaurant_operating_hours h
            WHERE h.restaurant_id = p_restaurant_id
              AND h.is_closed = false
              AND (
                    (h.effective_date IS NOT NULL AND h.effective_date = v_local_start::date)
                 OR (h.effective_date IS NULL AND h.day_of_week = v_local_day)
              )
              AND v_local_start::time >= h.opens_at
              AND v_local_start::time < h.closes_at
        ) INTO v_is_open;

        IF NOT v_is_open THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'BOOKING_OUTSIDE_OPERATING_HOURS',
                'message', 'The requested time is outside configured operating hours.',
                'retryable', false,
                'details', jsonb_build_object(
                    'requestedStart', to_char(v_local_start, 'YYYY-MM-DD"T"HH24:MI:SS'),
                    'requestedEnd', to_char(v_local_end, 'YYYY-MM-DD"T"HH24:MI:SS'),
                    'timezone', v_timezone,
                    'allowAfterHours', v_allow_after_hours
                )
            );
        END IF;
    END IF;

    -- =====================================================
    -- STEP 4: Get Capacity Rules with Row-Level Lock
    -- Check if the table exists first to avoid errors
    -- =====================================================
    v_capacity_rules_exist := to_regclass('public.restaurant_capacity_rules') IS NOT NULL;
    
    IF v_capacity_rules_exist THEN
        SELECT
            COALESCE(cr.max_covers, 999999) AS max_covers,
            COALESCE(cr.max_parties, 999999) AS max_parties
        INTO v_max_covers, v_max_parties
        FROM restaurant_capacity_rules cr
        WHERE cr.restaurant_id = p_restaurant_id
          AND (cr.service_period_id IS NULL OR cr.service_period_id = v_service_period_id)
          AND (cr.day_of_week IS NULL OR cr.day_of_week = EXTRACT(DOW FROM p_booking_date)::smallint)
          AND (cr.effective_date IS NULL OR cr.effective_date <= p_booking_date)
        ORDER BY
          cr.effective_date DESC NULLS LAST,
          cr.day_of_week DESC NULLS LAST,
          cr.service_period_id DESC NULLS LAST
        LIMIT 1
        FOR UPDATE NOWAIT;
    END IF;

    v_max_covers := COALESCE(v_max_covers, 999999);
    v_max_parties := COALESCE(v_max_parties, 999999);

    -- =====================================================
    -- STEP 5: Count Existing Bookings in Same Period
    -- =====================================================
    SELECT
        COALESCE(SUM(b.party_size), 0) AS total_covers,
        COUNT(*) AS total_parties
    INTO v_booked_covers, v_booked_parties
    FROM bookings b
    WHERE b.restaurant_id = p_restaurant_id
      AND b.booking_date = p_booking_date
      AND b.status NOT IN ('cancelled', 'no_show')
      AND (
            v_service_period_id IS NULL
         OR b.start_time >= (
                SELECT start_time FROM restaurant_service_periods WHERE id = v_service_period_id
            )
         AND b.start_time < (
                SELECT end_time FROM restaurant_service_periods WHERE id = v_service_period_id
            )
      );

    -- =====================================================
    -- STEP 6: Capacity Validation
    -- =====================================================
    IF v_booked_covers + p_party_size > v_max_covers THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'CAPACITY_EXCEEDED',
            'message', format('Maximum capacity of %s covers exceeded. Currently booked: %s, Requested: %s',
                v_max_covers, v_booked_covers, p_party_size),
            'details', jsonb_build_object(
                'maxCovers', v_max_covers,
                'bookedCovers', v_booked_covers,
                'requestedCovers', p_party_size,
                'availableCovers', v_max_covers - v_booked_covers,
                'servicePeriod', v_service_period_name
            )
        );
    END IF;

    IF v_booked_parties + 1 > v_max_parties THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'CAPACITY_EXCEEDED',
            'message', format('Maximum of %s bookings exceeded for this period. Currently booked: %s',
                v_max_parties, v_booked_parties),
            'details', jsonb_build_object(
                'maxParties', v_max_parties,
                'bookedParties', v_booked_parties,
                'availableParties', v_max_parties - v_booked_parties,
                'servicePeriod', v_service_period_name
            )
        );
    END IF;

    v_reference := public.generate_booking_reference();

    -- =====================================================
    -- STEP 7: Insert Booking (using TEXT columns directly, no enum casts)
    -- =====================================================
    INSERT INTO bookings (
        restaurant_id,
        customer_id,
        booking_date,
        start_time,
        end_time,
        start_at,
        end_at,
        party_size,
        booking_type,
        seating_preference,
        status,
        reference,
        customer_name,
        customer_email,
        customer_phone,
        notes,
        marketing_opt_in,
        loyalty_points_awarded,
        source,
        auth_user_id,
        idempotency_key,
        details
    ) VALUES (
        p_restaurant_id,
        p_customer_id,
        p_booking_date,
        p_start_time,
        p_end_time,
        v_start_at,
        v_end_at,
        p_party_size,
        p_booking_type,                          -- TEXT column, no cast needed
        p_seating_preference::seating_preference_type,  -- This enum EXISTS, cast required
        'confirmed'::booking_status, -- This enum DOES exist
        v_reference,
        p_customer_name,
        p_customer_email,
        p_customer_phone,
        p_notes,
        p_marketing_opt_in,
        p_loyalty_points_awarded,
        p_source,
        p_auth_user_id,
        p_idempotency_key,
        jsonb_build_object(
            'channel', 'api.capacity_safe',
            'client_request_id', p_client_request_id,
            'capacity_check', jsonb_build_object(
                'service_period_id', v_service_period_id,
                'max_covers', v_max_covers,
                'booked_covers_before', v_booked_covers,
                'booked_covers_after', v_booked_covers + p_party_size
            ),
            'timezone', v_timezone,
            'original_timezone', NULLIF(v_timezone_raw, '')
        ) || COALESCE(p_details, '{}'::jsonb)
    )
    RETURNING id, to_jsonb(bookings.*) INTO v_booking_id, v_booking_record;

    RETURN jsonb_build_object(
        'success', true,
        'duplicate', false,
        'booking', v_booking_record,
        'capacity', jsonb_build_object(
            'servicePeriod', v_service_period_name,
            'maxCovers', v_max_covers,
            'bookedCovers', v_booked_covers + p_party_size,
            'availableCovers', v_max_covers - (v_booked_covers + p_party_size),
            'utilizationPercent', ROUND(((v_booked_covers + p_party_size)::numeric / v_max_covers) * 100, 1)
        ),
        'message', 'Booking created successfully'
    );

EXCEPTION
    WHEN serialization_failure THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'BOOKING_CONFLICT',
            'message', 'Concurrent booking conflict detected. Please retry.',
            'retryable', true
        );

    WHEN deadlock_detected THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'BOOKING_CONFLICT',
            'message', 'Database deadlock detected. Please retry.',
            'retryable', true
        );

    WHEN lock_not_available THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'BOOKING_CONFLICT',
            'message', 'Capacity rule is currently locked by another transaction. Please retry.',
            'retryable', true
        );

    WHEN OTHERS THEN
        RAISE WARNING 'Unexpected error in create_booking_with_capacity_check: % %', SQLERRM, SQLSTATE;
        RETURN jsonb_build_object(
            'success', false,
            'error', 'INTERNAL_ERROR',
            'message', 'An unexpected error occurred while creating the booking',
            'retryable', false,
            'sqlstate', SQLSTATE,
            'sqlerrm', SQLERRM,
            'timezone', v_timezone,
            'original_timezone', NULLIF(v_timezone_raw, '')
        );
END;
$$;


ALTER FUNCTION "public"."create_booking_with_capacity_check"("p_restaurant_id" "uuid", "p_customer_id" "uuid", "p_booking_date" "date", "p_start_time" time without time zone, "p_end_time" time without time zone, "p_party_size" integer, "p_booking_type" "text", "p_customer_name" "text", "p_customer_email" "text", "p_customer_phone" "text", "p_seating_preference" "text", "p_notes" "text", "p_marketing_opt_in" boolean, "p_idempotency_key" "text", "p_source" "text", "p_auth_user_id" "uuid", "p_client_request_id" "text", "p_details" "jsonb", "p_loyalty_points_awarded" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."create_booking_with_capacity_check"("p_restaurant_id" "uuid", "p_customer_id" "uuid", "p_booking_date" "date", "p_start_time" time without time zone, "p_end_time" time without time zone, "p_party_size" integer, "p_booking_type" "text", "p_customer_name" "text", "p_customer_email" "text", "p_customer_phone" "text", "p_seating_preference" "text", "p_notes" "text", "p_marketing_opt_in" boolean, "p_idempotency_key" "text", "p_source" "text", "p_auth_user_id" "uuid", "p_client_request_id" "text", "p_details" "jsonb", "p_loyalty_points_awarded" integer) IS 'Race-safe booking creation enforcing capacity and operating hours. Returns JSON response with success/error detail. Fixed to use TEXT columns instead of non-existent enum types.';



CREATE OR REPLACE FUNCTION "public"."current_restaurant_id"() RETURNS "uuid"
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'public', 'extensions'
    AS $$
DECLARE
  v_raw text;
BEGIN
  v_raw := nullif(current_setting('app.restaurant_id', true), '');
  IF v_raw IS NULL THEN
    v_raw := nullif(current_setting('request.header.x-restaurant-id', true), '');
  END IF;

  IF v_raw IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN v_raw::uuid;
EXCEPTION
  WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'Invalid restaurant context value'
      USING ERRCODE = '22023',
            DETAIL = format('app.restaurant_id=%L', v_raw);
END;
$$;


ALTER FUNCTION "public"."current_restaurant_id"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."current_restaurant_id"() IS 'Returns the tenant/restaurant scope extracted from app.restaurant_id GUC or the X-Restaurant-Id header.';



CREATE OR REPLACE FUNCTION "public"."enforce_bar_drinks_only"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'extensions'
    AS $$
BEGIN
  -- =========================================================================
  -- Bar table restriction REMOVED (2025-12-25)
  -- =========================================================================
  -- Previously, this function blocked non-drinks bookings on:
  --   - Tables with category = 'bar'
  --   - Tables in zones with names starting with 'bar%'
  -- 
  -- This restriction has been removed per business requirements.
  -- Bar tables and bar zones can now be used for any booking type:
  --   - lunch
  --   - dinner  
  --   - drinks
  --
  -- See: docs/ANTIGRAVITY_SESSION_HISTORY_20251225.md
  -- See: docs/BUSINESS_LOGIC.md (line 637-638)
  -- =========================================================================
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."enforce_bar_drinks_only"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_booking_reference"() RETURNS "text"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'extensions'
    AS $$
DECLARE
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- excludes 0/O/1/I
  result text := '';
  i integer;
BEGIN
  FOR i IN 1..10 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN result;
END;
$$;


ALTER FUNCTION "public"."generate_booking_reference"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_or_create_booking_slot"("p_restaurant_id" "uuid", "p_slot_date" "date", "p_slot_time" time without time zone, "p_default_capacity" integer DEFAULT 999) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
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


ALTER FUNCTION "public"."get_or_create_booking_slot"("p_restaurant_id" "uuid", "p_slot_date" "date", "p_slot_time" time without time zone, "p_default_capacity" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_or_create_booking_slot"("p_restaurant_id" "uuid", "p_slot_date" "date", "p_slot_time" time without time zone, "p_default_capacity" integer) IS 'Get existing slot or create new one with capacity override fallback (works even if restaurant_capacity_rules is absent).';



CREATE OR REPLACE FUNCTION "public"."increment_booking_slot_version"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'extensions'
    AS $$
BEGIN
    -- Only increment version if reserved_count changed
    IF OLD.reserved_count IS DISTINCT FROM NEW.reserved_count THEN
        NEW.version := OLD.version + 1;
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."increment_booking_slot_version"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."increment_booking_slot_version"() IS 'Automatically increment version column when reserved_count changes (optimistic concurrency control)';



CREATE OR REPLACE FUNCTION "public"."is_holds_strict_conflicts_enabled"() RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  -- Return true since we use DB-level exclusion constraints for conflict detection
  -- The actual conflict enforcement is done via the table_hold_windows_no_overlap constraint
  RETURN true;
END;
$$;


ALTER FUNCTION "public"."is_holds_strict_conflicts_enabled"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_table_available_v2"("p_table_id" "uuid", "p_start_at" timestamp with time zone, "p_end_at" timestamp with time zone, "p_exclude_booking_id" "uuid" DEFAULT NULL::"uuid") RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'extensions'
    AS $$
SELECT NOT EXISTS (
  SELECT 1
  FROM public.booking_table_assignments bta
  JOIN public.bookings b ON b.id = bta.booking_id
  WHERE bta.table_id = p_table_id
    AND tstzrange(bta.start_at, bta.end_at, '[)') && tstzrange(p_start_at, p_end_at, '[)')
    AND (p_exclude_booking_id IS NULL OR b.id <> p_exclude_booking_id)
    AND b.status IN ('pending', 'confirmed', 'checked_in')
);
$$;


ALTER FUNCTION "public"."is_table_available_v2"("p_table_id" "uuid", "p_start_at" timestamp with time zone, "p_end_at" timestamp with time zone, "p_exclude_booking_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_table_assignment_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
BEGIN
    -- Log to audit_logs table if it exists
    IF TG_OP = 'INSERT' THEN
        INSERT INTO audit_logs (entity, entity_id, action, actor, metadata)
        VALUES (
            'booking_table_assignment',
            NEW.id::text,
            'assigned',
            NEW.assigned_by::text,
            jsonb_build_object(
                'booking_id', NEW.booking_id,
                'table_id', NEW.table_id,
                'slot_id', NEW.slot_id
            )
        );
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO audit_logs (entity, entity_id, action, actor, metadata)
        VALUES (
            'booking_table_assignment',
            OLD.id::text,
            'unassigned',
            OLD.assigned_by::text,
            jsonb_build_object(
                'booking_id', OLD.booking_id,
                'table_id', OLD.table_id,
                'slot_id', OLD.slot_id
            )
        );
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$;


ALTER FUNCTION "public"."log_table_assignment_change"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."log_table_assignment_change"() IS 'Audit trail for table assignment changes (who assigned what table to which booking)';



CREATE OR REPLACE FUNCTION "public"."on_allocations_refresh"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
    DECLARE
      v_table uuid;
    BEGIN
      IF TG_OP = 'DELETE' THEN
        IF OLD.resource_type = 'table' THEN
          PERFORM public.refresh_table_status(OLD.resource_id);
        END IF;
      ELSE
        IF NEW.resource_type = 'table' THEN
          PERFORM public.refresh_table_status(NEW.resource_id);
        END IF;
      END IF;
      RETURN NULL;
    END;
    $$;


ALTER FUNCTION "public"."on_allocations_refresh"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."on_booking_status_refresh"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
    DECLARE
      v_table_id uuid;
    BEGIN
      IF TG_OP <> 'UPDATE' OR NEW.status = OLD.status THEN
        RETURN NEW;
      END IF;

      FOR v_table_id IN
        SELECT table_id
        FROM public.booking_table_assignments
        WHERE booking_id = NEW.id
      LOOP
        PERFORM public.refresh_table_status(v_table_id);
      END LOOP;

      RETURN NEW;
    END;
    $$;


ALTER FUNCTION "public"."on_booking_status_refresh"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ops_email_delivery_attempts_feed"("p_restaurant_id" "uuid", "p_range" "text", "p_page" integer, "p_page_size" integer, "p_statuses" "text"[] DEFAULT NULL::"text"[], "p_recipient_email" "text" DEFAULT NULL::"text", "p_message_id" "text" DEFAULT NULL::"text", "p_booking_ref" "text" DEFAULT NULL::"text", "p_template_type" "text" DEFAULT NULL::"text", "p_email_type" "text" DEFAULT NULL::"text") RETURNS TABLE("messageId" "text", "recipientEmail" "text", "bookingId" "uuid", "emailType" "text", "templateType" "text", "provider" "text", "currentStatus" "text", "currentOccurredAt" timestamp with time zone, "events" "jsonb", "booking" "jsonb")
    LANGUAGE "plpgsql" STABLE
    AS $$
DECLARE
  v_since_ts timestamptz;
  v_page integer;
  v_page_size integer;
  v_offset integer;
  v_limit integer;
  v_recipient_email text;
  v_message_id text;
  v_booking_ref text;
  v_template_type text;
  v_email_type text;
  v_statuses text[];
BEGIN
  IF p_restaurant_id IS NULL THEN
    RAISE EXCEPTION 'p_restaurant_id is required' USING ERRCODE = '22004';
  END IF;

  v_since_ts := CASE p_range
    WHEN '24h' THEN now() - interval '24 hours'
    WHEN '30d' THEN now() - interval '30 days'
    ELSE now() - interval '7 days'
  END;

  v_page := GREATEST(COALESCE(p_page, 1), 1);
  v_page_size := LEAST(GREATEST(COALESCE(p_page_size, 50), 1), 200);
  v_offset := (v_page - 1) * v_page_size;
  v_limit := v_page_size + 1;

  v_recipient_email := NULLIF(trim(p_recipient_email), '');
  v_message_id := NULLIF(trim(p_message_id), '');
  v_booking_ref := NULLIF(upper(trim(p_booking_ref)), '');
  v_template_type := NULLIF(trim(p_template_type), '');
  v_email_type := NULLIF(trim(p_email_type), '');
  v_statuses := CASE
    WHEN p_statuses IS NULL OR array_length(p_statuses, 1) IS NULL OR array_length(p_statuses, 1) = 0
      THEN NULL
    ELSE p_statuses
  END;

  RETURN QUERY
    WITH booking_filter AS (
      SELECT b.id
      FROM public.bookings b
      WHERE v_booking_ref IS NOT NULL
        AND b.restaurant_id = p_restaurant_id
        AND b.reference = v_booking_ref
    ),
    latest AS (
      SELECT DISTINCT ON (l.message_id, lower(l.recipient_email))
        l.message_id,
        l.recipient_email,
        l.booking_id,
        l.email_type,
        l.template_type,
        l.provider,
        l.status AS current_status,
        l.occurred_at AS current_occurred_at,
        l.id AS current_id
      FROM public.email_delivery_log l
      WHERE l.restaurant_id = p_restaurant_id
        AND l.occurred_at >= v_since_ts
        AND (v_message_id IS NULL OR l.message_id = v_message_id)
        AND (v_recipient_email IS NULL OR lower(l.recipient_email) = lower(v_recipient_email))
        AND (v_template_type IS NULL OR l.template_type = v_template_type)
        AND (v_email_type IS NULL OR l.email_type = v_email_type)
      ORDER BY l.message_id, lower(l.recipient_email), l.occurred_at DESC, l.id DESC
    ),
    filtered AS (
      SELECT l.*
      FROM latest l
      WHERE (v_statuses IS NULL OR l.current_status = ANY(v_statuses))
        AND (v_booking_ref IS NULL OR l.booking_id IN (SELECT id FROM booking_filter))
      ORDER BY l.current_occurred_at DESC, l.current_id DESC
      OFFSET v_offset
      LIMIT v_limit
    )
    SELECT
      f.message_id AS "messageId",
      f.recipient_email AS "recipientEmail",
      f.booking_id AS "bookingId",
      f.email_type AS "emailType",
      f.template_type AS "templateType",
      f.provider AS "provider",
      f.current_status AS "currentStatus",
      f.current_occurred_at AS "currentOccurredAt",
      (
        SELECT COALESCE(
          jsonb_agg(
            jsonb_build_object(
              'id', e.id,
              'bookingId', e.booking_id,
              'restaurantId', e.restaurant_id,
              'emailType', e.email_type,
              'templateType', e.template_type,
              'recipientEmail', e.recipient_email,
              'messageId', e.message_id,
              'status', e.status,
              'provider', e.provider,
              'occurredAt', e.occurred_at,
              'error', e.error,
              'metadata', e.metadata
            )
            ORDER BY e.occurred_at ASC, e.id ASC
          ),
          '[]'::jsonb
        )
        FROM public.email_delivery_log e
        WHERE e.restaurant_id = p_restaurant_id
          AND e.message_id = f.message_id
          AND lower(e.recipient_email) = lower(f.recipient_email)
      ) AS "events",
      (
        SELECT CASE
          WHEN f.booking_id IS NULL THEN NULL
          ELSE jsonb_build_object(
            'id', b.id,
            'reference', b.reference,
            'bookingDate', b.booking_date,
            'startTime', b.start_time,
            'endTime', b.end_time,
            'customerName', b.customer_name,
            'partySize', b.party_size
          )
        END
        FROM public.bookings b
        WHERE b.id = f.booking_id
        LIMIT 1
      ) AS "booking"
    FROM filtered f;
END;
$$;


ALTER FUNCTION "public"."ops_email_delivery_attempts_feed"("p_restaurant_id" "uuid", "p_range" "text", "p_page" integer, "p_page_size" integer, "p_statuses" "text"[], "p_recipient_email" "text", "p_message_id" "text", "p_booking_ref" "text", "p_template_type" "text", "p_email_type" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ops_email_delivery_attempts_summary"("p_restaurant_id" "uuid", "p_range" "text", "p_statuses" "text"[] DEFAULT NULL::"text"[], "p_recipient_email" "text" DEFAULT NULL::"text", "p_message_id" "text" DEFAULT NULL::"text", "p_booking_ref" "text" DEFAULT NULL::"text", "p_template_type" "text" DEFAULT NULL::"text", "p_email_type" "text" DEFAULT NULL::"text") RETURNS TABLE("total" integer, "sent" integer, "delivered" integer, "deliveryDelayed" integer, "bounced" integer, "complained" integer, "failed" integer, "deliveredRate" double precision, "failureRate" double precision, "uniqueRecipients" integer, "uniqueBookings" integer, "p50DeliverySeconds" double precision, "p95DeliverySeconds" double precision, "topFailedTemplates" "jsonb", "topFailedEmailTypes" "jsonb")
    LANGUAGE "sql" STABLE
    AS $$
  WITH normalized AS (
    SELECT
      p_restaurant_id AS restaurant_id,
      CASE p_range
        WHEN '24h' THEN now() - interval '24 hours'
        WHEN '30d' THEN now() - interval '30 days'
        ELSE now() - interval '7 days'
      END AS since_ts,
      NULLIF(trim(p_recipient_email), '') AS recipient_email,
      NULLIF(trim(p_message_id), '') AS message_id,
      NULLIF(upper(trim(p_booking_ref)), '') AS booking_ref,
      NULLIF(trim(p_template_type), '') AS template_type,
      NULLIF(trim(p_email_type), '') AS email_type,
      CASE
        WHEN p_statuses IS NULL OR array_length(p_statuses, 1) IS NULL OR array_length(p_statuses, 1) = 0
          THEN NULL
        ELSE p_statuses
      END AS statuses
  ),
  booking_filter AS (
    SELECT b.id
    FROM public.bookings b
    JOIN normalized n ON true
    WHERE n.booking_ref IS NOT NULL
      AND b.restaurant_id = n.restaurant_id
      AND b.reference = n.booking_ref
  ),
  latest AS (
    SELECT DISTINCT ON (l.message_id, lower(l.recipient_email))
      l.message_id,
      l.recipient_email,
      l.booking_id,
      l.email_type,
      l.template_type,
      l.status AS current_status,
      l.occurred_at AS current_occurred_at,
      l.id AS current_id
    FROM public.email_delivery_log l
    JOIN normalized n ON true
    WHERE l.restaurant_id = n.restaurant_id
      AND l.occurred_at >= n.since_ts
      AND (n.message_id IS NULL OR l.message_id = n.message_id)
      AND (n.recipient_email IS NULL OR lower(l.recipient_email) = lower(n.recipient_email))
      AND (n.template_type IS NULL OR l.template_type = n.template_type)
      AND (n.email_type IS NULL OR l.email_type = n.email_type)
    ORDER BY l.message_id, lower(l.recipient_email), l.occurred_at DESC, l.id DESC
  ),
  filtered AS (
    SELECT l.*
    FROM latest l
    JOIN normalized n ON true
    WHERE (n.statuses IS NULL OR l.current_status = ANY(n.statuses))
      AND (n.booking_ref IS NULL OR l.booking_id IN (SELECT id FROM booking_filter))
  ),
  duration_pairs AS (
    SELECT
      f.message_id,
      lower(f.recipient_email) AS recipient_key,
      min(e.occurred_at) FILTER (WHERE e.status = 'sent') AS sent_at,
      min(e.occurred_at) FILTER (WHERE e.status = 'delivered') AS delivered_at
    FROM filtered f
    JOIN public.email_delivery_log e
      ON e.restaurant_id = p_restaurant_id
      AND e.message_id = f.message_id
      AND lower(e.recipient_email) = lower(f.recipient_email)
    GROUP BY f.message_id, lower(f.recipient_email)
  ),
  delivered_durations AS (
    SELECT extract(epoch from (delivered_at - sent_at)) AS delivery_seconds
    FROM duration_pairs
    WHERE delivered_at IS NOT NULL
      AND sent_at IS NOT NULL
      AND delivered_at >= sent_at
  ),
  failed_templates AS (
    SELECT
      coalesce(f.template_type, 'unknown') AS template_type,
      count(*)::int AS cnt
    FROM filtered f
    WHERE f.current_status IN ('bounced', 'complained', 'failed')
    GROUP BY coalesce(f.template_type, 'unknown')
    ORDER BY cnt DESC, template_type ASC
    LIMIT 5
  ),
  failed_email_types AS (
    SELECT
      coalesce(f.email_type, 'unknown') AS email_type,
      count(*)::int AS cnt
    FROM filtered f
    WHERE f.current_status IN ('bounced', 'complained', 'failed')
    GROUP BY coalesce(f.email_type, 'unknown')
    ORDER BY cnt DESC, email_type ASC
    LIMIT 5
  ),
  counts AS (
    SELECT
      count(*)::int AS total,
      count(*) FILTER (WHERE current_status = 'sent')::int AS sent,
      count(*) FILTER (WHERE current_status = 'delivered')::int AS delivered,
      count(*) FILTER (WHERE current_status = 'delivery_delayed')::int AS delivery_delayed,
      count(*) FILTER (WHERE current_status = 'bounced')::int AS bounced,
      count(*) FILTER (WHERE current_status = 'complained')::int AS complained,
      count(*) FILTER (WHERE current_status = 'failed')::int AS failed,
      count(distinct lower(recipient_email))::int AS unique_recipients,
      count(distinct booking_id) FILTER (WHERE booking_id IS NOT NULL)::int AS unique_bookings
    FROM filtered
  )
  SELECT
    c.total,
    c.sent,
    c.delivered,
    c.delivery_delayed AS "deliveryDelayed",
    c.bounced,
    c.complained,
    c.failed,
    CASE WHEN c.total = 0 THEN 0 ELSE c.delivered::double precision / c.total END AS "deliveredRate",
    CASE WHEN c.total = 0 THEN 0 ELSE (c.bounced + c.complained + c.failed)::double precision / c.total END AS "failureRate",
    c.unique_recipients AS "uniqueRecipients",
    c.unique_bookings AS "uniqueBookings",
    (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY delivery_seconds) FROM delivered_durations) AS "p50DeliverySeconds",
    (SELECT percentile_cont(0.95) WITHIN GROUP (ORDER BY delivery_seconds) FROM delivered_durations) AS "p95DeliverySeconds",
    (
      SELECT COALESCE(
        jsonb_agg(
          jsonb_build_object('templateType', template_type, 'count', cnt)
          ORDER BY cnt DESC, template_type ASC
        ),
        '[]'::jsonb
      )
      FROM failed_templates
    ) AS "topFailedTemplates",
    (
      SELECT COALESCE(
        jsonb_agg(
          jsonb_build_object('emailType', email_type, 'count', cnt)
          ORDER BY cnt DESC, email_type ASC
        ),
        '[]'::jsonb
      )
      FROM failed_email_types
    ) AS "topFailedEmailTypes"
  FROM counts c;
$$;


ALTER FUNCTION "public"."ops_email_delivery_attempts_summary"("p_restaurant_id" "uuid", "p_range" "text", "p_statuses" "text"[], "p_recipient_email" "text", "p_message_id" "text", "p_booking_ref" "text", "p_template_type" "text", "p_email_type" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."process_late_arrivals"() RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'extensions'
    AS $$
DECLARE
  late_booking_ids uuid[];
BEGIN
  -- Select all booking IDs that are confirmed and where the start time is more than 15 minutes in the past
  SELECT array_agg(id)
  INTO late_booking_ids
  FROM public.bookings
  WHERE
    status = 'confirmed'
    AND start_at < (timezone('utc', now()) - INTERVAL '15 minutes');

  IF array_length(late_booking_ids, 1) > 0 THEN
    -- Remove all table assignments for the identified late bookings to free up the tables
    DELETE FROM public.booking_table_assignments
    WHERE booking_id = ANY(late_booking_ids);

    -- Remove associated allocations to free up the resources for conflict checks
    DELETE FROM public.allocations
    WHERE booking_id = ANY(late_booking_ids);

    -- Update the status of the late bookings to PRIORITY_WAITLIST
    UPDATE public.bookings
    SET status = 'PRIORITY_WAITLIST'
    WHERE id = ANY(late_booking_ids);
  END IF;
END;
$$;


ALTER FUNCTION "public"."process_late_arrivals"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prune_allocations_history"("p_cutoff" timestamp with time zone, "p_limit" integer DEFAULT 500) RETURNS TABLE("archived_count" integer, "deleted_count" integer)
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'extensions'
    AS $$
BEGIN
  WITH candidates AS (
    SELECT
      id,
      booking_id,
      resource_type,
      resource_id,
      created_at,
      updated_at,
      shadow,
      restaurant_id,
      "window",
      created_by,
      is_maintenance
    FROM public.allocations
    WHERE upper("window") < p_cutoff
    ORDER BY updated_at
    LIMIT p_limit
  ), inserted AS (
    INSERT INTO public.allocations_archive (
      id,
      booking_id,
      resource_type,
      resource_id,
      created_at,
      updated_at,
      shadow,
      restaurant_id,
      "window",
      created_by,
      is_maintenance,
      archived_at
    )
    SELECT
      c.id,
      c.booking_id,
      c.resource_type,
      c.resource_id,
      c.created_at,
      c.updated_at,
      c.shadow,
      c.restaurant_id,
      c."window",
      c.created_by,
      c.is_maintenance,
      timezone('utc'::text, now())
    FROM candidates c
    ON CONFLICT (id) DO NOTHING
    RETURNING id
  ), deleted AS (
    DELETE FROM public.allocations a
    USING inserted i
    WHERE a.id = i.id
    RETURNING a.id
  )
  SELECT * INTO archived_count, deleted_count FROM (
    SELECT
      COALESCE((SELECT count(*) FROM inserted), 0)::integer AS archived_count,
      COALESCE((SELECT count(*) FROM deleted), 0)::integer AS deleted_count
  ) subq;
  
  RETURN QUERY SELECT archived_count, deleted_count;
END;
$$;


ALTER FUNCTION "public"."prune_allocations_history"("p_cutoff" timestamp with time zone, "p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refresh_table_status"("p_table_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
  DECLARE
    v_has_checked_in boolean;
    v_has_current_allocation boolean;
  BEGIN
    IF p_table_id IS NULL THEN
      RETURN;
    END IF;

    IF EXISTS (
      SELECT 1
      FROM public.allocations a
      WHERE a.resource_type = 'table'
        AND a.resource_id = p_table_id
        AND a.is_maintenance
        AND a."window" @> now()
    ) THEN
      UPDATE public.table_inventory
      SET status = 'out_of_service'
      WHERE id = p_table_id;
      RETURN;
    END IF;

    SELECT EXISTS (
      SELECT 1
      FROM public.allocations a
      JOIN public.bookings b ON b.id = a.booking_id
      WHERE a.resource_type = 'table'
        AND a.resource_id = p_table_id
        AND b.status = 'checked_in'
        AND a."window" @> now()
    ) INTO v_has_checked_in;

    IF v_has_checked_in THEN
      UPDATE public.table_inventory
      SET status = 'occupied'
      WHERE id = p_table_id
        AND status <> 'out_of_service';
      RETURN;
    END IF;

    SELECT EXISTS (
      SELECT 1
      FROM public.allocations a
      WHERE a.resource_type = 'table'
        AND a.resource_id = p_table_id
        AND a."window" @> now()
    ) INTO v_has_current_allocation;

    IF v_has_current_allocation THEN
      UPDATE public.table_inventory
      SET status = 'reserved'
      WHERE id = p_table_id
        AND status NOT IN ('occupied', 'out_of_service');
    ELSE
      UPDATE public.table_inventory
      SET status = 'available'
      WHERE id = p_table_id
        AND status <> 'out_of_service';
    END IF;
  END;
  $$;


ALTER FUNCTION "public"."refresh_table_status"("p_table_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."release_hold_and_emit"("p_hold_id" "uuid", "p_actor_id" "uuid" DEFAULT NULL::"uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_hold public.table_holds%ROWTYPE;
  v_member_table_ids uuid[];
BEGIN
  SELECT * INTO v_hold
    FROM public.table_holds
    WHERE id = p_hold_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Collect member table IDs BEFORE deleting
  SELECT array_agg(thm.table_id)
    INTO v_member_table_ids
    FROM public.table_hold_members thm
    WHERE thm.hold_id = p_hold_id;

  DELETE FROM public.table_hold_members WHERE hold_id = p_hold_id;
  DELETE FROM public.table_holds WHERE id = p_hold_id;

  BEGIN
    PERFORM public.record_observability_event(
      'capacity.holds',
      'hold.released',
      'info',
      v_hold.restaurant_id,
      v_hold.booking_id,
      jsonb_build_object(
        'holdId', p_hold_id,
        'actorId', p_actor_id,
        'tableIds', COALESCE(to_jsonb(v_member_table_ids), '[]'::jsonb),
        'startAt', v_hold.start_at,
        'endAt', v_hold.end_at,
        'expiresAt', v_hold.expires_at
      )
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN true;
END;
$$;


ALTER FUNCTION "public"."release_hold_and_emit"("p_hold_id" "uuid", "p_actor_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."release_soft_holds"("p_session_token" "uuid", "p_table_ids" "uuid"[] DEFAULT NULL::"uuid"[]) RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_count integer;
BEGIN
  IF p_table_ids IS NOT NULL AND array_length(p_table_ids, 1) > 0 THEN
    DELETE FROM public.table_soft_holds
    WHERE session_token = p_session_token
      AND table_id = ANY(p_table_ids);
  ELSE
    DELETE FROM public.table_soft_holds
    WHERE session_token = p_session_token;
  END IF;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;


ALTER FUNCTION "public"."release_soft_holds"("p_session_token" "uuid", "p_table_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."release_zone_floorplan_lock_v1"("p_zone_id" "uuid", "p_user_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql"
    AS $$
declare
  deleted_count integer := 0;
begin
  if p_zone_id is null or p_user_id is null then
    raise exception 'Missing required inputs' using errcode = '22023';
  end if;

  delete from public.zone_floorplan_edit_locks
  where zone_id = p_zone_id
    and locked_by = p_user_id;

  get diagnostics deleted_count = row_count;
  return deleted_count > 0;
end;
$$;


ALTER FUNCTION "public"."release_zone_floorplan_lock_v1"("p_zone_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."require_restaurant_context"() RETURNS "uuid"
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'public', 'extensions'
    AS $$
DECLARE
  v_restaurant_id uuid;
BEGIN
  v_restaurant_id := public.current_restaurant_id();
  IF v_restaurant_id IS NULL THEN
    RAISE EXCEPTION 'Restaurant context is required' USING ERRCODE = '42501';
  END IF;
  RETURN v_restaurant_id;
END;
$$;


ALTER FUNCTION "public"."require_restaurant_context"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."require_restaurant_context"() IS 'Raises if no tenant context is present (used by RLS policies).';



CREATE OR REPLACE FUNCTION "public"."restore_zone_floorplan_layout_v1"("p_zone_id" "uuid", "p_restaurant_id" "uuid", "p_user_id" "uuid", "p_version_id" "uuid", "p_note" "text" DEFAULT NULL::"text") RETURNS TABLE("version_id" "uuid", "version" integer, "pruned_edges" "jsonb")
    LANGUAGE "plpgsql"
    AS $$
declare
  payload jsonb;
begin
  select v.payload into payload
  from public.zone_floorplan_layout_versions v
  where v.id = p_version_id
    and v.zone_id = p_zone_id
    and v.restaurant_id = p_restaurant_id;

  if not found then
    raise exception 'Layout version not found' using errcode = 'P0002';
  end if;

  return query
    select *
    from public.apply_zone_floorplan_layout_v1(
      p_zone_id,
      p_restaurant_id,
      p_user_id,
      payload,
      p_note,
      p_version_id
    );
end;
$$;


ALTER FUNCTION "public"."restore_zone_floorplan_layout_v1"("p_zone_id" "uuid", "p_restaurant_id" "uuid", "p_user_id" "uuid", "p_version_id" "uuid", "p_note" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_booking_instants"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'extensions'
    AS $$
DECLARE
  tz text;
  sh int; sm int; ss double precision;
  eh int; em int; es double precision;
BEGIN
  SELECT timezone INTO tz FROM public.restaurants WHERE id = NEW.restaurant_id;

  sh := EXTRACT(HOUR   FROM NEW.start_time)::int;
  sm := EXTRACT(MINUTE FROM NEW.start_time)::int;
  ss := EXTRACT(SECOND FROM NEW.start_time);
  eh := EXTRACT(HOUR   FROM NEW.end_time)::int;
  em := EXTRACT(MINUTE FROM NEW.end_time)::int;
  es := EXTRACT(SECOND FROM NEW.end_time);

  NEW.start_at := make_timestamptz(
                    EXTRACT(YEAR  FROM NEW.booking_date)::int,
                    EXTRACT(MONTH FROM NEW.booking_date)::int,
                    EXTRACT(DAY   FROM NEW.booking_date)::int,
                    sh, sm, ss, tz
                  );

  NEW.end_at := make_timestamptz(
                    EXTRACT(YEAR  FROM NEW.booking_date)::int,
                    EXTRACT(MONTH FROM NEW.booking_date)::int,
                    EXTRACT(DAY   FROM NEW.booking_date)::int,
                    eh, em, es, tz
               );

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_booking_instants"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_booking_reference"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'extensions'
    AS $$
DECLARE ref text;
BEGIN
  IF COALESCE(NEW.reference,'') = '' THEN
    LOOP
      ref := public.generate_booking_reference();
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.bookings WHERE reference = ref);
    END LOOP;
    NEW.reference := ref;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_booking_reference"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_hold_conflict_enforcement"("enabled" boolean) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  -- Store in a session-local temporary table or use SET LOCAL
  -- For simplicity, we just return true - the application already has fallback logic
  RETURN enabled;
END;
$$;


ALTER FUNCTION "public"."set_hold_conflict_enforcement"("enabled" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_restaurant_context"("p_restaurant_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF p_restaurant_id IS NULL THEN
    PERFORM set_config('app.restaurant_id', '', false);
    RETURN NULL;
  END IF;
  PERFORM set_config('app.restaurant_id', p_restaurant_id::text, false);
  RETURN p_restaurant_id;
END;
$$;


ALTER FUNCTION "public"."set_restaurant_context"("p_restaurant_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."set_restaurant_context"("p_restaurant_id" "uuid") IS 'Allows edge functions / trusted callers to set the tenant context for the current session.';



CREATE OR REPLACE FUNCTION "public"."set_timestamp_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'extensions'
    AS $$
BEGIN
  NEW.updated_at := timezone('utc', now());
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_timestamp_updated_at"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."booking_table_assignments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "booking_id" "uuid" NOT NULL,
    "table_id" "uuid" NOT NULL,
    "slot_id" "uuid",
    "assigned_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "assigned_by" "uuid",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "idempotency_key" "text",
    "start_at" timestamp with time zone,
    "end_at" timestamp with time zone,
    "allocation_id" "uuid",
    "merge_group_id" "uuid",
    "assignment_window" "tstzrange" GENERATED ALWAYS AS ("tstzrange"("start_at", "end_at", '[)'::"text")) STORED
);


ALTER TABLE "public"."booking_table_assignments" OWNER TO "postgres";


COMMENT ON TABLE "public"."booking_table_assignments" IS 'Links bookings to physical tables. A booking can have multiple tables (e.g., party of 10 = 2x 6-tops).';



COMMENT ON COLUMN "public"."booking_table_assignments"."booking_id" IS 'The booking being assigned a table';



COMMENT ON COLUMN "public"."booking_table_assignments"."table_id" IS 'The physical table being assigned';



COMMENT ON COLUMN "public"."booking_table_assignments"."slot_id" IS 'Optional link to the booking slot (for slot-level tracking)';



COMMENT ON COLUMN "public"."booking_table_assignments"."assigned_at" IS 'When the assignment was made';



COMMENT ON COLUMN "public"."booking_table_assignments"."assigned_by" IS 'User who made the assignment.';



COMMENT ON COLUMN "public"."booking_table_assignments"."notes" IS 'Optional notes about the assignment (e.g., "VIP preferred seating")';



COMMENT ON COLUMN "public"."booking_table_assignments"."allocation_id" IS 'Allocation row backing the assignment; used for overlap enforcement.';



CREATE OR REPLACE FUNCTION "public"."sync_confirmed_assignment_windows"("p_booking_id" "uuid", "p_table_ids" "uuid"[], "p_window_start" timestamp with time zone, "p_window_end" timestamp with time zone, "p_actor_id" "uuid" DEFAULT NULL::"uuid", "p_hold_id" "uuid" DEFAULT NULL::"uuid", "p_merge_group_id" "uuid" DEFAULT NULL::"uuid", "p_idempotency_key" "text" DEFAULT NULL::"text", "p_payload_checksum" "text" DEFAULT NULL::"text") RETURNS SETOF "public"."booking_table_assignments"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_window tstzrange := tstzrange(p_window_start, p_window_end, '[)');
BEGIN
  IF p_booking_id IS NULL THEN
    RAISE EXCEPTION 'sync_confirmed_assignment_windows requires booking id';
  END IF;

  IF p_table_ids IS NULL OR array_length(p_table_ids, 1) IS NULL THEN
    RETURN QUERY
      SELECT *
      FROM public.booking_table_assignments
      WHERE booking_id = p_booking_id;
    RETURN;
  END IF;

  UPDATE public.booking_table_assignments
     SET start_at = p_window_start,
         end_at = p_window_end
   WHERE booking_id = p_booking_id
     AND table_id = ANY(p_table_ids);

  UPDATE public.allocations
     SET "window" = v_window,
         merge_group_id = COALESCE(p_merge_group_id, merge_group_id)
   WHERE booking_id = p_booking_id
     AND resource_type = 'table'
     AND resource_id = ANY(p_table_ids);

  IF p_idempotency_key IS NOT NULL THEN
    UPDATE public.booking_assignment_idempotency
       SET assignment_window = v_window,
           merge_group_allocation_id = p_merge_group_id,
           payload_checksum = p_payload_checksum
     WHERE booking_id = p_booking_id
       AND idempotency_key = p_idempotency_key;
  END IF;

  INSERT INTO public.capacity_outbox (
    event_type,
    dedupe_key,
    restaurant_id,
    booking_id,
    idempotency_key,
    payload
  )
  SELECT
    'capacity.assignment.window_synced',
    format('%s:%s:window_synced', p_booking_id, coalesce(p_hold_id, 'none')),
    b.restaurant_id,
    p_booking_id,
    p_idempotency_key,
    jsonb_build_object(
      'bookingId', p_booking_id,
      'tableIds', p_table_ids,
      'startAt', to_char(p_window_start AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      'endAt', to_char(p_window_end AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      'actorId', p_actor_id,
      'holdId', p_hold_id,
      'mergeGroupId', p_merge_group_id
    )
  FROM public.bookings b
  WHERE b.id = p_booking_id
  ON CONFLICT ON CONSTRAINT capacity_outbox_dedupe_unique DO NOTHING;

  RETURN QUERY
    SELECT *
      FROM public.booking_table_assignments
     WHERE booking_id = p_booking_id
       AND table_id = ANY(p_table_ids);
END;
$$;


ALTER FUNCTION "public"."sync_confirmed_assignment_windows"("p_booking_id" "uuid", "p_table_ids" "uuid"[], "p_window_start" timestamp with time zone, "p_window_end" timestamp with time zone, "p_actor_id" "uuid", "p_hold_id" "uuid", "p_merge_group_id" "uuid", "p_idempotency_key" "text", "p_payload_checksum" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_table_hold_windows"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
DECLARE
  hold_row RECORD;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.table_hold_windows
    WHERE hold_id = OLD.hold_id AND table_id = OLD.table_id;
    RETURN OLD;
  END IF;

  -- For INSERT, get the parent hold details
  SELECT id, restaurant_id, booking_id, start_at, end_at, expires_at
  INTO hold_row
  FROM public.table_holds
  WHERE id = NEW.hold_id;

  IF hold_row IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.table_hold_windows (hold_id, table_id, restaurant_id, booking_id, start_at, end_at, expires_at)
  VALUES (
    NEW.hold_id,
    NEW.table_id,
    hold_row.restaurant_id,
    hold_row.booking_id,
    hold_row.start_at,
    hold_row.end_at,
    hold_row.expires_at
  )
  ON CONFLICT (hold_id, table_id) DO UPDATE SET
    restaurant_id = EXCLUDED.restaurant_id,
    booking_id = EXCLUDED.booking_id,
    start_at = EXCLUDED.start_at,
    end_at = EXCLUDED.end_at,
    expires_at = EXCLUDED.expires_at;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_table_hold_windows"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."unassign_table_from_booking"("p_booking_id" "uuid", "p_table_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
DECLARE
    v_deleted boolean;
BEGIN
    -- Delete assignment
    DELETE FROM booking_table_assignments
    WHERE booking_id = p_booking_id
        AND table_id = p_table_id;
    
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    
    IF v_deleted THEN
        -- Update table status to available
        UPDATE table_inventory
        SET status = 'available'::table_status
        WHERE id = p_table_id
            AND NOT EXISTS (
                -- Keep as reserved if other active bookings exist
                SELECT 1 FROM booking_table_assignments bta
                JOIN bookings b ON b.id = bta.booking_id
                WHERE bta.table_id = p_table_id
                    AND b.status NOT IN ('cancelled', 'no_show', 'completed')
            );
        
        RETURN true;
    END IF;
    
    RETURN false;
END;
$$;


ALTER FUNCTION "public"."unassign_table_from_booking"("p_booking_id" "uuid", "p_table_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."unassign_table_from_booking"("p_booking_id" "uuid", "p_table_id" "uuid") IS 'Remove table assignment from booking. Updates table status to available if no other active bookings.';



CREATE OR REPLACE FUNCTION "public"."unassign_tables_atomic"("p_booking_id" "uuid", "p_table_ids" "uuid"[] DEFAULT NULL::"uuid"[]) RETURNS TABLE("table_id" "uuid")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
    DECLARE
      v_target_tables uuid[] := p_table_ids;
      v_removed RECORD;
    BEGIN
      IF v_target_tables IS NOT NULL THEN
        SELECT array_agg(DISTINCT t.table_id)
        INTO v_target_tables
        FROM unnest(v_target_tables) AS t(table_id);
      ELSE
        SELECT array_agg(bta.table_id)
        INTO v_target_tables
        FROM public.booking_table_assignments bta
        WHERE bta.booking_id = p_booking_id;
      END IF;

      IF v_target_tables IS NULL OR array_length(v_target_tables, 1) = 0 THEN
        RETURN;
      END IF;

      FOR v_removed IN
        DELETE FROM public.booking_table_assignments bta
        WHERE bta.booking_id = p_booking_id
          AND bta.table_id = ANY (v_target_tables)
        RETURNING bta.table_id
      LOOP
        unassign_tables_atomic.table_id := v_removed.table_id;

        DELETE FROM public.allocations alloc
        WHERE alloc.booking_id = p_booking_id
          AND alloc.resource_type = 'table'
          AND alloc.resource_id = v_removed.table_id;

        UPDATE public.table_inventory ti
        SET status = 'available'::public.table_status
        WHERE ti.id = v_removed.table_id
          AND NOT EXISTS (
            SELECT 1
            FROM public.booking_table_assignments bta2
            WHERE bta2.table_id = v_removed.table_id
          );

        RETURN NEXT;
      END LOOP;

      RETURN;
    END;
    $$;


ALTER FUNCTION "public"."unassign_tables_atomic"("p_booking_id" "uuid", "p_table_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_booking_with_capacity_check"("p_booking_id" "uuid", "p_restaurant_id" "uuid", "p_customer_id" "uuid", "p_booking_date" "date", "p_start_time" time without time zone, "p_end_time" time without time zone, "p_party_size" integer, "p_booking_type" "text", "p_customer_name" "text", "p_customer_email" "text", "p_customer_phone" "text", "p_seating_preference" "text", "p_notes" "text" DEFAULT NULL::"text", "p_marketing_opt_in" boolean DEFAULT false, "p_auth_user_id" "uuid" DEFAULT NULL::"uuid", "p_client_request_id" "text" DEFAULT NULL::"text", "p_details" "jsonb" DEFAULT '{}'::"jsonb", "p_loyalty_points_awarded" integer DEFAULT 0, "p_source" "text" DEFAULT 'api'::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_existing bookings%ROWTYPE;
    v_service_period_id uuid;
    v_service_period_name text;
    v_max_covers integer;
    v_max_parties integer;
    v_booked_covers integer;
    v_booked_parties integer;
    v_timezone_raw text;
    v_timezone text;
    v_start_at timestamptz;
    v_end_at timestamptz;
    v_booking_record jsonb;
    v_booking_type bookings.booking_type%TYPE;
    v_seating_preference bookings.seating_preference%TYPE;
    v_capacity_rules_exist boolean := to_regclass('public.restaurant_capacity_rules') IS NOT NULL;
BEGIN
    BEGIN
        SELECT * INTO v_existing
        FROM bookings
        WHERE id = p_booking_id
          AND restaurant_id = p_restaurant_id
        FOR UPDATE;

        IF NOT FOUND THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'INVALID_PARAMS',
                'message', 'Booking not found for update'
            );
        END IF;

        SELECT sp.id, sp.name INTO v_service_period_id, v_service_period_name
        FROM restaurant_service_periods sp
        WHERE sp.restaurant_id = p_restaurant_id
          AND (sp.day_of_week IS NULL OR sp.day_of_week = EXTRACT(DOW FROM p_booking_date)::smallint)
          AND p_start_time >= sp.start_time
          AND p_start_time < sp.end_time
        ORDER BY
            sp.day_of_week DESC NULLS LAST,
            sp.start_time ASC
        LIMIT 1;

        IF v_capacity_rules_exist THEN
            SELECT
                COALESCE(cr.max_covers, 999999) AS max_covers,
                COALESCE(cr.max_parties, 999999) AS max_parties
            INTO v_max_covers, v_max_parties
            FROM restaurant_capacity_rules cr
            WHERE cr.restaurant_id = p_restaurant_id
              AND (cr.service_period_id IS NULL OR cr.service_period_id = v_service_period_id)
              AND (cr.day_of_week IS NULL OR cr.day_of_week = EXTRACT(DOW FROM p_booking_date)::smallint)
              AND (cr.effective_date IS NULL OR cr.effective_date <= p_booking_date)
            ORDER BY
                cr.effective_date DESC NULLS LAST,
                cr.day_of_week DESC NULLS LAST,
                cr.service_period_id DESC NULLS LAST
            LIMIT 1
            FOR UPDATE NOWAIT;
        ELSE
            RAISE LOG 'Skipping capacity override lookup for booking % at restaurant % because public.restaurant_capacity_rules is absent.',
              p_booking_id,
              p_restaurant_id;
        END IF;

        v_max_covers := COALESCE(v_max_covers, 999999);
        v_max_parties := COALESCE(v_max_parties, 999999);

        SELECT
            COALESCE(SUM(b.party_size), 0) AS total_covers,
            COUNT(*) AS total_parties
        INTO v_booked_covers, v_booked_parties
        FROM bookings b
        WHERE b.restaurant_id = p_restaurant_id
          AND b.booking_date = p_booking_date
          AND b.status NOT IN ('cancelled', 'no_show')
          AND b.id <> p_booking_id
          AND (
            v_service_period_id IS NULL
            OR (
                b.start_time >= (SELECT start_time FROM restaurant_service_periods WHERE id = v_service_period_id)
                AND b.start_time < (SELECT end_time FROM restaurant_service_periods WHERE id = v_service_period_id)
            )
          );

        IF v_booked_covers + p_party_size > v_max_covers THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'CAPACITY_EXCEEDED',
                'message', 'No capacity available for this time slot',
                'details', jsonb_build_object(
                    'requestedCovers', p_party_size,
                    'maxCovers', v_max_covers,
                    'bookedCovers', v_booked_covers,
                    'availableCovers', GREATEST(v_max_covers - v_booked_covers, 0),
                    'servicePeriod', v_service_period_name,
                    'maxParties', v_max_parties,
                    'bookedParties', v_booked_parties
                )
            );
        END IF;

        IF v_booked_parties + 1 > v_max_parties THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'CAPACITY_EXCEEDED',
                'message', 'Too many simultaneous parties in this slot',
                'details', jsonb_build_object(
                    'requestedParties', 1,
                    'maxParties', v_max_parties,
                    'bookedParties', v_booked_parties,
                    'servicePeriod', v_service_period_name,
                    'availableParties', GREATEST(v_max_parties - v_booked_parties, 0)
                )
            );
        END IF;

        SELECT timezone INTO v_timezone_raw
        FROM restaurants
        WHERE id = p_restaurant_id;

        v_timezone_raw := COALESCE(BTRIM(v_timezone_raw), '');

        IF v_timezone_raw = '' THEN
            v_timezone := 'Europe/London';
        ELSE
            SELECT name INTO v_timezone
            FROM pg_timezone_names
            WHERE lower(name) = lower(v_timezone_raw)
            LIMIT 1;

            IF NOT FOUND OR v_timezone IS NULL THEN
                v_timezone := 'Europe/London';
            END IF;
        END IF;

        v_start_at := make_timestamptz(
            EXTRACT(YEAR FROM p_booking_date)::int,
            EXTRACT(MONTH FROM p_booking_date)::int,
            EXTRACT(DAY FROM p_booking_date)::int,
            EXTRACT(HOUR FROM p_start_time)::int,
            EXTRACT(MINUTE FROM p_start_time)::int,
            EXTRACT(SECOND FROM p_start_time),
            v_timezone
        );

        v_end_at := make_timestamptz(
            EXTRACT(YEAR FROM p_booking_date)::int,
            EXTRACT(MONTH FROM p_booking_date)::int,
            EXTRACT(DAY FROM p_booking_date)::int,
            EXTRACT(HOUR FROM p_end_time)::int,
            EXTRACT(MINUTE FROM p_end_time)::int,
            EXTRACT(SECOND FROM p_end_time),
            v_timezone
        );

        v_booking_type := p_booking_type;
        v_seating_preference := p_seating_preference;

        UPDATE bookings
        SET
            booking_date = p_booking_date,
            start_time = p_start_time,
            end_time = p_end_time,
            start_at = v_start_at,
            end_at = v_end_at,
            party_size = p_party_size,
            booking_type = v_booking_type,
            seating_preference = v_seating_preference,
            customer_name = p_customer_name,
            customer_email = p_customer_email,
            customer_phone = p_customer_phone,
            notes = p_notes,
            marketing_opt_in = p_marketing_opt_in,
            customer_id = p_customer_id,
            auth_user_id = COALESCE(p_auth_user_id, v_existing.auth_user_id),
            client_request_id = COALESCE(p_client_request_id, v_existing.client_request_id),
            loyalty_points_awarded = COALESCE(p_loyalty_points_awarded, v_existing.loyalty_points_awarded),
            source = COALESCE(p_source, v_existing.source),
            details = COALESCE(v_existing.details, '{}'::jsonb)
                || COALESCE(p_details, '{}'::jsonb)
                || jsonb_build_object(
                    'channel', 'api.capacity_safe',
                    'client_request_id', COALESCE(p_client_request_id, v_existing.client_request_id),
                    'capacity_check', jsonb_build_object(
                        'service_period_id', v_service_period_id,
                        'max_covers', v_max_covers,
                        'booked_covers_before', v_booked_covers,
                        'booked_covers_after', v_booked_covers + p_party_size
                    ),
                    'timezone', v_timezone,
                    'original_timezone', NULLIF(v_timezone_raw, '')
                )
        WHERE id = p_booking_id
        RETURNING to_jsonb(bookings.*) INTO v_booking_record;

        RETURN jsonb_build_object(
            'success', true,
            'booking', v_booking_record,
            'capacity', jsonb_build_object(
                'servicePeriod', v_service_period_name,
                'maxCovers', v_max_covers,
                'bookedCovers', v_booked_covers + p_party_size,
                'availableCovers', GREATEST(v_max_covers - (v_booked_covers + p_party_size), 0),
                'utilizationPercent', CASE
                    WHEN COALESCE(v_max_covers, 0) = 0 THEN 0
                    ELSE ROUND(((v_booked_covers + p_party_size)::numeric / NULLIF(v_max_covers, 0)) * 100, 1)
                END
            ),
            'message', 'Booking updated successfully'
        );

    EXCEPTION
        WHEN serialization_failure THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'BOOKING_CONFLICT',
                'message', 'Concurrent booking conflict detected. Please retry.',
                'retryable', true
            );
        WHEN deadlock_detected THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'BOOKING_CONFLICT',
                'message', 'Database deadlock detected. Please retry.',
                'retryable', true
            );
        WHEN lock_not_available THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'BOOKING_CONFLICT',
                'message', 'Capacity rule is currently locked by another transaction. Please retry.',
                'retryable', true
            );
        WHEN OTHERS THEN
            RAISE WARNING 'Unexpected error in update_booking_with_capacity_check: % %', SQLERRM, SQLSTATE;
            RETURN jsonb_build_object(
                'success', false,
                'error', 'INTERNAL_ERROR',
                'message', 'An unexpected error occurred while updating the booking',
                'retryable', false,
                'details', jsonb_build_object(
                    'sqlstate', SQLSTATE,
                    'sqlerrm', SQLERRM,
                    'timezone', v_timezone,
                    'original_timezone', NULLIF(v_timezone_raw, '')
                ),
                'sqlstate', SQLSTATE,
                'sqlerrm', SQLERRM,
                'timezone', v_timezone,
                'original_timezone', NULLIF(v_timezone_raw, '')
            );
    END;
END;
$$;


ALTER FUNCTION "public"."update_booking_with_capacity_check"("p_booking_id" "uuid", "p_restaurant_id" "uuid", "p_customer_id" "uuid", "p_booking_date" "date", "p_start_time" time without time zone, "p_end_time" time without time zone, "p_party_size" integer, "p_booking_type" "text", "p_customer_name" "text", "p_customer_email" "text", "p_customer_phone" "text", "p_seating_preference" "text", "p_notes" "text", "p_marketing_opt_in" boolean, "p_auth_user_id" "uuid", "p_client_request_id" "text", "p_details" "jsonb", "p_loyalty_points_awarded" integer, "p_source" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_table_hold_windows"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
BEGIN
  UPDATE public.table_hold_windows
  SET
    restaurant_id = NEW.restaurant_id,
    booking_id = NEW.booking_id,
    start_at = NEW.start_at,
    end_at = NEW.end_at,
    expires_at = NEW.expires_at
  WHERE hold_id = NEW.id;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_table_hold_windows"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'extensions'
    AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'extensions'
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_restaurants"() RETURNS SETOF "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
  SELECT restaurant_id
  FROM public.restaurant_memberships
  WHERE user_id = auth.uid()
$$;


ALTER FUNCTION "public"."user_restaurants"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_restaurants_admin"() RETURNS SETOF "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT restaurant_id
  FROM public.restaurant_memberships
  WHERE user_id = auth.uid()
    AND role = ANY (ARRAY['owner'::text, 'manager'::text]);
$$;


ALTER FUNCTION "public"."user_restaurants_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_booking_capacity_after_assignment"("p_booking_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'extensions'
    AS $$
DECLARE
  v_booking RECORD;
  v_service_period RECORD;
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
  v_capacity_table_exists boolean := to_regclass('public.restaurant_capacity_rules') IS NOT NULL;
  v_rule_max_covers integer;
  v_rule_max_parties integer;
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

  IF v_capacity_table_exists THEN
    SELECT
      COALESCE(cr.max_covers, v_max_covers),
      COALESCE(cr.max_parties, v_max_parties)
    INTO v_rule_max_covers, v_rule_max_parties
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

    v_max_covers := COALESCE(v_rule_max_covers, v_max_covers);
    v_max_parties := COALESCE(v_rule_max_parties, v_max_parties);
  ELSE
    RAISE LOG 'Skipping capacity overrides for booking %, restaurant % because public.restaurant_capacity_rules is absent.',
      p_booking_id,
      v_booking.restaurant_id;
  END IF;

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


ALTER FUNCTION "public"."validate_booking_capacity_after_assignment"("p_booking_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."validate_booking_capacity_after_assignment"("p_booking_id" "uuid") IS 'Checks post-assignment capacity; tolerates missing restaurant_capacity_rules via to_regclass guard.';



CREATE OR REPLACE FUNCTION "public"."validate_booking_has_assignments"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'extensions'
    AS $$
BEGIN
  -- Only validate when status is being changed to 'confirmed'
  IF NEW.status = 'confirmed' AND (OLD.status IS NULL OR OLD.status != 'confirmed') THEN
    -- Check if this booking has any table assignments
    IF NOT EXISTS (
      SELECT 1 
      FROM booking_table_assignments 
      WHERE booking_id = NEW.id
    ) THEN
      RAISE EXCEPTION 'Cannot confirm booking %: No table assignments exist. Booking must have at least one table assigned before confirmation.', NEW.id
        USING HINT = 'Use the assign_tables RPC function to assign tables before confirming';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."validate_booking_has_assignments"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."validate_booking_has_assignments"() IS 'Validates that confirmed bookings have at least one table assignment. Prevents orphaned confirmations.';



CREATE OR REPLACE FUNCTION "public"."validate_table_adjacency"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'extensions'
    AS $$
DECLARE
  zone_a uuid;
  zone_b uuid;
BEGIN
  SELECT zone_id INTO zone_a FROM public.table_inventory WHERE id = NEW.table_a;
  SELECT zone_id INTO zone_b FROM public.table_inventory WHERE id = NEW.table_b;

  IF zone_a IS NULL OR zone_b IS NULL THEN
    RAISE EXCEPTION 'Tables must belong to zones before adjacency can be created';
  END IF;

  IF zone_a <> zone_b THEN
    RAISE EXCEPTION 'Adjacency requires tables to be in the same zone';
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."validate_table_adjacency"() OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."_migrations" (
    "id" bigint NOT NULL,
    "name" character varying(255) NOT NULL,
    "timestamp" timestamp with time zone DEFAULT "now"(),
    "status" character varying(50) DEFAULT 'applied'::character varying
);


ALTER TABLE "public"."_migrations" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."_migrations_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."_migrations_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."_migrations_id_seq" OWNED BY "public"."_migrations"."id";



CREATE TABLE IF NOT EXISTS "public"."allocations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "booking_id" "uuid",
    "resource_type" "text" NOT NULL,
    "resource_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "shadow" boolean DEFAULT false NOT NULL,
    "restaurant_id" "uuid" NOT NULL,
    "window" "tstzrange" NOT NULL,
    "created_by" "uuid",
    "is_maintenance" boolean DEFAULT false NOT NULL,
    CONSTRAINT "allocations_resource_type_check" CHECK (("resource_type" = ANY (ARRAY['table'::"text", 'merge_group'::"text"])))
);


ALTER TABLE "public"."allocations" OWNER TO "postgres";


COMMENT ON COLUMN "public"."allocations"."shadow" IS 'True when allocation is tentative (shadow). Shadow allocations are visible to staff but do not block standard bookings.';



COMMENT ON COLUMN "public"."allocations"."is_maintenance" IS 'True when allocation reserves a table for maintenance/out-of-service windows rather than a booking.';



CREATE TABLE IF NOT EXISTS "public"."allocations_archive" (
    "id" "uuid" NOT NULL,
    "booking_id" "uuid",
    "resource_type" "text" NOT NULL,
    "resource_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone NOT NULL,
    "updated_at" timestamp with time zone NOT NULL,
    "shadow" boolean DEFAULT false NOT NULL,
    "restaurant_id" "uuid" NOT NULL,
    "window" "tstzrange" NOT NULL,
    "created_by" "uuid",
    "is_maintenance" boolean DEFAULT false NOT NULL,
    "archived_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "allocations_archive_resource_type_check" CHECK (("resource_type" = ANY (ARRAY['table'::"text", 'hold'::"text", 'merge_group'::"text"])))
);


ALTER TABLE "public"."allocations_archive" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."allowed_capacities" (
    "restaurant_id" "uuid" NOT NULL,
    "capacity" smallint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "allowed_capacities_capacity_check" CHECK (("capacity" > 0))
);


ALTER TABLE "public"."allowed_capacities" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."analytics_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_type" "public"."analytics_event_type" NOT NULL,
    "schema_version" "text" NOT NULL,
    "restaurant_id" "uuid" NOT NULL,
    "booking_id" "uuid" NOT NULL,
    "customer_id" "uuid",
    "emitted_by" "text" DEFAULT 'server'::"text" NOT NULL,
    "payload" "jsonb" NOT NULL,
    "occurred_at" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."analytics_events" OWNER TO "postgres";


COMMENT ON TABLE "public"."analytics_events" IS 'Tracks booking-related analytics events for reporting and metrics.';



CREATE TABLE IF NOT EXISTS "public"."audit_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity" "text" NOT NULL,
    "entity_id" "text" NOT NULL,
    "action" "text" NOT NULL,
    "actor" "text",
    "metadata" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE ONLY "public"."audit_logs" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."audit_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."booking_assignment_attempts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "booking_id" "uuid" NOT NULL,
    "attempt_no" integer NOT NULL,
    "strategy" "text" NOT NULL,
    "result" "text" NOT NULL,
    "reason" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."booking_assignment_attempts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."booking_assignment_idempotency" (
    "booking_id" "uuid" NOT NULL,
    "idempotency_key" "text" NOT NULL,
    "table_ids" "uuid"[] DEFAULT '{}'::"uuid"[] NOT NULL,
    "assignment_window" "tstzrange" NOT NULL,
    "merge_group_allocation_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "table_set_hash" "text",
    "payload_checksum" "text" DEFAULT ''::"text" NOT NULL,
    "expires_at" timestamp with time zone
);

ALTER TABLE ONLY "public"."booking_assignment_idempotency" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."booking_assignment_idempotency" OWNER TO "postgres";


COMMENT ON TABLE "public"."booking_assignment_idempotency" IS 'Tracks idempotent table assignments to prevent duplicate allocations.';



COMMENT ON COLUMN "public"."booking_assignment_idempotency"."table_set_hash" IS 'MD5 hash of sorted table ids used to dedupe idempotency payloads.';



CREATE TABLE IF NOT EXISTS "public"."booking_confirmation_results" (
    "booking_id" "uuid" NOT NULL,
    "hold_id" "uuid" NOT NULL,
    "restaurant_id" "uuid" NOT NULL,
    "idempotency_key" "text" NOT NULL,
    "table_ids" "uuid"[] NOT NULL,
    "assignment_window" "tstzrange" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "actor_id" "uuid",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL
);


ALTER TABLE "public"."booking_confirmation_results" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."booking_occasions" (
    "key" "text" NOT NULL,
    "label" "text" NOT NULL,
    "short_label" "text" NOT NULL,
    "description" "text",
    "availability" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "default_duration_minutes" smallint DEFAULT 90 NOT NULL,
    "display_order" smallint DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "is_builtin" boolean DEFAULT false NOT NULL,
    "deleted_at" timestamp with time zone,
    "created_by" "uuid",
    "updated_by" "uuid",
    CONSTRAINT "booking_occasions_builtin_not_deleted" CHECK ((NOT ("is_builtin" AND ("deleted_at" IS NOT NULL))))
);


ALTER TABLE "public"."booking_occasions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."booking_occasions_audit" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "occasion_key" "text" NOT NULL,
    "action" "text" NOT NULL,
    "before_change" "jsonb",
    "after_change" "jsonb",
    "changed_by" "uuid",
    "changed_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."booking_occasions_audit" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."booking_slots" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "restaurant_id" "uuid" NOT NULL,
    "slot_date" "date" NOT NULL,
    "slot_time" time without time zone NOT NULL,
    "service_period_id" "uuid",
    "available_capacity" integer DEFAULT 0 NOT NULL,
    "reserved_count" integer DEFAULT 0 NOT NULL,
    "version" integer DEFAULT 1 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "booking_slots_available_capacity_positive" CHECK (("available_capacity" >= 0)),
    CONSTRAINT "booking_slots_capacity_valid" CHECK ((("reserved_count" >= 0) AND ("reserved_count" <= "available_capacity")))
);


ALTER TABLE "public"."booking_slots" OWNER TO "postgres";


COMMENT ON TABLE "public"."booking_slots" IS 'Pre-materialized time slots with capacity counters for fast availability checks. Created on-demand or pre-generated.';



COMMENT ON COLUMN "public"."booking_slots"."slot_date" IS 'Date of the slot (e.g., 2025-10-20)';



COMMENT ON COLUMN "public"."booking_slots"."slot_time" IS 'Time of the slot (e.g., 19:00). Typically 15/30/60 minute intervals.';



COMMENT ON COLUMN "public"."booking_slots"."service_period_id" IS 'Optional link to service period (lunch/dinner). Null if not applicable.';



COMMENT ON COLUMN "public"."booking_slots"."available_capacity" IS 'Maximum capacity for this slot (in covers/guests). Derived from capacity rules.';



COMMENT ON COLUMN "public"."booking_slots"."reserved_count" IS 'Number of covers/guests currently reserved for this slot.';



COMMENT ON COLUMN "public"."booking_slots"."version" IS 'Optimistic locking version. Incremented on each update to prevent race conditions.';



CREATE TABLE IF NOT EXISTS "public"."booking_state_history" (
    "id" bigint NOT NULL,
    "booking_id" "uuid" NOT NULL,
    "from_status" "public"."booking_status",
    "to_status" "public"."booking_status" NOT NULL,
    "changed_by" "uuid",
    "changed_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "reason" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL
);


ALTER TABLE "public"."booking_state_history" OWNER TO "postgres";


COMMENT ON TABLE "public"."booking_state_history" IS 'Audit history of booking lifecycle transitions.';



COMMENT ON COLUMN "public"."booking_state_history"."booking_id" IS 'Booking whose status transitioned.';



COMMENT ON COLUMN "public"."booking_state_history"."from_status" IS 'Previous lifecycle status.';



COMMENT ON COLUMN "public"."booking_state_history"."to_status" IS 'New lifecycle status.';



COMMENT ON COLUMN "public"."booking_state_history"."changed_by" IS 'User who triggered the change (null for system operations).';



COMMENT ON COLUMN "public"."booking_state_history"."changed_at" IS 'UTC timestamp when the transition was recorded.';



COMMENT ON COLUMN "public"."booking_state_history"."reason" IS 'Optional human-readable reason for the transition.';



COMMENT ON COLUMN "public"."booking_state_history"."metadata" IS 'Additional structured data describing the transition.';



CREATE SEQUENCE IF NOT EXISTS "public"."booking_state_history_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."booking_state_history_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."booking_state_history_id_seq" OWNED BY "public"."booking_state_history"."id";



CREATE TABLE IF NOT EXISTS "public"."booking_versions" (
    "version_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "booking_id" "uuid" NOT NULL,
    "restaurant_id" "uuid" NOT NULL,
    "change_type" "public"."booking_change_type" NOT NULL,
    "changed_by" "text",
    "changed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "old_data" "jsonb",
    "new_data" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."booking_versions" OWNER TO "postgres";


COMMENT ON TABLE "public"."booking_versions" IS 'Audit trail for booking changes with before/after snapshots.';



CREATE TABLE IF NOT EXISTS "public"."bookings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "restaurant_id" "uuid" NOT NULL,
    "customer_id" "uuid" NOT NULL,
    "booking_date" "date" NOT NULL,
    "start_time" time without time zone NOT NULL,
    "end_time" time without time zone NOT NULL,
    "start_at" timestamp with time zone,
    "end_at" timestamp with time zone,
    "party_size" integer NOT NULL,
    "seating_preference" "public"."seating_preference_type" DEFAULT 'any'::"public"."seating_preference_type" NOT NULL,
    "status" "public"."booking_status" DEFAULT 'confirmed'::"public"."booking_status" NOT NULL,
    "customer_name" "text" NOT NULL,
    "customer_email" "text" NOT NULL,
    "customer_phone" "text" NOT NULL,
    "notes" "text",
    "reference" "text" NOT NULL,
    "source" "text" DEFAULT 'web'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "booking_type" "text" DEFAULT 'dinner'::"text" NOT NULL,
    "idempotency_key" "text",
    "client_request_id" "text" DEFAULT ("gen_random_uuid"())::"text" NOT NULL,
    "pending_ref" "text",
    "details" "jsonb",
    "marketing_opt_in" boolean DEFAULT false NOT NULL,
    "confirmation_token" character varying(64),
    "confirmation_token_expires_at" timestamp with time zone,
    "confirmation_token_used_at" timestamp with time zone,
    "auth_user_id" "uuid",
    "checked_in_at" timestamp with time zone,
    "checked_out_at" timestamp with time zone,
    "loyalty_points_awarded" integer DEFAULT 0 NOT NULL,
    "assigned_zone_id" "uuid",
    "auto_assign_idempotency_key" "text",
    "auto_assign_last_result" "jsonb",
    "assignment_state_version" integer DEFAULT 1 NOT NULL,
    "assignment_strategy" "text",
    CONSTRAINT "bookings_checked_out_after_checked_in" CHECK ((("checked_out_at" IS NULL) OR ("checked_in_at" IS NULL) OR ("checked_out_at" >= "checked_in_at"))),
    CONSTRAINT "bookings_lifecycle_timestamp_consistency" CHECK (((("status" = ANY (ARRAY['pending'::"public"."booking_status", 'pending_allocation'::"public"."booking_status", 'confirmed'::"public"."booking_status"])) AND ("checked_in_at" IS NULL) AND ("checked_out_at" IS NULL)) OR (("status" = 'checked_in'::"public"."booking_status") AND ("checked_in_at" IS NOT NULL) AND ("checked_out_at" IS NULL)) OR (("status" = 'completed'::"public"."booking_status") AND ("checked_in_at" IS NOT NULL) AND ("checked_out_at" IS NOT NULL) AND ("checked_out_at" >= "checked_in_at")) OR ("status" = 'cancelled'::"public"."booking_status") OR (("status" = 'no_show'::"public"."booking_status") AND ("checked_in_at" IS NULL) AND ("checked_out_at" IS NULL)))),
    CONSTRAINT "bookings_party_size_check" CHECK (("party_size" > 0)),
    CONSTRAINT "chk_time_order" CHECK (("start_at" < "end_at"))
);


ALTER TABLE "public"."bookings" OWNER TO "postgres";


COMMENT ON TABLE "public"."bookings" IS 'Customer reservations with party size, time, and status';



COMMENT ON COLUMN "public"."bookings"."pending_ref" IS 'Temporary reference used while an asynchronous booking is pending confirmation. Should be NULL for finalized bookings.';



COMMENT ON COLUMN "public"."bookings"."confirmation_token" IS 'One-time cryptographic token (base64url, 64 chars) for guest confirmation page access. Expires in 1 hour.';



COMMENT ON COLUMN "public"."bookings"."confirmation_token_expires_at" IS 'Expiry timestamp for confirmation_token. After this time, token is invalid.';



COMMENT ON COLUMN "public"."bookings"."confirmation_token_used_at" IS 'Timestamp when confirmation_token was first used. Prevents token replay attacks.';



COMMENT ON COLUMN "public"."bookings"."auth_user_id" IS 'Optional link to the authenticated Supabase user that created or owns the booking.';



COMMENT ON COLUMN "public"."bookings"."checked_in_at" IS 'Timestamp when the guest was checked in by ops';



COMMENT ON COLUMN "public"."bookings"."checked_out_at" IS 'Timestamp when the guest was checked out by ops';



COMMENT ON COLUMN "public"."bookings"."assigned_zone_id" IS 'Zone enforced for all table assignments tied to the booking.';



COMMENT ON CONSTRAINT "bookings_checked_out_after_checked_in" ON "public"."bookings" IS 'Ensures recorded check-out timestamps are chronologically after check-in.';



COMMENT ON CONSTRAINT "bookings_lifecycle_timestamp_consistency" ON "public"."bookings" IS 'Ensures booking lifecycle timestamps align with the status (checked-in bookings must have check-in timestamps, completed bookings need both timestamps, etc).';



CREATE TABLE IF NOT EXISTS "public"."capacity_outbox" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "event_type" "text" NOT NULL,
    "dedupe_key" "text",
    "attempt_count" integer DEFAULT 0 NOT NULL,
    "next_attempt_at" timestamp with time zone,
    "restaurant_id" "uuid",
    "booking_id" "uuid",
    "idempotency_key" "text",
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    CONSTRAINT "capacity_outbox_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'done'::"text", 'dead'::"text"])))
);


ALTER TABLE "public"."capacity_outbox" OWNER TO "postgres";


COMMENT ON TABLE "public"."capacity_outbox" IS 'Outbox for reliable post-commit processing (sync, telemetry).';



CREATE TABLE IF NOT EXISTS "public"."customer_profiles" (
    "customer_id" "uuid" NOT NULL,
    "first_booking_at" timestamp with time zone,
    "last_booking_at" timestamp with time zone,
    "total_bookings" integer DEFAULT 0 NOT NULL,
    "total_covers" integer DEFAULT 0 NOT NULL,
    "total_cancellations" integer DEFAULT 0 NOT NULL,
    "marketing_opt_in" boolean DEFAULT false NOT NULL,
    "last_marketing_opt_in_at" timestamp with time zone,
    "preferences" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "notes" "text",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "customer_profiles_total_bookings_check" CHECK (("total_bookings" >= 0)),
    CONSTRAINT "customer_profiles_total_cancellations_check" CHECK (("total_cancellations" >= 0)),
    CONSTRAINT "customer_profiles_total_covers_check" CHECK (("total_covers" >= 0))
);


ALTER TABLE "public"."customer_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."customers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "restaurant_id" "uuid" NOT NULL,
    "full_name" "text" NOT NULL,
    "email" "text" NOT NULL,
    "phone" "text" NOT NULL,
    "email_normalized" "text" GENERATED ALWAYS AS ("lower"(TRIM(BOTH FROM "email"))) STORED,
    "phone_normalized" "text" GENERATED ALWAYS AS ("regexp_replace"("phone", '[^0-9]+'::"text", ''::"text", 'g'::"text")) STORED,
    "marketing_opt_in" boolean DEFAULT false NOT NULL,
    "auth_user_id" "uuid",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "user_profile_id" "uuid",
    CONSTRAINT "customers_email_check" CHECK (("email" = "lower"("email"))),
    CONSTRAINT "customers_phone_check" CHECK ((("length"("phone") >= 7) AND ("length"("phone") <= 20)))
);


ALTER TABLE "public"."customers" OWNER TO "postgres";


COMMENT ON TABLE "public"."customers" IS 'Guest profiles with contact details';



COMMENT ON COLUMN "public"."customers"."user_profile_id" IS 'Optional foreign key to global user_profiles identity.';



CREATE TABLE IF NOT EXISTS "public"."demand_profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "restaurant_id" "uuid" NOT NULL,
    "day_of_week" smallint NOT NULL,
    "service_window" "text" NOT NULL,
    "multiplier" numeric(3,2) DEFAULT 1.0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "start_minute" integer,
    "end_minute" integer,
    "priority" integer DEFAULT 1,
    CONSTRAINT "demand_profiles_check" CHECK ((("end_minute" > "start_minute") AND ("end_minute" <= 1440))),
    CONSTRAINT "demand_profiles_day_of_week_check" CHECK ((("day_of_week" >= 0) AND ("day_of_week" <= 6))),
    CONSTRAINT "demand_profiles_multiplier_check" CHECK ((("multiplier" >= 0.1) AND ("multiplier" <= 10.0))),
    CONSTRAINT "demand_profiles_priority_check" CHECK (("priority" >= 1)),
    CONSTRAINT "demand_profiles_service_window_check" CHECK (("service_window" = ANY (ARRAY['lunch'::"text", 'drinks'::"text", 'dinner'::"text", 'christmas_party'::"text", 'curry_and_carols'::"text"]))),
    CONSTRAINT "demand_profiles_start_minute_check" CHECK ((("start_minute" >= 0) AND ("start_minute" < 1440)))
);


ALTER TABLE "public"."demand_profiles" OWNER TO "postgres";


COMMENT ON TABLE "public"."demand_profiles" IS 'Configures dynamic pricing multipliers by day of week and service window.';



CREATE TABLE IF NOT EXISTS "public"."email_delivery_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "booking_id" "uuid",
    "restaurant_id" "uuid",
    "email_type" "text",
    "template_type" "text",
    "recipient_email" "text" NOT NULL,
    "message_id" "text" NOT NULL,
    "status" "text" NOT NULL,
    "provider" "text",
    "provider_event_id" "text",
    "occurred_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "error" "text",
    "metadata" "jsonb",
    CONSTRAINT "email_delivery_log_status_check" CHECK (("status" = ANY (ARRAY['sent'::"text", 'delivered'::"text", 'delivery_delayed'::"text", 'bounced'::"text", 'complained'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."email_delivery_log" OWNER TO "postgres";


COMMENT ON TABLE "public"."email_delivery_log" IS 'Tracks outbound email delivery events and webhook updates.';



CREATE TABLE IF NOT EXISTS "public"."feature_flag_overrides" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "flag" "text" NOT NULL,
    "environment" "text" NOT NULL,
    "value" boolean NOT NULL,
    "notes" "jsonb",
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_by" "uuid"
);

ALTER TABLE ONLY "public"."feature_flag_overrides" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."feature_flag_overrides" OWNER TO "postgres";


COMMENT ON TABLE "public"."feature_flag_overrides" IS 'Runtime feature flag overrides per environment.';



CREATE TABLE IF NOT EXISTS "public"."leads" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."leads" OWNER TO "postgres";


COMMENT ON TABLE "public"."leads" IS 'Marketing email leads for newsletter signups.';



CREATE TABLE IF NOT EXISTS "public"."manual_assignment_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "booking_id" "uuid" NOT NULL,
    "restaurant_id" "uuid" NOT NULL,
    "state" "public"."manual_assignment_session_state" DEFAULT 'none'::"public"."manual_assignment_session_state" NOT NULL,
    "selection" "jsonb",
    "selection_version" integer DEFAULT 0 NOT NULL,
    "context_version" "text",
    "policy_version" "text",
    "snapshot_hash" "text",
    "hold_id" "uuid",
    "expires_at" timestamp with time zone,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "table_version" "text",
    "adjacency_version" "text",
    "flags_version" "text",
    "window_version" "text",
    "holds_version" "text",
    "assignments_version" "text"
);


ALTER TABLE "public"."manual_assignment_sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."merge_rules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "from_a" smallint NOT NULL,
    "from_b" smallint NOT NULL,
    "to_capacity" smallint NOT NULL,
    "enabled" boolean DEFAULT true NOT NULL,
    "require_same_zone" boolean DEFAULT true NOT NULL,
    "require_adjacency" boolean DEFAULT true NOT NULL,
    "cross_category_merge" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "merge_rules_positive" CHECK ((("from_a" > 0) AND ("from_b" > 0) AND ("to_capacity" > 0)))
);


ALTER TABLE "public"."merge_rules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."observability_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "source" "text" NOT NULL,
    "event_type" "text" NOT NULL,
    "severity" "text" DEFAULT 'info'::"text" NOT NULL,
    "context" "jsonb",
    "restaurant_id" "uuid",
    "booking_id" "uuid",
    CONSTRAINT "observability_events_severity_check" CHECK (("severity" = ANY (ARRAY['info'::"text", 'warning'::"text", 'error'::"text", 'critical'::"text"])))
);


ALTER TABLE "public"."observability_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profile_update_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "idempotency_key" "text" NOT NULL,
    "payload_hash" "text" NOT NULL,
    "applied_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."profile_update_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "email" "text",
    "name" "text",
    "phone" "text",
    "image" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "has_access" boolean DEFAULT true NOT NULL,
    CONSTRAINT "profiles_email_check" CHECK (("email" = "lower"("email")))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


COMMENT ON COLUMN "public"."profiles"."has_access" IS 'Indicates whether the profile retains active access to Ops surfaces.';



CREATE TABLE IF NOT EXISTS "public"."restaurant_capacity_rules" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "restaurant_id" "uuid" NOT NULL,
    "service_period_id" "uuid",
    "day_of_week" smallint,
    "effective_date" "date",
    "max_covers" integer,
    "max_parties" integer,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "label" "text",
    "override_type" "public"."capacity_override_type",
    CONSTRAINT "restaurant_capacity_rules_non_negative" CHECK (((("max_covers" IS NULL) OR ("max_covers" >= 0)) AND (("max_parties" IS NULL) OR ("max_parties" >= 0)))),
    CONSTRAINT "restaurant_capacity_rules_scope" CHECK ((("service_period_id" IS NOT NULL) OR ("day_of_week" IS NOT NULL) OR ("effective_date" IS NOT NULL)))
);


ALTER TABLE "public"."restaurant_capacity_rules" OWNER TO "postgres";


COMMENT ON COLUMN "public"."restaurant_capacity_rules"."label" IS 'Human-friendly name for this capacity rule or override (e.g., “Christmas Eve Dinner”).';



COMMENT ON COLUMN "public"."restaurant_capacity_rules"."override_type" IS 'Categorizes overrides (holiday, event, manual adjustments, emergencies).';



CREATE TABLE IF NOT EXISTS "public"."restaurant_invites" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "restaurant_id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "email_normalized" "text" GENERATED ALWAYS AS ("lower"(TRIM(BOTH FROM "email"))) STORED,
    "role" "text" NOT NULL,
    "token_hash" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "invited_by" "uuid",
    "accepted_at" timestamp with time zone,
    "revoked_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "restaurant_invites_role_check" CHECK (("role" = ANY (ARRAY['owner'::"text", 'manager'::"text", 'host'::"text", 'server'::"text"]))),
    CONSTRAINT "restaurant_invites_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'accepted'::"text", 'revoked'::"text", 'expired'::"text"])))
);


ALTER TABLE "public"."restaurant_invites" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."restaurant_memberships" (
    "user_id" "uuid" NOT NULL,
    "restaurant_id" "uuid" NOT NULL,
    "role" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "restaurant_memberships_role_check" CHECK (("role" = ANY (ARRAY['owner'::"text", 'manager'::"text", 'host'::"text", 'server'::"text"])))
);


ALTER TABLE "public"."restaurant_memberships" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."restaurant_operating_hours" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "restaurant_id" "uuid" NOT NULL,
    "day_of_week" smallint,
    "effective_date" "date",
    "opens_at" time without time zone,
    "closes_at" time without time zone,
    "is_closed" boolean DEFAULT false NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "reservation_interval_minutes" integer,
    "reservation_slot_times" "text"[],
    CONSTRAINT "restaurant_operating_hours_scope" CHECK ((("day_of_week" IS NOT NULL) OR ("effective_date" IS NOT NULL))),
    CONSTRAINT "restaurant_operating_hours_time_order" CHECK (("is_closed" OR (("opens_at" IS NOT NULL) AND ("closes_at" IS NOT NULL) AND ("opens_at" < "closes_at"))))
);


ALTER TABLE "public"."restaurant_operating_hours" OWNER TO "postgres";


COMMENT ON COLUMN "public"."restaurant_operating_hours"."reservation_interval_minutes" IS 'Optional per-day reservation interval override (minutes).';



COMMENT ON COLUMN "public"."restaurant_operating_hours"."reservation_slot_times" IS 'Optional fixed reservation slot times (HH:MM) for the day; overrides interval when set.';



CREATE TABLE IF NOT EXISTS "public"."restaurant_service_periods" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "restaurant_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "day_of_week" smallint,
    "start_time" time without time zone NOT NULL,
    "end_time" time without time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "booking_option" "text" DEFAULT 'drinks'::"text" NOT NULL,
    CONSTRAINT "restaurant_service_periods_time_order" CHECK (("start_time" < "end_time"))
);


ALTER TABLE "public"."restaurant_service_periods" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."restaurant_turn_bands" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "restaurant_id" "uuid" NOT NULL,
    "booking_option" "text" NOT NULL,
    "max_party_size" integer NOT NULL,
    "duration_minutes" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "restaurant_turn_bands_duration_minutes_check" CHECK ((("duration_minutes" > 0) AND ("duration_minutes" <= 1440))),
    CONSTRAINT "restaurant_turn_bands_max_party_size_check" CHECK (("max_party_size" > 0))
);


ALTER TABLE "public"."restaurant_turn_bands" OWNER TO "postgres";


COMMENT ON TABLE "public"."restaurant_turn_bands" IS 'Party-size-based reservation durations per restaurant and booking option.';



COMMENT ON COLUMN "public"."restaurant_turn_bands"."restaurant_id" IS 'Restaurant the turn bands apply to.';



COMMENT ON COLUMN "public"."restaurant_turn_bands"."booking_option" IS 'Booking option key (e.g., lunch, dinner, tasting).';



COMMENT ON COLUMN "public"."restaurant_turn_bands"."max_party_size" IS 'Upper bound of the party size for this duration band.';



COMMENT ON COLUMN "public"."restaurant_turn_bands"."duration_minutes" IS 'Duration in minutes for the party size band.';



CREATE TABLE IF NOT EXISTS "public"."restaurants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "timezone" "text" DEFAULT 'Europe/London'::"text" NOT NULL,
    "capacity" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "contact_email" "text",
    "contact_phone" "text",
    "address" "text",
    "booking_policy" "text",
    "reservation_interval_minutes" integer DEFAULT 15 NOT NULL,
    "reservation_default_duration_minutes" integer DEFAULT 90 NOT NULL,
    "reservation_last_seating_buffer_minutes" integer DEFAULT 120 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "logo_url" "text",
    "email_send_reminder_24h" boolean DEFAULT true NOT NULL,
    "email_send_reminder_short" boolean DEFAULT true NOT NULL,
    "email_send_review_request" boolean DEFAULT true NOT NULL,
    "google_map_url" "text",
    "reservation_lifecycle_grace_minutes" integer DEFAULT 15,
    "google_review_url" "text",
    "email_templates" "jsonb",
    CONSTRAINT "restaurants_capacity_check" CHECK ((("capacity" IS NULL) OR ("capacity" > 0))),
    CONSTRAINT "restaurants_reservation_default_duration_minutes_check" CHECK ((("reservation_default_duration_minutes" >= 15) AND ("reservation_default_duration_minutes" <= 300))),
    CONSTRAINT "restaurants_reservation_interval_minutes_check" CHECK ((("reservation_interval_minutes" > 0) AND ("reservation_interval_minutes" <= 180))),
    CONSTRAINT "restaurants_reservation_last_seating_buffer_minutes_check" CHECK ((("reservation_last_seating_buffer_minutes" >= 15) AND ("reservation_last_seating_buffer_minutes" <= 300))),
    CONSTRAINT "restaurants_slug_check" CHECK (("slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'::"text"))
);


ALTER TABLE "public"."restaurants" OWNER TO "postgres";


COMMENT ON TABLE "public"."restaurants" IS 'Restaurant entities with timezone and capacity configuration';



COMMENT ON COLUMN "public"."restaurants"."timezone" IS 'Timezone of the restaurant (e.g., ''America/New_York''). Non-nullable, defaults to ''Europe/London''.';



COMMENT ON COLUMN "public"."restaurants"."reservation_last_seating_buffer_minutes" IS 'Minimum minutes before closing when the final reservation may start.';



COMMENT ON COLUMN "public"."restaurants"."is_active" IS 'Indicates whether the restaurant is active and should surface in public experiences.';



COMMENT ON COLUMN "public"."restaurants"."logo_url" IS 'Publicly accessible logo URL used in outbound communications.';



COMMENT ON COLUMN "public"."restaurants"."reservation_lifecycle_grace_minutes" IS 'Grace period in minutes for reservation lifecycle state transitions (check-in, no-show, etc.)';



COMMENT ON COLUMN "public"."restaurants"."google_review_url" IS 'Google Review URL for post-dining review request emails';



COMMENT ON COLUMN "public"."restaurants"."email_templates" IS 'Custom email templates overriding system defaults. Keyed by email type (e.g., "created", "reminder").';



CREATE TABLE IF NOT EXISTS "public"."service_policy" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "lunch_start" time without time zone DEFAULT '12:00:00'::time without time zone NOT NULL,
    "lunch_end" time without time zone DEFAULT '15:00:00'::time without time zone NOT NULL,
    "dinner_start" time without time zone DEFAULT '17:00:00'::time without time zone NOT NULL,
    "dinner_end" time without time zone DEFAULT '22:00:00'::time without time zone NOT NULL,
    "clean_buffer_minutes" smallint DEFAULT 5 NOT NULL,
    "allow_after_hours" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."service_policy" OWNER TO "postgres";


COMMENT ON COLUMN "public"."service_policy"."allow_after_hours" IS 'If true, privileged staff may override standard operating hours when creating bookings.';



CREATE TABLE IF NOT EXISTS "public"."strategic_configs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "restaurant_id" "uuid",
    "updated_by" "uuid",
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "scarcity_weight" numeric(8,2) DEFAULT 22 NOT NULL,
    "demand_multiplier_override" numeric(8,3),
    "future_conflict_penalty" numeric(10,2)
);


ALTER TABLE "public"."strategic_configs" OWNER TO "postgres";


COMMENT ON TABLE "public"."strategic_configs" IS 'Restaurant-specific strategic planner configuration.';



CREATE TABLE IF NOT EXISTS "public"."table_adjacencies" (
    "table_a" "uuid" NOT NULL,
    "table_b" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "table_adjacencies_not_equal" CHECK (("table_a" <> "table_b"))
);


ALTER TABLE "public"."table_adjacencies" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."table_hold_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "hold_id" "uuid" NOT NULL,
    "table_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."table_hold_members" OWNER TO "postgres";


COMMENT ON TABLE "public"."table_hold_members" IS 'Junction table linking table holds to specific tables.';



CREATE TABLE IF NOT EXISTS "public"."table_hold_windows" (
    "hold_id" "uuid" NOT NULL,
    "table_id" "uuid" NOT NULL,
    "restaurant_id" "uuid" NOT NULL,
    "booking_id" "uuid",
    "start_at" timestamp with time zone NOT NULL,
    "end_at" timestamp with time zone NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "hold_window" "tstzrange" GENERATED ALWAYS AS ("tstzrange"("start_at", "end_at", '[)'::"text")) STORED
);

ALTER TABLE ONLY "public"."table_hold_windows" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."table_hold_windows" OWNER TO "postgres";


COMMENT ON TABLE "public"."table_hold_windows" IS 'Denormalized view for fast conflict detection on table holds.';



CREATE TABLE IF NOT EXISTS "public"."table_holds" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "restaurant_id" "uuid" NOT NULL,
    "booking_id" "uuid",
    "zone_id" "uuid" NOT NULL,
    "start_at" timestamp with time zone NOT NULL,
    "end_at" timestamp with time zone NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "metadata" "jsonb",
    "session_id" "uuid",
    "status" "public"."table_hold_status" DEFAULT 'active'::"public"."table_hold_status" NOT NULL,
    "last_touched_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "table_holds_window_check" CHECK (("start_at" < "end_at")),
    CONSTRAINT "th_times_consistent" CHECK (("expires_at" >= "end_at"))
);


ALTER TABLE "public"."table_holds" OWNER TO "postgres";


COMMENT ON TABLE "public"."table_holds" IS 'Ephemeral table reservations to guard allocations during quoting/confirmation flows.';



CREATE TABLE IF NOT EXISTS "public"."table_inventory" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "restaurant_id" "uuid" NOT NULL,
    "table_number" "text" NOT NULL,
    "capacity" integer NOT NULL,
    "section" "text",
    "status" "public"."table_status" DEFAULT 'available'::"public"."table_status" NOT NULL,
    "position" "jsonb",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "zone_id" "uuid" NOT NULL,
    "category" "public"."table_category" NOT NULL,
    "seating_type" "public"."table_seating_type" DEFAULT 'standard'::"public"."table_seating_type" NOT NULL,
    "mobility" "public"."table_mobility" DEFAULT 'movable'::"public"."table_mobility" NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "min_party_size" integer DEFAULT 1 NOT NULL,
    "max_party_size" integer,
    CONSTRAINT "table_inventory_min_party_positive" CHECK (("min_party_size" > 0)),
    CONSTRAINT "table_inventory_valid_party_range" CHECK ((("max_party_size" IS NULL) OR ("max_party_size" >= "min_party_size")))
);


ALTER TABLE "public"."table_inventory" OWNER TO "postgres";


COMMENT ON TABLE "public"."table_inventory" IS 'Physical table inventory. Party size rules are derived from mobility and capacity in application code.';



COMMENT ON COLUMN "public"."table_inventory"."table_number" IS 'Display name for the table (e.g., "T1", "Main-5", "Patio-2")';



COMMENT ON COLUMN "public"."table_inventory"."capacity" IS 'Physical property: number of seats. For fixed tables, this is also the max party size.';



COMMENT ON COLUMN "public"."table_inventory"."section" IS 'Section name (e.g., "Main Floor", "Patio", "Bar Area", "Private Room")';



COMMENT ON COLUMN "public"."table_inventory"."status" IS 'Current status: available, reserved, occupied, out_of_service';



COMMENT ON COLUMN "public"."table_inventory"."position" IS 'Floor plan position as JSON: {x: number, y: number, rotation?: number} for drag-and-drop UI';



COMMENT ON COLUMN "public"."table_inventory"."mobility" IS 'Physical property: whether table can be moved. Business rules are derived from this:
  - movable: can be merged with other tables (unlimited party size when combined)
  - fixed: cannot be merged (strict party size = capacity)';



COMMENT ON COLUMN "public"."table_inventory"."min_party_size" IS 'Minimum party size for this table (e.g., 2-top only for parties of 2+)';



COMMENT ON COLUMN "public"."table_inventory"."max_party_size" IS 'Optional maximum party size for this table; NULL means derive from capacity/mobility.';



CREATE TABLE IF NOT EXISTS "public"."table_merge_graph" (
    "restaurant_id" "uuid" NOT NULL,
    "table_a" "uuid" NOT NULL,
    "table_b" "uuid" NOT NULL,
    "merge_score" integer DEFAULT 0,
    "notes" "text",
    "created_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp without time zone DEFAULT "now"(),
    "status" "text" DEFAULT 'pending'::"text" NOT NULL
);


ALTER TABLE "public"."table_merge_graph" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."table_scarcity_metrics" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "restaurant_id" "uuid" NOT NULL,
    "table_type" "text" NOT NULL,
    "scarcity_score" numeric(5,4) NOT NULL,
    "computed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "table_scarcity_metrics_scarcity_score_check" CHECK ((("scarcity_score" >= (0)::numeric) AND ("scarcity_score" <= (1)::numeric)))
);


ALTER TABLE "public"."table_scarcity_metrics" OWNER TO "postgres";


COMMENT ON TABLE "public"."table_scarcity_metrics" IS 'Pre-computed scarcity scores for table types to optimize assignment.';



CREATE TABLE IF NOT EXISTS "public"."table_soft_holds" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "table_id" "uuid" NOT NULL,
    "hold_window" "tstzrange" NOT NULL,
    "session_token" "uuid" NOT NULL,
    "restaurant_id" "uuid" NOT NULL,
    "booking_id" "uuid",
    "expires_at" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."table_soft_holds" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_profiles" (
    "id" "uuid" NOT NULL,
    "name" "text",
    "phone" "text",
    "marketing_opt_in" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "is_email_suppressed" boolean DEFAULT false NOT NULL,
    CONSTRAINT "user_profiles_phone_e164_check" CHECK ((("phone" IS NULL) OR ("phone" ~ '^\\+[1-9]\\d{1,14}$'::"text")))
);


ALTER TABLE "public"."user_profiles" OWNER TO "postgres";


COMMENT ON TABLE "public"."user_profiles" IS 'Global customer identity (1:1 with auth.users).';



COMMENT ON COLUMN "public"."user_profiles"."phone" IS 'User phone number stored in E.164 format (leading + and digits only).';



COMMENT ON COLUMN "public"."user_profiles"."is_email_suppressed" IS 'If true, no emails (transactional or marketing) should be sent to this user. Set by webhook on bounce, spam complaint, or unsubscribe.';



CREATE TABLE IF NOT EXISTS "public"."waiting_list" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "restaurant_id" "uuid" NOT NULL,
    "booking_date" "date" NOT NULL,
    "desired_time" time without time zone NOT NULL,
    "party_size" integer NOT NULL,
    "seating_preference" "public"."seating_preference_type" DEFAULT 'any'::"public"."seating_preference_type" NOT NULL,
    "customer_name" "text" NOT NULL,
    "customer_email" "text" NOT NULL,
    "customer_phone" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "waiting_list_party_size_check" CHECK (("party_size" > 0))
);


ALTER TABLE "public"."waiting_list" OWNER TO "postgres";


COMMENT ON TABLE "public"."waiting_list" IS 'Customers waiting for availability on fully booked dates/times.';



CREATE TABLE IF NOT EXISTS "public"."zone_floorplan_edit_locks" (
    "zone_id" "uuid" NOT NULL,
    "restaurant_id" "uuid" NOT NULL,
    "locked_by" "uuid" NOT NULL,
    "locked_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "heartbeat_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone NOT NULL
);


ALTER TABLE "public"."zone_floorplan_edit_locks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."zone_floorplan_layout_versions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "restaurant_id" "uuid" NOT NULL,
    "zone_id" "uuid" NOT NULL,
    "version" integer NOT NULL,
    "schema_version" integer DEFAULT 1 NOT NULL,
    "payload" "jsonb" NOT NULL,
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "restored_from" "uuid"
);


ALTER TABLE "public"."zone_floorplan_layout_versions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."zones" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "restaurant_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "sort_order" smallint DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    CONSTRAINT "zones_name_not_blank" CHECK (("char_length"(TRIM(BOTH FROM "name")) > 0))
);


ALTER TABLE "public"."zones" OWNER TO "postgres";


COMMENT ON TABLE "public"."zones" IS 'Dining zones within restaurants (e.g., Dining 1, Dining 2)';



COMMENT ON COLUMN "public"."zones"."active" IS 'Indicates whether the zone is currently in service';



ALTER TABLE ONLY "public"."_migrations" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."_migrations_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."booking_state_history" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."booking_state_history_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."_migrations"
    ADD CONSTRAINT "_migrations_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."_migrations"
    ADD CONSTRAINT "_migrations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."allocations_archive"
    ADD CONSTRAINT "allocations_archive_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."allocations"
    ADD CONSTRAINT "allocations_booking_resource_key" UNIQUE ("booking_id", "resource_type", "resource_id");



ALTER TABLE ONLY "public"."allocations"
    ADD CONSTRAINT "allocations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."allowed_capacities"
    ADD CONSTRAINT "allowed_capacities_pkey" PRIMARY KEY ("restaurant_id", "capacity");



ALTER TABLE ONLY "public"."analytics_events"
    ADD CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."booking_assignment_attempts"
    ADD CONSTRAINT "booking_assignment_attempts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."booking_assignment_idempotency"
    ADD CONSTRAINT "booking_assignment_idempotency_pkey" PRIMARY KEY ("booking_id", "idempotency_key");



ALTER TABLE ONLY "public"."booking_confirmation_results"
    ADD CONSTRAINT "booking_confirmation_results_hold_id_key" UNIQUE ("hold_id");



ALTER TABLE ONLY "public"."booking_confirmation_results"
    ADD CONSTRAINT "booking_confirmation_results_pkey" PRIMARY KEY ("booking_id", "idempotency_key");



ALTER TABLE ONLY "public"."booking_occasions_audit"
    ADD CONSTRAINT "booking_occasions_audit_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."booking_occasions"
    ADD CONSTRAINT "booking_occasions_pkey" PRIMARY KEY ("key");



ALTER TABLE ONLY "public"."booking_slots"
    ADD CONSTRAINT "booking_slots_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."booking_slots"
    ADD CONSTRAINT "booking_slots_restaurant_slot_key" UNIQUE ("restaurant_id", "slot_date", "slot_time");



ALTER TABLE ONLY "public"."booking_state_history"
    ADD CONSTRAINT "booking_state_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."booking_table_assignments"
    ADD CONSTRAINT "booking_table_assignments_booking_table_key" UNIQUE ("booking_id", "table_id");



ALTER TABLE ONLY "public"."booking_table_assignments"
    ADD CONSTRAINT "booking_table_assignments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."booking_table_assignments"
    ADD CONSTRAINT "booking_table_assignments_table_id_slot_id_key" UNIQUE ("table_id", "slot_id");



ALTER TABLE ONLY "public"."booking_versions"
    ADD CONSTRAINT "booking_versions_pkey" PRIMARY KEY ("version_id");



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_confirmation_token_unique" UNIQUE ("confirmation_token");



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_reference_key" UNIQUE ("reference");



ALTER TABLE ONLY "public"."capacity_outbox"
    ADD CONSTRAINT "capacity_outbox_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."customer_profiles"
    ADD CONSTRAINT "customer_profiles_pkey" PRIMARY KEY ("customer_id");



ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_restaurant_email_phone_key" UNIQUE ("restaurant_id", "email_normalized", "phone_normalized");



ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_restaurant_id_email_normalized_key" UNIQUE ("restaurant_id", "email_normalized");



ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_restaurant_id_phone_normalized_key" UNIQUE ("restaurant_id", "phone_normalized");



ALTER TABLE ONLY "public"."demand_profiles"
    ADD CONSTRAINT "demand_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."email_delivery_log"
    ADD CONSTRAINT "email_delivery_log_message_recipient_status_key" UNIQUE ("message_id", "recipient_email", "status");



ALTER TABLE ONLY "public"."email_delivery_log"
    ADD CONSTRAINT "email_delivery_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."feature_flag_overrides"
    ADD CONSTRAINT "feature_flag_overrides_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."feature_flag_overrides"
    ADD CONSTRAINT "feature_flag_overrides_unique_flag_env" UNIQUE ("flag", "environment");



ALTER TABLE ONLY "public"."leads"
    ADD CONSTRAINT "leads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."manual_assignment_sessions"
    ADD CONSTRAINT "manual_assignment_sessions_booking_id_key" UNIQUE ("booking_id");



ALTER TABLE ONLY "public"."manual_assignment_sessions"
    ADD CONSTRAINT "manual_assignment_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."merge_rules"
    ADD CONSTRAINT "merge_rules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."observability_events"
    ADD CONSTRAINT "observability_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profile_update_requests"
    ADD CONSTRAINT "profile_update_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."restaurant_capacity_rules"
    ADD CONSTRAINT "restaurant_capacity_rules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."restaurant_invites"
    ADD CONSTRAINT "restaurant_invites_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."restaurant_memberships"
    ADD CONSTRAINT "restaurant_memberships_pkey" PRIMARY KEY ("user_id", "restaurant_id");



ALTER TABLE ONLY "public"."restaurant_operating_hours"
    ADD CONSTRAINT "restaurant_operating_hours_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."restaurant_service_periods"
    ADD CONSTRAINT "restaurant_service_periods_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."restaurant_turn_bands"
    ADD CONSTRAINT "restaurant_turn_bands_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."restaurants"
    ADD CONSTRAINT "restaurants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."restaurants"
    ADD CONSTRAINT "restaurants_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."service_policy"
    ADD CONSTRAINT "service_policy_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."strategic_configs"
    ADD CONSTRAINT "strategic_configs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."strategic_configs"
    ADD CONSTRAINT "strategic_configs_restaurant_id_key" UNIQUE ("restaurant_id");



ALTER TABLE ONLY "public"."table_adjacencies"
    ADD CONSTRAINT "table_adjacencies_pkey" PRIMARY KEY ("table_a", "table_b");



ALTER TABLE ONLY "public"."table_hold_members"
    ADD CONSTRAINT "table_hold_members_hold_id_table_id_key" UNIQUE ("hold_id", "table_id");



ALTER TABLE ONLY "public"."table_hold_members"
    ADD CONSTRAINT "table_hold_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."table_hold_windows"
    ADD CONSTRAINT "table_hold_windows_pkey" PRIMARY KEY ("hold_id", "table_id");



ALTER TABLE ONLY "public"."table_holds"
    ADD CONSTRAINT "table_holds_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."table_inventory"
    ADD CONSTRAINT "table_inventory_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."table_inventory"
    ADD CONSTRAINT "table_inventory_restaurant_id_table_number_key" UNIQUE ("restaurant_id", "table_number");



ALTER TABLE ONLY "public"."table_scarcity_metrics"
    ADD CONSTRAINT "table_scarcity_metrics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."table_soft_holds"
    ADD CONSTRAINT "table_soft_holds_no_overlap" EXCLUDE USING "gist" ("table_id" WITH =, "hold_window" WITH &&);



ALTER TABLE ONLY "public"."table_soft_holds"
    ADD CONSTRAINT "table_soft_holds_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."table_scarcity_metrics"
    ADD CONSTRAINT "unique_restaurant_table_type" UNIQUE ("restaurant_id", "table_type");



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."waiting_list"
    ADD CONSTRAINT "waiting_list_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."zone_floorplan_edit_locks"
    ADD CONSTRAINT "zone_floorplan_edit_locks_pkey" PRIMARY KEY ("zone_id");



ALTER TABLE ONLY "public"."zone_floorplan_layout_versions"
    ADD CONSTRAINT "zone_floorplan_layout_versions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."zone_floorplan_layout_versions"
    ADD CONSTRAINT "zone_floorplan_layout_versions_zone_version_uniq" UNIQUE ("zone_id", "version");



ALTER TABLE ONLY "public"."zones"
    ADD CONSTRAINT "zones_pkey" PRIMARY KEY ("id");



CREATE INDEX "allocations_archive_booking_idx" ON "public"."allocations_archive" USING "btree" ("booking_id");



CREATE INDEX "allocations_archive_restaurant_idx" ON "public"."allocations_archive" USING "btree" ("restaurant_id");



CREATE UNIQUE INDEX "booking_assignment_attempts_booking_attempt_idx" ON "public"."booking_assignment_attempts" USING "btree" ("booking_id", "attempt_no");



CREATE INDEX "booking_assignment_attempts_booking_created_idx" ON "public"."booking_assignment_attempts" USING "btree" ("booking_id", "created_at" DESC);



CREATE UNIQUE INDEX "booking_assignment_idempotency_booking_hash_key" ON "public"."booking_assignment_idempotency" USING "btree" ("booking_id", "table_set_hash") WHERE ("table_set_hash" IS NOT NULL);



CREATE INDEX "booking_assignment_idempotency_created_idx" ON "public"."booking_assignment_idempotency" USING "btree" ("created_at" DESC);



CREATE INDEX "booking_confirmation_results_created_idx" ON "public"."booking_confirmation_results" USING "btree" ("created_at" DESC);



CREATE INDEX "booking_occasions_active_idx" ON "public"."booking_occasions" USING "btree" ("is_active", "deleted_at") WHERE ("deleted_at" IS NULL);



CREATE INDEX "booking_occasions_audit_key_idx" ON "public"."booking_occasions_audit" USING "btree" ("occasion_key");



CREATE INDEX "booking_occasions_display_order_idx" ON "public"."booking_occasions" USING "btree" ("display_order");



CREATE INDEX "booking_table_assignments_merge_group_idx" ON "public"."booking_table_assignments" USING "btree" ("merge_group_id");



CREATE INDEX "bookings_restaurant_date_status_idx" ON "public"."bookings" USING "btree" ("restaurant_id", "booking_date", "status");



CREATE INDEX "bta_table_id_idx" ON "public"."booking_table_assignments" USING "btree" ("table_id");



CREATE INDEX "bta_window_gist" ON "public"."booking_table_assignments" USING "gist" ("assignment_window");



CREATE INDEX "capacity_outbox_booking_idx" ON "public"."capacity_outbox" USING "btree" ("booking_id");



CREATE UNIQUE INDEX "capacity_outbox_dedupe" ON "public"."capacity_outbox" USING "btree" ("event_type", COALESCE("dedupe_key", ''::"text"), COALESCE("idempotency_key", ''::"text")) WHERE ("status" = ANY (ARRAY['pending'::"text", 'processing'::"text"]));



CREATE INDEX "capacity_outbox_dispatch_idx" ON "public"."capacity_outbox" USING "btree" ("status", "next_attempt_at");



CREATE INDEX "capacity_outbox_restaurant_idx" ON "public"."capacity_outbox" USING "btree" ("restaurant_id");



CREATE UNIQUE INDEX "customers_restaurant_id_user_profile_id_unique" ON "public"."customers" USING "btree" ("restaurant_id", "user_profile_id") WHERE ("user_profile_id" IS NOT NULL);



CREATE INDEX "email_delivery_log_booking_id_idx" ON "public"."email_delivery_log" USING "btree" ("booking_id");



CREATE INDEX "email_delivery_log_message_id_idx" ON "public"."email_delivery_log" USING "btree" ("message_id");



CREATE INDEX "email_delivery_log_occurred_at_idx" ON "public"."email_delivery_log" USING "btree" ("occurred_at" DESC);



CREATE INDEX "email_delivery_log_restaurant_id_idx" ON "public"."email_delivery_log" USING "btree" ("restaurant_id");



CREATE INDEX "email_delivery_log_restaurant_occurred_at_id_idx" ON "public"."email_delivery_log" USING "btree" ("restaurant_id", "occurred_at" DESC, "id" DESC);



CREATE INDEX "idx_allocations_created_by" ON "public"."allocations" USING "btree" ("created_by");



CREATE INDEX "idx_allocations_restaurant" ON "public"."allocations" USING "btree" ("restaurant_id");



CREATE INDEX "idx_allocations_window_gist" ON "public"."allocations" USING "gist" ("window");



CREATE INDEX "idx_analytics_events_booking_id" ON "public"."analytics_events" USING "btree" ("booking_id");



CREATE INDEX "idx_analytics_events_customer_id" ON "public"."analytics_events" USING "btree" ("customer_id") WHERE ("customer_id" IS NOT NULL);



CREATE INDEX "idx_analytics_events_event_type" ON "public"."analytics_events" USING "btree" ("event_type");



CREATE INDEX "idx_analytics_events_occurred_at" ON "public"."analytics_events" USING "btree" ("occurred_at" DESC);



CREATE INDEX "idx_analytics_events_restaurant_id" ON "public"."analytics_events" USING "btree" ("restaurant_id");



CREATE INDEX "idx_analytics_events_restaurant_occurred" ON "public"."analytics_events" USING "btree" ("restaurant_id", "occurred_at" DESC);



CREATE INDEX "idx_audit_logs_action" ON "public"."audit_logs" USING "btree" ("action");



CREATE INDEX "idx_audit_logs_created_at" ON "public"."audit_logs" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_audit_logs_entity" ON "public"."audit_logs" USING "btree" ("entity", "entity_id");



CREATE INDEX "idx_booking_assignment_idempotency_merge_group_allocation_id" ON "public"."booking_assignment_idempotency" USING "btree" ("merge_group_allocation_id");



CREATE INDEX "idx_booking_confirmation_results_restaurant_id" ON "public"."booking_confirmation_results" USING "btree" ("restaurant_id");



CREATE INDEX "idx_booking_slots_date_range" ON "public"."booking_slots" USING "btree" ("restaurant_id", "slot_date");



COMMENT ON INDEX "public"."idx_booking_slots_date_range" IS 'Fast queries for all slots on a given date';



CREATE INDEX "idx_booking_slots_service_period" ON "public"."booking_slots" USING "btree" ("service_period_id", "slot_date");



COMMENT ON INDEX "public"."idx_booking_slots_service_period" IS 'Fast queries by service period (e.g., all lunch slots)';



CREATE INDEX "idx_booking_state_history_booking" ON "public"."booking_state_history" USING "btree" ("booking_id", "changed_at" DESC);



COMMENT ON INDEX "public"."idx_booking_state_history_booking" IS 'Lookup transitions for a booking ordered by recency.';



CREATE INDEX "idx_booking_state_history_changed_at" ON "public"."booking_state_history" USING "btree" ("changed_at");



COMMENT ON INDEX "public"."idx_booking_state_history_changed_at" IS 'Support chronological reporting of booking transitions.';



CREATE INDEX "idx_booking_state_history_changed_by" ON "public"."booking_state_history" USING "btree" ("changed_by");



CREATE INDEX "idx_booking_table_assignments_allocation_id" ON "public"."booking_table_assignments" USING "btree" ("allocation_id");



CREATE INDEX "idx_booking_table_assignments_assigned_by" ON "public"."booking_table_assignments" USING "btree" ("assigned_by");



CREATE INDEX "idx_booking_table_assignments_slot" ON "public"."booking_table_assignments" USING "btree" ("slot_id");



COMMENT ON INDEX "public"."idx_booking_table_assignments_slot" IS 'Fast lookup of assignments per slot';



CREATE INDEX "idx_booking_table_assignments_table" ON "public"."booking_table_assignments" USING "btree" ("table_id", "assigned_at");



COMMENT ON INDEX "public"."idx_booking_table_assignments_table" IS 'Fast lookup of bookings using a table (for reservation timeline)';



CREATE INDEX "idx_booking_versions_booking_id" ON "public"."booking_versions" USING "btree" ("booking_id");



CREATE INDEX "idx_booking_versions_changed_at" ON "public"."booking_versions" USING "btree" ("changed_at" DESC);



CREATE INDEX "idx_booking_versions_restaurant_id" ON "public"."booking_versions" USING "btree" ("restaurant_id");



CREATE INDEX "idx_bookings_assigned_zone_id" ON "public"."bookings" USING "btree" ("assigned_zone_id");



CREATE INDEX "idx_bookings_auth_user" ON "public"."bookings" USING "btree" ("auth_user_id") WHERE ("auth_user_id" IS NOT NULL);



CREATE INDEX "idx_bookings_auto_assign_idempotency_key" ON "public"."bookings" USING "btree" ("auto_assign_idempotency_key") WHERE ("auto_assign_idempotency_key" IS NOT NULL);



CREATE INDEX "idx_bookings_booking_type" ON "public"."bookings" USING "btree" ("booking_type");



CREATE INDEX "idx_bookings_client_request_id" ON "public"."bookings" USING "btree" ("client_request_id");



CREATE INDEX "idx_bookings_confirmation_token" ON "public"."bookings" USING "btree" ("confirmation_token") WHERE ("confirmation_token" IS NOT NULL);



CREATE INDEX "idx_bookings_created" ON "public"."bookings" USING "btree" ("restaurant_id", "created_at" DESC);



CREATE INDEX "idx_bookings_customer" ON "public"."bookings" USING "btree" ("customer_id");



CREATE INDEX "idx_bookings_date" ON "public"."bookings" USING "btree" ("restaurant_id", "booking_date");



CREATE INDEX "idx_bookings_datetime" ON "public"."bookings" USING "btree" ("restaurant_id", "start_at", "end_at");



CREATE INDEX "idx_bookings_idempotency_key" ON "public"."bookings" USING "btree" ("idempotency_key") WHERE ("idempotency_key" IS NOT NULL);



CREATE INDEX "idx_bookings_pending_ref" ON "public"."bookings" USING "btree" ("pending_ref") WHERE ("pending_ref" IS NOT NULL);



CREATE INDEX "idx_bookings_restaurant" ON "public"."bookings" USING "btree" ("restaurant_id");



CREATE INDEX "idx_bookings_restaurant_date_end" ON "public"."bookings" USING "btree" ("restaurant_id", "booking_date", "end_at");



CREATE INDEX "idx_bookings_restaurant_date_start" ON "public"."bookings" USING "btree" ("restaurant_id", "booking_date", "start_at");



CREATE INDEX "idx_bookings_status" ON "public"."bookings" USING "btree" ("restaurant_id", "status");



CREATE INDEX "idx_bta_booking_end" ON "public"."booking_table_assignments" USING "btree" ("booking_id", "end_at");



CREATE INDEX "idx_bta_booking_start" ON "public"."booking_table_assignments" USING "btree" ("booking_id", "start_at");



CREATE INDEX "idx_customer_profiles_updated_at" ON "public"."customer_profiles" USING "btree" ("updated_at" DESC);



CREATE INDEX "idx_customers_auth_user" ON "public"."customers" USING "btree" ("auth_user_id") WHERE ("auth_user_id" IS NOT NULL);



CREATE INDEX "idx_customers_restaurant" ON "public"."customers" USING "btree" ("restaurant_id");



CREATE INDEX "idx_customers_user_profile_id" ON "public"."customers" USING "btree" ("user_profile_id");



CREATE INDEX "idx_demand_profiles_restaurant_day_window" ON "public"."demand_profiles" USING "btree" ("restaurant_id", "day_of_week", "service_window");



CREATE INDEX "idx_demand_profiles_updated_at" ON "public"."demand_profiles" USING "btree" ("updated_at");



CREATE INDEX "idx_manual_assignment_sessions_created_by" ON "public"."manual_assignment_sessions" USING "btree" ("created_by");



CREATE INDEX "idx_manual_assignment_sessions_hold_id" ON "public"."manual_assignment_sessions" USING "btree" ("hold_id");



CREATE INDEX "idx_memberships_restaurant" ON "public"."restaurant_memberships" USING "btree" ("restaurant_id");



CREATE INDEX "idx_memberships_user" ON "public"."restaurant_memberships" USING "btree" ("user_id");



CREATE INDEX "idx_profiles_email" ON "public"."profiles" USING "btree" ("email") WHERE ("email" IS NOT NULL);



CREATE INDEX "idx_profiles_has_access" ON "public"."profiles" USING "btree" ("has_access");



CREATE INDEX "idx_restaurant_capacity_rules_restaurant_id" ON "public"."restaurant_capacity_rules" USING "btree" ("restaurant_id");



CREATE INDEX "idx_restaurant_capacity_rules_scope" ON "public"."restaurant_capacity_rules" USING "btree" ("restaurant_id", COALESCE(("day_of_week")::integer, '-1'::integer), "effective_date");



CREATE INDEX "idx_restaurant_capacity_rules_service_period_id" ON "public"."restaurant_capacity_rules" USING "btree" ("service_period_id");



CREATE INDEX "idx_restaurant_invites_invited_by" ON "public"."restaurant_invites" USING "btree" ("invited_by");



CREATE INDEX "idx_restaurant_operating_hours_restaurant_id" ON "public"."restaurant_operating_hours" USING "btree" ("restaurant_id");



CREATE INDEX "idx_restaurant_operating_hours_scope" ON "public"."restaurant_operating_hours" USING "btree" ("restaurant_id", COALESCE(("day_of_week")::integer, '-1'::integer), "effective_date");



CREATE INDEX "idx_restaurant_service_periods_booking_option" ON "public"."restaurant_service_periods" USING "btree" ("booking_option");



CREATE INDEX "idx_restaurant_service_periods_restaurant_id" ON "public"."restaurant_service_periods" USING "btree" ("restaurant_id");



CREATE INDEX "idx_restaurant_service_periods_scope" ON "public"."restaurant_service_periods" USING "btree" ("restaurant_id", COALESCE(("day_of_week")::integer, '-1'::integer));



CREATE INDEX "idx_restaurant_turn_bands_booking_option" ON "public"."restaurant_turn_bands" USING "btree" ("booking_option");



CREATE INDEX "idx_restaurants_active" ON "public"."restaurants" USING "btree" ("is_active");



CREATE INDEX "idx_strategic_configs_updated_by" ON "public"."strategic_configs" USING "btree" ("updated_by");



CREATE INDEX "idx_table_hold_members_table" ON "public"."table_hold_members" USING "btree" ("table_id");



CREATE INDEX "idx_table_holds_created_by" ON "public"."table_holds" USING "btree" ("created_by");



CREATE INDEX "idx_table_holds_restaurant_end" ON "public"."table_holds" USING "btree" ("restaurant_id", "end_at");



CREATE INDEX "idx_table_holds_restaurant_expires" ON "public"."table_holds" USING "btree" ("restaurant_id", "expires_at");



CREATE INDEX "idx_table_holds_restaurant_start" ON "public"."table_holds" USING "btree" ("restaurant_id", "start_at");



CREATE INDEX "idx_table_inventory_allowed_capacity" ON "public"."table_inventory" USING "btree" ("restaurant_id", "capacity");



CREATE INDEX "idx_table_inventory_lookup" ON "public"."table_inventory" USING "btree" ("restaurant_id", "status", "capacity");



COMMENT ON INDEX "public"."idx_table_inventory_lookup" IS 'Fast lookup for available tables by restaurant and capacity';



CREATE INDEX "idx_table_inventory_section" ON "public"."table_inventory" USING "btree" ("restaurant_id", "section");



COMMENT ON INDEX "public"."idx_table_inventory_section" IS 'Fast filtering by section for floor plan views';



CREATE INDEX "idx_table_merge_graph_restaurant_id" ON "public"."table_merge_graph" USING "btree" ("restaurant_id");



CREATE INDEX "idx_table_merge_graph_table_a" ON "public"."table_merge_graph" USING "btree" ("table_a");



CREATE INDEX "idx_table_merge_graph_table_b" ON "public"."table_merge_graph" USING "btree" ("table_b");



CREATE INDEX "idx_table_scarcity_metrics_computed_at" ON "public"."table_scarcity_metrics" USING "btree" ("computed_at");



CREATE INDEX "idx_user_profiles_phone" ON "public"."user_profiles" USING "btree" ("phone");



CREATE INDEX "idx_waiting_list_restaurant_date" ON "public"."waiting_list" USING "btree" ("restaurant_id", "booking_date");



CREATE INDEX "idx_zones_restaurant_id" ON "public"."zones" USING "btree" ("restaurant_id");



CREATE INDEX "mas_active_state_idx" ON "public"."manual_assignment_sessions" USING "btree" ("state") WHERE ("state" = ANY (ARRAY['none'::"public"."manual_assignment_session_state", 'proposed'::"public"."manual_assignment_session_state", 'held'::"public"."manual_assignment_session_state", 'conflicted'::"public"."manual_assignment_session_state"]));



CREATE INDEX "mas_booking_state_idx" ON "public"."manual_assignment_sessions" USING "btree" ("booking_id", "state");



CREATE INDEX "mas_restaurant_state_idx" ON "public"."manual_assignment_sessions" USING "btree" ("restaurant_id", "state");



CREATE UNIQUE INDEX "merge_rules_from_to_idx" ON "public"."merge_rules" USING "btree" ("from_a", "from_b", "to_capacity");



CREATE INDEX "observability_events_created_at_idx" ON "public"."observability_events" USING "btree" ("created_at" DESC);



CREATE UNIQUE INDEX "profile_update_requests_profile_key_idx" ON "public"."profile_update_requests" USING "btree" ("profile_id", "idempotency_key");



CREATE UNIQUE INDEX "restaurant_invites_pending_unique_email" ON "public"."restaurant_invites" USING "btree" ("restaurant_id", "email_normalized") WHERE ("status" = 'pending'::"text");



CREATE INDEX "restaurant_invites_restaurant_status_idx" ON "public"."restaurant_invites" USING "btree" ("restaurant_id", "status", "expires_at" DESC);



CREATE UNIQUE INDEX "restaurant_invites_token_hash_key" ON "public"."restaurant_invites" USING "btree" ("token_hash");



CREATE UNIQUE INDEX "restaurant_turn_bands_unique_idx" ON "public"."restaurant_turn_bands" USING "btree" ("restaurant_id", "booking_option", "max_party_size");



CREATE INDEX "table_adjacencies_table_b_idx" ON "public"."table_adjacencies" USING "btree" ("table_b");



CREATE INDEX "table_hold_windows_restaurant_idx" ON "public"."table_hold_windows" USING "btree" ("restaurant_id");



CREATE INDEX "table_hold_windows_table_idx" ON "public"."table_hold_windows" USING "btree" ("table_id");



CREATE INDEX "table_holds_active_booking_idx" ON "public"."table_holds" USING "btree" ("booking_id") WHERE ("status" = 'active'::"public"."table_hold_status");



CREATE INDEX "table_holds_active_restaurant_idx" ON "public"."table_holds" USING "btree" ("restaurant_id", "start_at", "end_at") WHERE ("status" = 'active'::"public"."table_hold_status");



CREATE INDEX "table_holds_booking_idx" ON "public"."table_holds" USING "btree" ("booking_id");



CREATE INDEX "table_holds_expires_at_idx" ON "public"."table_holds" USING "btree" ("expires_at");



CREATE INDEX "table_holds_restaurant_idx" ON "public"."table_holds" USING "btree" ("restaurant_id", "start_at", "end_at", "expires_at");



CREATE INDEX "table_holds_session_idx" ON "public"."table_holds" USING "btree" ("session_id");



CREATE INDEX "table_holds_status_idx" ON "public"."table_holds" USING "btree" ("status");



CREATE INDEX "table_holds_zone_start_idx" ON "public"."table_holds" USING "btree" ("zone_id", "start_at");



CREATE INDEX "table_inventory_zone_idx" ON "public"."table_inventory" USING "btree" ("zone_id");



CREATE INDEX "table_soft_holds_booking_idx" ON "public"."table_soft_holds" USING "btree" ("booking_id") WHERE ("booking_id" IS NOT NULL);



CREATE INDEX "table_soft_holds_expires_idx" ON "public"."table_soft_holds" USING "btree" ("expires_at");



CREATE INDEX "table_soft_holds_restaurant_idx" ON "public"."table_soft_holds" USING "btree" ("restaurant_id", "expires_at");



CREATE INDEX "table_soft_holds_session_idx" ON "public"."table_soft_holds" USING "btree" ("session_token");



CREATE INDEX "thw_window_gist" ON "public"."table_hold_windows" USING "gist" ("hold_window");



CREATE UNIQUE INDEX "waiting_list_customer_unique_idx" ON "public"."waiting_list" USING "btree" ("restaurant_id", "booking_date", "desired_time", "customer_email", COALESCE("customer_phone", ''::"text"));



CREATE INDEX "waiting_list_restaurant_date_time_idx" ON "public"."waiting_list" USING "btree" ("restaurant_id", "booking_date", "desired_time", "created_at");



CREATE INDEX "zone_floorplan_edit_locks_expires_at_idx" ON "public"."zone_floorplan_edit_locks" USING "btree" ("expires_at");



CREATE INDEX "zone_floorplan_layout_versions_zone_created_at_idx" ON "public"."zone_floorplan_layout_versions" USING "btree" ("zone_id", "created_at" DESC);



CREATE UNIQUE INDEX "zones_restaurant_name_idx" ON "public"."zones" USING "btree" ("restaurant_id", "lower"("name"));



CREATE OR REPLACE TRIGGER "allocations_updated_at" BEFORE UPDATE ON "public"."allocations" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "allowed_capacities_touch_updated_at" BEFORE UPDATE ON "public"."allowed_capacities" FOR EACH ROW EXECUTE FUNCTION "public"."allowed_capacities_set_updated_at"();



CREATE OR REPLACE TRIGGER "bar_tables_drinks_only" BEFORE INSERT OR UPDATE ON "public"."booking_table_assignments" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_bar_drinks_only"();



CREATE OR REPLACE TRIGGER "booking_assignment_validation" BEFORE UPDATE ON "public"."bookings" FOR EACH ROW WHEN (("new"."status" = 'confirmed'::"public"."booking_status")) EXECUTE FUNCTION "public"."validate_booking_has_assignments"();



CREATE OR REPLACE TRIGGER "booking_slots_increment_version" BEFORE UPDATE ON "public"."booking_slots" FOR EACH ROW EXECUTE FUNCTION "public"."increment_booking_slot_version"();



CREATE OR REPLACE TRIGGER "booking_slots_updated_at" BEFORE UPDATE ON "public"."booking_slots" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "booking_table_assignments_audit" AFTER INSERT OR DELETE ON "public"."booking_table_assignments" FOR EACH ROW EXECUTE FUNCTION "public"."log_table_assignment_change"();



CREATE OR REPLACE TRIGGER "booking_table_assignments_updated_at" BEFORE UPDATE ON "public"."booking_table_assignments" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "bookings_set_instants" BEFORE INSERT OR UPDATE OF "booking_date", "start_time", "end_time", "restaurant_id" ON "public"."bookings" FOR EACH ROW EXECUTE FUNCTION "public"."set_booking_instants"();



CREATE OR REPLACE TRIGGER "bookings_set_reference" BEFORE INSERT ON "public"."bookings" FOR EACH ROW EXECUTE FUNCTION "public"."set_booking_reference"();



CREATE OR REPLACE TRIGGER "bookings_updated_at" BEFORE UPDATE ON "public"."bookings" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "customers_updated_at" BEFORE UPDATE ON "public"."customers" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "merge_rules_updated_at" BEFORE UPDATE ON "public"."merge_rules" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "restaurant_capacity_rules_updated_at" BEFORE UPDATE ON "public"."restaurant_capacity_rules" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "restaurant_operating_hours_updated_at" BEFORE UPDATE ON "public"."restaurant_operating_hours" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "restaurant_service_periods_updated_at" BEFORE UPDATE ON "public"."restaurant_service_periods" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "restaurant_turn_bands_updated_at" BEFORE UPDATE ON "public"."restaurant_turn_bands" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "restaurants_updated_at" BEFORE UPDATE ON "public"."restaurants" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "service_policy_updated_at" BEFORE UPDATE ON "public"."service_policy" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "set_restaurant_invites_updated_at" BEFORE UPDATE ON "public"."restaurant_invites" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "set_user_profiles_updated_at" BEFORE UPDATE ON "public"."user_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "table_adjacencies_validate" BEFORE INSERT ON "public"."table_adjacencies" FOR EACH ROW EXECUTE FUNCTION "public"."validate_table_adjacency"();



CREATE OR REPLACE TRIGGER "table_hold_members_sync_delete" AFTER DELETE ON "public"."table_hold_members" FOR EACH ROW EXECUTE FUNCTION "public"."sync_table_hold_windows"();



CREATE OR REPLACE TRIGGER "table_hold_members_sync_insert" AFTER INSERT ON "public"."table_hold_members" FOR EACH ROW EXECUTE FUNCTION "public"."sync_table_hold_windows"();



CREATE OR REPLACE TRIGGER "table_holds_sync_update" AFTER UPDATE OF "start_at", "end_at", "expires_at", "restaurant_id", "booking_id" ON "public"."table_holds" FOR EACH ROW EXECUTE FUNCTION "public"."update_table_hold_windows"();



CREATE OR REPLACE TRIGGER "table_holds_sync_windows" AFTER UPDATE ON "public"."table_holds" FOR EACH ROW EXECUTE FUNCTION "public"."update_table_hold_windows"();



CREATE OR REPLACE TRIGGER "table_inventory_updated_at" BEFORE UPDATE ON "public"."table_inventory" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "trg_allocations_refresh" AFTER INSERT OR DELETE OR UPDATE ON "public"."allocations" FOR EACH ROW EXECUTE FUNCTION "public"."on_allocations_refresh"();



CREATE OR REPLACE TRIGGER "trg_booking_status_refresh" AFTER UPDATE OF "status" ON "public"."bookings" FOR EACH ROW EXECUTE FUNCTION "public"."on_booking_status_refresh"();



CREATE OR REPLACE TRIGGER "trg_capacity_outbox_updated_at" BEFORE UPDATE ON "public"."capacity_outbox" FOR EACH ROW EXECUTE FUNCTION "public"."set_timestamp_updated_at"();



CREATE OR REPLACE TRIGGER "update_demand_profiles_updated_at" BEFORE UPDATE ON "public"."demand_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_profiles_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "update_strategic_configs_updated_at" BEFORE UPDATE ON "public"."strategic_configs" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_user_profiles_updated_at" BEFORE UPDATE ON "public"."user_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_waiting_list_updated_at" BEFORE UPDATE ON "public"."waiting_list" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "waiting_list_updated_at" BEFORE UPDATE ON "public"."waiting_list" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "zones_updated_at" BEFORE UPDATE ON "public"."zones" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



ALTER TABLE ONLY "public"."allocations"
    ADD CONSTRAINT "allocations_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."allocations"
    ADD CONSTRAINT "allocations_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."allocations"
    ADD CONSTRAINT "allocations_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."allowed_capacities"
    ADD CONSTRAINT "allowed_capacities_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."analytics_events"
    ADD CONSTRAINT "analytics_events_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."analytics_events"
    ADD CONSTRAINT "analytics_events_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."analytics_events"
    ADD CONSTRAINT "analytics_events_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."booking_assignment_attempts"
    ADD CONSTRAINT "booking_assignment_attempts_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."booking_assignment_idempotency"
    ADD CONSTRAINT "booking_assignment_idempotency_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."booking_assignment_idempotency"
    ADD CONSTRAINT "booking_assignment_idempotency_merge_group_fkey" FOREIGN KEY ("merge_group_allocation_id") REFERENCES "public"."allocations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."booking_confirmation_results"
    ADD CONSTRAINT "booking_confirmation_results_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."booking_confirmation_results"
    ADD CONSTRAINT "booking_confirmation_results_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."booking_slots"
    ADD CONSTRAINT "booking_slots_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."booking_slots"
    ADD CONSTRAINT "booking_slots_service_period_id_fkey" FOREIGN KEY ("service_period_id") REFERENCES "public"."restaurant_service_periods"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."booking_state_history"
    ADD CONSTRAINT "booking_state_history_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."booking_state_history"
    ADD CONSTRAINT "booking_state_history_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."booking_table_assignments"
    ADD CONSTRAINT "booking_table_assignments_allocation_id_fkey" FOREIGN KEY ("allocation_id") REFERENCES "public"."allocations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."booking_table_assignments"
    ADD CONSTRAINT "booking_table_assignments_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."booking_table_assignments"
    ADD CONSTRAINT "booking_table_assignments_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."booking_table_assignments"
    ADD CONSTRAINT "booking_table_assignments_merge_group_id_fkey" FOREIGN KEY ("merge_group_id") REFERENCES "public"."allocations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."booking_table_assignments"
    ADD CONSTRAINT "booking_table_assignments_slot_id_fkey" FOREIGN KEY ("slot_id") REFERENCES "public"."booking_slots"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."booking_table_assignments"
    ADD CONSTRAINT "booking_table_assignments_table_id_fkey" FOREIGN KEY ("table_id") REFERENCES "public"."table_inventory"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."booking_versions"
    ADD CONSTRAINT "booking_versions_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."booking_versions"
    ADD CONSTRAINT "booking_versions_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_assigned_zone_id_fkey" FOREIGN KEY ("assigned_zone_id") REFERENCES "public"."zones"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_booking_type_fkey" FOREIGN KEY ("booking_type") REFERENCES "public"."booking_occasions"("key") ON UPDATE CASCADE ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."customer_profiles"
    ADD CONSTRAINT "customer_profiles_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_user_profile_id_fkey" FOREIGN KEY ("user_profile_id") REFERENCES "public"."user_profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."demand_profiles"
    ADD CONSTRAINT "demand_profiles_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."email_delivery_log"
    ADD CONSTRAINT "email_delivery_log_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."email_delivery_log"
    ADD CONSTRAINT "email_delivery_log_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."manual_assignment_sessions"
    ADD CONSTRAINT "manual_assignment_sessions_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."manual_assignment_sessions"
    ADD CONSTRAINT "manual_assignment_sessions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."manual_assignment_sessions"
    ADD CONSTRAINT "manual_assignment_sessions_hold_fkey" FOREIGN KEY ("hold_id") REFERENCES "public"."table_holds"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."manual_assignment_sessions"
    ADD CONSTRAINT "manual_assignment_sessions_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profile_update_requests"
    ADD CONSTRAINT "profile_update_requests_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."restaurant_capacity_rules"
    ADD CONSTRAINT "restaurant_capacity_rules_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."restaurant_capacity_rules"
    ADD CONSTRAINT "restaurant_capacity_rules_service_period_id_fkey" FOREIGN KEY ("service_period_id") REFERENCES "public"."restaurant_service_periods"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."restaurant_invites"
    ADD CONSTRAINT "restaurant_invites_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."restaurant_invites"
    ADD CONSTRAINT "restaurant_invites_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."restaurant_memberships"
    ADD CONSTRAINT "restaurant_memberships_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."restaurant_operating_hours"
    ADD CONSTRAINT "restaurant_operating_hours_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."restaurant_service_periods"
    ADD CONSTRAINT "restaurant_service_periods_booking_option_fkey" FOREIGN KEY ("booking_option") REFERENCES "public"."booking_occasions"("key") ON UPDATE CASCADE ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."restaurant_service_periods"
    ADD CONSTRAINT "restaurant_service_periods_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."restaurant_turn_bands"
    ADD CONSTRAINT "restaurant_turn_bands_booking_option_fkey" FOREIGN KEY ("booking_option") REFERENCES "public"."booking_occasions"("key") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."restaurant_turn_bands"
    ADD CONSTRAINT "restaurant_turn_bands_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."strategic_configs"
    ADD CONSTRAINT "strategic_configs_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."strategic_configs"
    ADD CONSTRAINT "strategic_configs_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."table_adjacencies"
    ADD CONSTRAINT "table_adjacencies_table_a_fkey" FOREIGN KEY ("table_a") REFERENCES "public"."table_inventory"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."table_adjacencies"
    ADD CONSTRAINT "table_adjacencies_table_b_fkey" FOREIGN KEY ("table_b") REFERENCES "public"."table_inventory"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."table_hold_members"
    ADD CONSTRAINT "table_hold_members_hold_id_fkey" FOREIGN KEY ("hold_id") REFERENCES "public"."table_holds"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."table_hold_members"
    ADD CONSTRAINT "table_hold_members_table_id_fkey" FOREIGN KEY ("table_id") REFERENCES "public"."table_inventory"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."table_hold_windows"
    ADD CONSTRAINT "table_hold_windows_hold_id_fkey" FOREIGN KEY ("hold_id") REFERENCES "public"."table_holds"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."table_hold_windows"
    ADD CONSTRAINT "table_hold_windows_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."table_hold_windows"
    ADD CONSTRAINT "table_hold_windows_table_id_fkey" FOREIGN KEY ("table_id") REFERENCES "public"."table_inventory"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."table_holds"
    ADD CONSTRAINT "table_holds_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."table_holds"
    ADD CONSTRAINT "table_holds_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."table_holds"
    ADD CONSTRAINT "table_holds_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."table_holds"
    ADD CONSTRAINT "table_holds_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."manual_assignment_sessions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."table_holds"
    ADD CONSTRAINT "table_holds_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "public"."zones"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."table_inventory"
    ADD CONSTRAINT "table_inventory_allowed_capacity_fkey" FOREIGN KEY ("restaurant_id", "capacity") REFERENCES "public"."allowed_capacities"("restaurant_id", "capacity") NOT VALID;



ALTER TABLE ONLY "public"."table_inventory"
    ADD CONSTRAINT "table_inventory_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."table_inventory"
    ADD CONSTRAINT "table_inventory_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "public"."zones"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."table_scarcity_metrics"
    ADD CONSTRAINT "table_scarcity_metrics_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."table_soft_holds"
    ADD CONSTRAINT "table_soft_holds_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."table_soft_holds"
    ADD CONSTRAINT "table_soft_holds_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."table_soft_holds"
    ADD CONSTRAINT "table_soft_holds_table_id_fkey" FOREIGN KEY ("table_id") REFERENCES "public"."table_inventory"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."waiting_list"
    ADD CONSTRAINT "waiting_list_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."zone_floorplan_edit_locks"
    ADD CONSTRAINT "zone_floorplan_edit_locks_locked_by_fkey" FOREIGN KEY ("locked_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."zone_floorplan_edit_locks"
    ADD CONSTRAINT "zone_floorplan_edit_locks_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."zone_floorplan_edit_locks"
    ADD CONSTRAINT "zone_floorplan_edit_locks_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "public"."zones"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."zone_floorplan_layout_versions"
    ADD CONSTRAINT "zone_floorplan_layout_versions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."zone_floorplan_layout_versions"
    ADD CONSTRAINT "zone_floorplan_layout_versions_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."zone_floorplan_layout_versions"
    ADD CONSTRAINT "zone_floorplan_layout_versions_restored_from_fkey" FOREIGN KEY ("restored_from") REFERENCES "public"."zone_floorplan_layout_versions"("id");



ALTER TABLE ONLY "public"."zone_floorplan_layout_versions"
    ADD CONSTRAINT "zone_floorplan_layout_versions_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "public"."zones"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."zones"
    ADD CONSTRAINT "zones_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;



CREATE POLICY "Admins and owners can delete bookings" ON "public"."bookings" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."restaurant_memberships" "rm"
  WHERE (("rm"."restaurant_id" = "bookings"."restaurant_id") AND ("rm"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("rm"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text"]))))));



CREATE POLICY "Admins and owners can delete customers" ON "public"."customers" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."restaurant_memberships" "rm"
  WHERE (("rm"."restaurant_id" = "customers"."restaurant_id") AND ("rm"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("rm"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text"]))))));



CREATE POLICY "Allow public read access to booking_occasions" ON "public"."booking_occasions" FOR SELECT USING (true);



CREATE POLICY "Customers can view their table assignments" ON "public"."booking_table_assignments" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."bookings" "b"
  WHERE (("b"."id" = "booking_table_assignments"."booking_id") AND ("b"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Owners and admins can manage memberships" ON "public"."restaurant_memberships" USING (("restaurant_id" IN ( SELECT "public"."user_restaurants_admin"() AS "user_restaurants_admin"))) WITH CHECK (("restaurant_id" IN ( SELECT "public"."user_restaurants_admin"() AS "user_restaurants_admin")));



CREATE POLICY "Owners and managers can manage demand profiles" ON "public"."demand_profiles" USING ((EXISTS ( SELECT 1
   FROM "public"."restaurant_memberships" "rm"
  WHERE (("rm"."restaurant_id" = "demand_profiles"."restaurant_id") AND ("rm"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("rm"."role" = ANY (ARRAY['owner'::"text", 'manager'::"text", 'admin'::"text"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."restaurant_memberships" "rm"
  WHERE (("rm"."restaurant_id" = "demand_profiles"."restaurant_id") AND ("rm"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("rm"."role" = ANY (ARRAY['owner'::"text", 'manager'::"text", 'admin'::"text"]))))));



CREATE POLICY "Owners and managers can manage scarcity metrics" ON "public"."table_scarcity_metrics" USING ((EXISTS ( SELECT 1
   FROM "public"."restaurant_memberships" "rm"
  WHERE (("rm"."restaurant_id" = "table_scarcity_metrics"."restaurant_id") AND ("rm"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("rm"."role" = ANY (ARRAY['owner'::"text", 'manager'::"text", 'admin'::"text"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."restaurant_memberships" "rm"
  WHERE (("rm"."restaurant_id" = "table_scarcity_metrics"."restaurant_id") AND ("rm"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("rm"."role" = ANY (ARRAY['owner'::"text", 'manager'::"text", 'admin'::"text"]))))));



CREATE POLICY "Owners and managers can manage strategic configs" ON "public"."strategic_configs" USING ((EXISTS ( SELECT 1
   FROM "public"."restaurant_memberships" "rm"
  WHERE (("rm"."restaurant_id" = "strategic_configs"."restaurant_id") AND ("rm"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("rm"."role" = ANY (ARRAY['owner'::"text", 'manager'::"text", 'admin'::"text", 'ops_manager'::"text"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."restaurant_memberships" "rm"
  WHERE (("rm"."restaurant_id" = "strategic_configs"."restaurant_id") AND ("rm"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("rm"."role" = ANY (ARRAY['owner'::"text", 'manager'::"text", 'admin'::"text", 'ops_manager'::"text"]))))));



CREATE POLICY "Owners and managers manage invites" ON "public"."restaurant_invites" USING ((EXISTS ( SELECT 1
   FROM "public"."restaurant_memberships" "rm"
  WHERE (("rm"."restaurant_id" = "restaurant_invites"."restaurant_id") AND ("rm"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("rm"."role" = ANY (ARRAY['owner'::"text", 'manager'::"text", 'admin'::"text"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."restaurant_memberships" "rm"
  WHERE (("rm"."restaurant_id" = "restaurant_invites"."restaurant_id") AND ("rm"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("rm"."role" = ANY (ARRAY['owner'::"text", 'manager'::"text", 'admin'::"text"]))))));



CREATE POLICY "Public can insert leads" ON "public"."leads" FOR INSERT WITH CHECK (true);



CREATE POLICY "Restaurant members can manage waiting list" ON "public"."waiting_list" USING ((EXISTS ( SELECT 1
   FROM "public"."restaurant_memberships" "rm"
  WHERE (("rm"."restaurant_id" = "waiting_list"."restaurant_id") AND ("rm"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."restaurant_memberships" "rm"
  WHERE (("rm"."restaurant_id" = "waiting_list"."restaurant_id") AND ("rm"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Restaurant members can view booking versions" ON "public"."booking_versions" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."restaurant_memberships" "rm"
  WHERE (("rm"."restaurant_id" = "booking_versions"."restaurant_id") AND ("rm"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Restaurant staff can view analytics" ON "public"."analytics_events" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."restaurant_memberships" "rm"
  WHERE (("rm"."restaurant_id" = "analytics_events"."restaurant_id") AND ("rm"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Service role can manage adjacencies" ON "public"."table_adjacencies" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role can manage allowed capacities" ON "public"."allowed_capacities" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role can manage booking slots" ON "public"."booking_slots" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role can manage capacity rules" ON "public"."restaurant_capacity_rules" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role can manage operating hours" ON "public"."restaurant_operating_hours" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role can manage service periods" ON "public"."restaurant_service_periods" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role can manage service policy" ON "public"."service_policy" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role can manage table inventory" ON "public"."table_inventory" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role can manage turn bands" ON "public"."restaurant_turn_bands" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role can manage zones" ON "public"."zones" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role full access to table_hold_members" ON "public"."table_hold_members" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role full access to table_holds" ON "public"."table_holds" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role has full access to soft_holds" ON "public"."table_soft_holds" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Staff can create bookings" ON "public"."bookings" FOR INSERT WITH CHECK (("restaurant_id" IN ( SELECT "public"."user_restaurants"() AS "user_restaurants")));



CREATE POLICY "Staff can create customers" ON "public"."customers" FOR INSERT WITH CHECK (("restaurant_id" IN ( SELECT "public"."user_restaurants"() AS "user_restaurants")));



CREATE POLICY "Staff can manage adjacencies" ON "public"."table_adjacencies" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."table_inventory" "ti"
  WHERE (("ti"."id" = "table_adjacencies"."table_a") AND ("ti"."restaurant_id" IN ( SELECT "public"."user_restaurants"() AS "user_restaurants")))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."table_inventory" "ti"
  WHERE (("ti"."id" = "table_adjacencies"."table_a") AND ("ti"."restaurant_id" IN ( SELECT "public"."user_restaurants"() AS "user_restaurants"))))));



CREATE POLICY "Staff can manage allowed capacities" ON "public"."allowed_capacities" TO "authenticated" USING (("restaurant_id" IN ( SELECT "public"."user_restaurants"() AS "user_restaurants"))) WITH CHECK (("restaurant_id" IN ( SELECT "public"."user_restaurants"() AS "user_restaurants")));



CREATE POLICY "Staff can manage booking slots" ON "public"."booking_slots" USING (("restaurant_id" IN ( SELECT "public"."user_restaurants"() AS "user_restaurants"))) WITH CHECK (("restaurant_id" IN ( SELECT "public"."user_restaurants"() AS "user_restaurants")));



CREATE POLICY "Staff can manage capacity rules" ON "public"."restaurant_capacity_rules" USING (("restaurant_id" IN ( SELECT "public"."user_restaurants"() AS "user_restaurants"))) WITH CHECK (("restaurant_id" IN ( SELECT "public"."user_restaurants"() AS "user_restaurants")));



CREATE POLICY "Staff can manage operating hours" ON "public"."restaurant_operating_hours" USING (("restaurant_id" IN ( SELECT "public"."user_restaurants"() AS "user_restaurants"))) WITH CHECK (("restaurant_id" IN ( SELECT "public"."user_restaurants"() AS "user_restaurants")));



CREATE POLICY "Staff can manage service periods" ON "public"."restaurant_service_periods" USING (("restaurant_id" IN ( SELECT "public"."user_restaurants"() AS "user_restaurants"))) WITH CHECK (("restaurant_id" IN ( SELECT "public"."user_restaurants"() AS "user_restaurants")));



CREATE POLICY "Staff can manage table assignments" ON "public"."booking_table_assignments" USING ((EXISTS ( SELECT 1
   FROM ("public"."bookings" "b"
     JOIN "public"."restaurant_memberships" "rm" ON (("rm"."restaurant_id" = "b"."restaurant_id")))
  WHERE (("b"."id" = "booking_table_assignments"."booking_id") AND ("rm"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."bookings" "b"
     JOIN "public"."restaurant_memberships" "rm" ON (("rm"."restaurant_id" = "b"."restaurant_id")))
  WHERE (("b"."id" = "booking_table_assignments"."booking_id") AND ("rm"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Staff can manage table inventory" ON "public"."table_inventory" USING (("restaurant_id" IN ( SELECT "public"."user_restaurants"() AS "user_restaurants"))) WITH CHECK (("restaurant_id" IN ( SELECT "public"."user_restaurants"() AS "user_restaurants")));



CREATE POLICY "Staff can manage turn bands" ON "public"."restaurant_turn_bands" USING (("restaurant_id" IN ( SELECT "public"."user_restaurants"() AS "user_restaurants"))) WITH CHECK (("restaurant_id" IN ( SELECT "public"."user_restaurants"() AS "user_restaurants")));



CREATE POLICY "Staff can manage zones" ON "public"."zones" TO "authenticated" USING (("restaurant_id" IN ( SELECT "public"."user_restaurants"() AS "user_restaurants"))) WITH CHECK (("restaurant_id" IN ( SELECT "public"."user_restaurants"() AS "user_restaurants")));



CREATE POLICY "Staff can update bookings" ON "public"."bookings" FOR UPDATE USING (("restaurant_id" IN ( SELECT "public"."user_restaurants"() AS "user_restaurants")));



CREATE POLICY "Staff can update customers" ON "public"."customers" FOR UPDATE USING (("restaurant_id" IN ( SELECT "public"."user_restaurants"() AS "user_restaurants")));



CREATE POLICY "Staff can view allocations for their restaurants" ON "public"."allocations" FOR SELECT TO "authenticated" USING (("restaurant_id" IN ( SELECT "public"."user_restaurants"() AS "user_restaurants")));



CREATE POLICY "Staff can view bookings" ON "public"."bookings" FOR SELECT USING (("restaurant_id" IN ( SELECT "public"."user_restaurants"() AS "user_restaurants")));



CREATE POLICY "Staff can view customer profiles" ON "public"."customer_profiles" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."customers" "c"
  WHERE (("c"."id" = "customer_profiles"."customer_id") AND ("c"."restaurant_id" IN ( SELECT "public"."user_restaurants"() AS "user_restaurants"))))));



CREATE POLICY "Staff can view customers" ON "public"."customers" FOR SELECT USING (("restaurant_id" IN ( SELECT "public"."user_restaurants"() AS "user_restaurants")));



CREATE POLICY "Staff can view merge rules" ON "public"."merge_rules" FOR SELECT USING (true);



CREATE POLICY "Staff can view service policy" ON "public"."service_policy" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Staff can view table hold members" ON "public"."table_hold_members" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."table_holds" "h"
  WHERE (("h"."id" = "table_hold_members"."hold_id") AND ("h"."restaurant_id" IN ( SELECT "public"."user_restaurants"() AS "user_restaurants"))))));



CREATE POLICY "Staff can view table holds" ON "public"."table_holds" FOR SELECT TO "authenticated" USING (("restaurant_id" IN ( SELECT "public"."user_restaurants"() AS "user_restaurants")));



CREATE POLICY "Tenant service role can manage allocations" ON "public"."allocations" TO "service_role" USING (("restaurant_id" = "public"."require_restaurant_context"())) WITH CHECK (("restaurant_id" = "public"."require_restaurant_context"()));



CREATE POLICY "Tenant service role can manage allocations archive" ON "public"."allocations_archive" TO "service_role" USING (("restaurant_id" = "public"."require_restaurant_context"())) WITH CHECK (("restaurant_id" = "public"."require_restaurant_context"()));



CREATE POLICY "Tenant service role can manage booking confirmation results" ON "public"."booking_confirmation_results" TO "service_role" USING (("restaurant_id" = "public"."require_restaurant_context"())) WITH CHECK (("restaurant_id" = "public"."require_restaurant_context"()));



CREATE POLICY "Tenant service role can manage bookings" ON "public"."bookings" TO "service_role" USING (("restaurant_id" = "public"."require_restaurant_context"())) WITH CHECK (("restaurant_id" = "public"."require_restaurant_context"()));



CREATE POLICY "Tenant service role can manage capacity outbox" ON "public"."capacity_outbox" TO "service_role" USING (("restaurant_id" = "public"."require_restaurant_context"())) WITH CHECK (("restaurant_id" = "public"."require_restaurant_context"()));



CREATE POLICY "Tenant service role can manage customers" ON "public"."customers" TO "service_role" USING (("restaurant_id" = "public"."require_restaurant_context"())) WITH CHECK (("restaurant_id" = "public"."require_restaurant_context"()));



CREATE POLICY "Tenant service role can manage table assignments" ON "public"."booking_table_assignments" TO "service_role" USING ((EXISTS ( SELECT 1
   FROM "public"."bookings" "b"
  WHERE (("b"."id" = "booking_table_assignments"."booking_id") AND ("b"."restaurant_id" = "public"."require_restaurant_context"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."bookings" "b"
  WHERE (("b"."id" = "booking_table_assignments"."booking_id") AND ("b"."restaurant_id" = "public"."require_restaurant_context"())))));



CREATE POLICY "Users can insert own profile" ON "public"."profiles" FOR INSERT WITH CHECK (("id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can update own profile" ON "public"."profiles" FOR UPDATE USING (("id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can update own profile" ON "public"."user_profiles" FOR UPDATE USING (("id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can view demand profiles for their restaurants" ON "public"."demand_profiles" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."restaurant_memberships" "rm"
  WHERE (("rm"."restaurant_id" = "demand_profiles"."restaurant_id") AND ("rm"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Users can view own profile" ON "public"."profiles" FOR SELECT USING (("id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can view own profile" ON "public"."user_profiles" FOR SELECT USING (("id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can view scarcity metrics for their restaurants" ON "public"."table_scarcity_metrics" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."restaurant_memberships" "rm"
  WHERE (("rm"."restaurant_id" = "table_scarcity_metrics"."restaurant_id") AND ("rm"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Users can view strategic configs for their restaurants" ON "public"."strategic_configs" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."restaurant_memberships" "rm"
  WHERE (("rm"."restaurant_id" = "strategic_configs"."restaurant_id") AND ("rm"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



ALTER TABLE "public"."_migrations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."allocations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."allocations_archive" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."allowed_capacities" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."analytics_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "anon_read_all" ON "public"."restaurants" FOR SELECT TO "anon" USING (true);



ALTER TABLE "public"."audit_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "authenticated_can_create" ON "public"."restaurants" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") IS NOT NULL));



CREATE POLICY "authenticated_read_all" ON "public"."restaurants" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "authenticated_select" ON "public"."allocations" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."restaurant_memberships" "rm"
  WHERE (("rm"."restaurant_id" = "allocations"."restaurant_id") AND ("rm"."user_id" = "auth"."uid"())))));



CREATE POLICY "authenticated_select" ON "public"."booking_assignment_attempts" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."bookings" "b"
     JOIN "public"."restaurant_memberships" "rm" ON (("rm"."restaurant_id" = "b"."restaurant_id")))
  WHERE (("b"."id" = "booking_assignment_attempts"."booking_id") AND ("rm"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "authenticated_select" ON "public"."booking_state_history" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."bookings" "b"
     JOIN "public"."restaurant_memberships" "rm" ON (("rm"."restaurant_id" = "b"."restaurant_id")))
  WHERE (("b"."id" = "booking_state_history"."booking_id") AND ("rm"."user_id" = "auth"."uid"())))));



CREATE POLICY "authenticated_select" ON "public"."booking_table_assignments" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."bookings" "b"
     JOIN "public"."restaurant_memberships" "rm" ON (("rm"."restaurant_id" = "b"."restaurant_id")))
  WHERE (("b"."id" = "booking_table_assignments"."booking_id") AND ("rm"."user_id" = "auth"."uid"())))));



CREATE POLICY "authenticated_select" ON "public"."table_merge_graph" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."restaurant_memberships" "rm"
  WHERE (("rm"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("rm"."restaurant_id" = "table_merge_graph"."restaurant_id")))));



ALTER TABLE "public"."booking_assignment_attempts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."booking_assignment_idempotency" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."booking_confirmation_results" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."booking_occasions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."booking_occasions_audit" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."booking_slots" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."booking_state_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."booking_table_assignments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."booking_versions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bookings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."capacity_outbox" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."customer_profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."customers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."demand_profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."email_delivery_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."feature_flag_overrides" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."leads" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."manual_assignment_sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."merge_rules" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."observability_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "owners_admins_can_update" ON "public"."restaurants" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."restaurant_memberships" "rm"
  WHERE (("rm"."restaurant_id" = "restaurants"."id") AND ("rm"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("rm"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."restaurant_memberships" "rm"
  WHERE (("rm"."restaurant_id" = "restaurants"."id") AND ("rm"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("rm"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text"]))))));



CREATE POLICY "owners_can_delete" ON "public"."restaurants" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."restaurant_memberships" "rm"
  WHERE (("rm"."restaurant_id" = "restaurants"."id") AND ("rm"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("rm"."role" = 'owner'::"text")))));



ALTER TABLE "public"."profile_update_requests" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profile_update_requests_delete" ON "public"."profile_update_requests" FOR DELETE USING (("profile_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "profile_update_requests_insert" ON "public"."profile_update_requests" FOR INSERT WITH CHECK (("profile_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "profile_update_requests_select" ON "public"."profile_update_requests" FOR SELECT USING (("profile_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "profile_update_requests_update" ON "public"."profile_update_requests" FOR UPDATE USING (("profile_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("profile_id" = ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."restaurant_capacity_rules" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."restaurant_invites" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."restaurant_memberships" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."restaurant_operating_hours" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."restaurant_service_periods" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."restaurant_turn_bands" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."restaurants" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."service_policy" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "service_role_all" ON "public"."_migrations" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_all" ON "public"."allocations" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_all" ON "public"."analytics_events" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_all" ON "public"."audit_logs" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_all" ON "public"."booking_assignment_attempts" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_all" ON "public"."booking_assignment_idempotency" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_all" ON "public"."booking_occasions_audit" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_all" ON "public"."booking_state_history" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_all" ON "public"."booking_table_assignments" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_all" ON "public"."booking_versions" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_all" ON "public"."feature_flag_overrides" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_all" ON "public"."leads" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_all" ON "public"."manual_assignment_sessions" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_all" ON "public"."observability_events" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_all" ON "public"."profiles" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_all" ON "public"."table_hold_windows" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_all" ON "public"."table_merge_graph" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_all" ON "public"."user_profiles" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_all" ON "public"."waiting_list" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_all_access" ON "public"."restaurants" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_read_all" ON "public"."restaurants" FOR SELECT TO "service_role" USING (true);



ALTER TABLE "public"."strategic_configs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."table_adjacencies" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."table_hold_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."table_hold_windows" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."table_holds" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."table_inventory" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."table_merge_graph" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."table_scarcity_metrics" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."table_soft_holds" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."waiting_list" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."zone_floorplan_edit_locks" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "zone_floorplan_edit_locks_select_members" ON "public"."zone_floorplan_edit_locks" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."restaurant_memberships" "m"
  WHERE (("m"."user_id" = "auth"."uid"()) AND ("m"."restaurant_id" = "zone_floorplan_edit_locks"."restaurant_id")))));



CREATE POLICY "zone_floorplan_edit_locks_write_admin" ON "public"."zone_floorplan_edit_locks" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."restaurant_memberships" "m"
  WHERE (("m"."user_id" = "auth"."uid"()) AND ("m"."restaurant_id" = "zone_floorplan_edit_locks"."restaurant_id") AND ("m"."role" = ANY (ARRAY['owner'::"text", 'manager'::"text"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."restaurant_memberships" "m"
  WHERE (("m"."user_id" = "auth"."uid"()) AND ("m"."restaurant_id" = "zone_floorplan_edit_locks"."restaurant_id") AND ("m"."role" = ANY (ARRAY['owner'::"text", 'manager'::"text"]))))));



ALTER TABLE "public"."zone_floorplan_layout_versions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "zone_floorplan_layout_versions_insert_admin" ON "public"."zone_floorplan_layout_versions" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."restaurant_memberships" "m"
  WHERE (("m"."user_id" = "auth"."uid"()) AND ("m"."restaurant_id" = "zone_floorplan_layout_versions"."restaurant_id") AND ("m"."role" = ANY (ARRAY['owner'::"text", 'manager'::"text"]))))));



CREATE POLICY "zone_floorplan_layout_versions_select_members" ON "public"."zone_floorplan_layout_versions" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."restaurant_memberships" "m"
  WHERE (("m"."user_id" = "auth"."uid"()) AND ("m"."restaurant_id" = "zone_floorplan_layout_versions"."restaurant_id")))));



ALTER TABLE "public"."zones" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."acquire_soft_holds_atomic"("p_table_ids" "uuid"[], "p_window" "tstzrange", "p_session_token" "uuid", "p_restaurant_id" "uuid", "p_booking_id" "uuid", "p_ttl_seconds" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."acquire_soft_holds_atomic"("p_table_ids" "uuid"[], "p_window" "tstzrange", "p_session_token" "uuid", "p_restaurant_id" "uuid", "p_booking_id" "uuid", "p_ttl_seconds" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."acquire_soft_holds_atomic"("p_table_ids" "uuid"[], "p_window" "tstzrange", "p_session_token" "uuid", "p_restaurant_id" "uuid", "p_booking_id" "uuid", "p_ttl_seconds" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."acquire_zone_floorplan_lock_v1"("p_zone_id" "uuid", "p_restaurant_id" "uuid", "p_user_id" "uuid", "p_ttl_seconds" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."acquire_zone_floorplan_lock_v1"("p_zone_id" "uuid", "p_restaurant_id" "uuid", "p_user_id" "uuid", "p_ttl_seconds" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."acquire_zone_floorplan_lock_v1"("p_zone_id" "uuid", "p_restaurant_id" "uuid", "p_user_id" "uuid", "p_ttl_seconds" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."acquire_zone_floorplan_lock_v1"("p_zone_id" "uuid", "p_restaurant_id" "uuid", "p_user_id" "uuid", "p_ttl_seconds" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."allocations_overlap"("a" "tstzrange", "b" "tstzrange") TO "anon";
GRANT ALL ON FUNCTION "public"."allocations_overlap"("a" "tstzrange", "b" "tstzrange") TO "authenticated";
GRANT ALL ON FUNCTION "public"."allocations_overlap"("a" "tstzrange", "b" "tstzrange") TO "service_role";



GRANT ALL ON FUNCTION "public"."allowed_capacities_set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."allowed_capacities_set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."allowed_capacities_set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."apply_booking_state_transition"("p_booking_id" "uuid", "p_status" "public"."booking_status", "p_checked_in_at" timestamp with time zone, "p_checked_out_at" timestamp with time zone, "p_updated_at" timestamp with time zone, "p_history_from" "public"."booking_status", "p_history_to" "public"."booking_status", "p_history_changed_by" "uuid", "p_history_changed_at" timestamp with time zone, "p_history_reason" "text", "p_history_metadata" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."apply_booking_state_transition"("p_booking_id" "uuid", "p_status" "public"."booking_status", "p_checked_in_at" timestamp with time zone, "p_checked_out_at" timestamp with time zone, "p_updated_at" timestamp with time zone, "p_history_from" "public"."booking_status", "p_history_to" "public"."booking_status", "p_history_changed_by" "uuid", "p_history_changed_at" timestamp with time zone, "p_history_reason" "text", "p_history_metadata" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."apply_booking_state_transition"("p_booking_id" "uuid", "p_status" "public"."booking_status", "p_checked_in_at" timestamp with time zone, "p_checked_out_at" timestamp with time zone, "p_updated_at" timestamp with time zone, "p_history_from" "public"."booking_status", "p_history_to" "public"."booking_status", "p_history_changed_by" "uuid", "p_history_changed_at" timestamp with time zone, "p_history_reason" "text", "p_history_metadata" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."apply_zone_floorplan_layout_v1"("p_zone_id" "uuid", "p_restaurant_id" "uuid", "p_user_id" "uuid", "p_payload" "jsonb", "p_note" "text", "p_restored_from" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."apply_zone_floorplan_layout_v1"("p_zone_id" "uuid", "p_restaurant_id" "uuid", "p_user_id" "uuid", "p_payload" "jsonb", "p_note" "text", "p_restored_from" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."apply_zone_floorplan_layout_v1"("p_zone_id" "uuid", "p_restaurant_id" "uuid", "p_user_id" "uuid", "p_payload" "jsonb", "p_note" "text", "p_restored_from" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."apply_zone_floorplan_layout_v1"("p_zone_id" "uuid", "p_restaurant_id" "uuid", "p_user_id" "uuid", "p_payload" "jsonb", "p_note" "text", "p_restored_from" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."are_tables_connected"("table_ids" "uuid"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."are_tables_connected"("table_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."are_tables_connected"("table_ids" "uuid"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."assign_merged_tables"("p_booking_id" "uuid", "p_table_ids" "uuid"[], "p_require_adjacency" boolean, "p_assigned_by" "uuid", "p_idempotency_key" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."assign_merged_tables"("p_booking_id" "uuid", "p_table_ids" "uuid"[], "p_require_adjacency" boolean, "p_assigned_by" "uuid", "p_idempotency_key" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."assign_merged_tables"("p_booking_id" "uuid", "p_table_ids" "uuid"[], "p_require_adjacency" boolean, "p_assigned_by" "uuid", "p_idempotency_key" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."assign_single_table"("p_booking_id" "uuid", "p_table_id" "uuid", "p_assigned_by" "uuid", "p_idempotency_key" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."assign_single_table"("p_booking_id" "uuid", "p_table_id" "uuid", "p_assigned_by" "uuid", "p_idempotency_key" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."assign_single_table"("p_booking_id" "uuid", "p_table_id" "uuid", "p_assigned_by" "uuid", "p_idempotency_key" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."assign_tables_atomic"("p_booking_id" "uuid", "p_table_ids" "uuid"[], "p_window" "tstzrange", "p_assigned_by" "uuid", "p_idempotency_key" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."assign_tables_atomic"("p_booking_id" "uuid", "p_table_ids" "uuid"[], "p_window" "tstzrange", "p_assigned_by" "uuid", "p_idempotency_key" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."assign_tables_atomic"("p_booking_id" "uuid", "p_table_ids" "uuid"[], "p_window" "tstzrange", "p_assigned_by" "uuid", "p_idempotency_key" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."assign_tables_atomic_v2"("p_booking_id" "uuid", "p_table_ids" "uuid"[], "p_idempotency_key" "text", "p_require_adjacency" boolean, "p_assigned_by" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."assign_tables_atomic_v2"("p_booking_id" "uuid", "p_table_ids" "uuid"[], "p_idempotency_key" "text", "p_require_adjacency" boolean, "p_assigned_by" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."assign_tables_atomic_v2"("p_booking_id" "uuid", "p_table_ids" "uuid"[], "p_idempotency_key" "text", "p_require_adjacency" boolean, "p_assigned_by" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."assign_tables_atomic_v2"("p_booking_id" "uuid", "p_table_ids" "uuid"[], "p_idempotency_key" "text", "p_require_adjacency" boolean, "p_assigned_by" "uuid", "p_start_at" timestamp with time zone, "p_end_at" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."assign_tables_atomic_v2"("p_booking_id" "uuid", "p_table_ids" "uuid"[], "p_idempotency_key" "text", "p_require_adjacency" boolean, "p_assigned_by" "uuid", "p_start_at" timestamp with time zone, "p_end_at" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."assign_tables_atomic_v2"("p_booking_id" "uuid", "p_table_ids" "uuid"[], "p_idempotency_key" "text", "p_require_adjacency" boolean, "p_assigned_by" "uuid", "p_start_at" timestamp with time zone, "p_end_at" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."booking_status_summary"("p_restaurant_id" "uuid", "p_start_date" "date", "p_end_date" "date", "p_status_filter" "public"."booking_status"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."booking_status_summary"("p_restaurant_id" "uuid", "p_start_date" "date", "p_end_date" "date", "p_status_filter" "public"."booking_status"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."booking_status_summary"("p_restaurant_id" "uuid", "p_start_date" "date", "p_end_date" "date", "p_status_filter" "public"."booking_status"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."check_soft_hold_ownership"("p_session_token" "uuid", "p_table_ids" "uuid"[], "p_window" "tstzrange") TO "anon";
GRANT ALL ON FUNCTION "public"."check_soft_hold_ownership"("p_session_token" "uuid", "p_table_ids" "uuid"[], "p_window" "tstzrange") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_soft_hold_ownership"("p_session_token" "uuid", "p_table_ids" "uuid"[], "p_window" "tstzrange") TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_expired_soft_holds"("p_batch_size" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_expired_soft_holds"("p_batch_size" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_expired_soft_holds"("p_batch_size" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."confirm_hold_assignment_tx"("p_hold_id" "uuid", "p_booking_id" "uuid", "p_idempotency_key" "text", "p_require_adjacency" boolean, "p_assigned_by" "uuid", "p_window_start" timestamp with time zone, "p_window_end" timestamp with time zone, "p_expected_policy_version" "text", "p_expected_adjacency_hash" "text", "p_target_status" "public"."booking_status", "p_history_reason" "text", "p_history_metadata" "jsonb", "p_history_changed_by" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."confirm_hold_assignment_tx"("p_hold_id" "uuid", "p_booking_id" "uuid", "p_idempotency_key" "text", "p_require_adjacency" boolean, "p_assigned_by" "uuid", "p_window_start" timestamp with time zone, "p_window_end" timestamp with time zone, "p_expected_policy_version" "text", "p_expected_adjacency_hash" "text", "p_target_status" "public"."booking_status", "p_history_reason" "text", "p_history_metadata" "jsonb", "p_history_changed_by" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."confirm_hold_assignment_tx"("p_hold_id" "uuid", "p_booking_id" "uuid", "p_idempotency_key" "text", "p_require_adjacency" boolean, "p_assigned_by" "uuid", "p_window_start" timestamp with time zone, "p_window_end" timestamp with time zone, "p_expected_policy_version" "text", "p_expected_adjacency_hash" "text", "p_target_status" "public"."booking_status", "p_history_reason" "text", "p_history_metadata" "jsonb", "p_history_changed_by" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."confirm_hold_assignment_with_transition"("p_booking_id" "uuid", "p_table_ids" "uuid"[], "p_idempotency_key" "text", "p_require_adjacency" boolean, "p_assigned_by" "uuid", "p_start_at" timestamp with time zone, "p_end_at" timestamp with time zone, "p_target_status" "public"."booking_status", "p_history_changed_by" "uuid", "p_history_reason" "text", "p_history_metadata" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."confirm_hold_assignment_with_transition"("p_booking_id" "uuid", "p_table_ids" "uuid"[], "p_idempotency_key" "text", "p_require_adjacency" boolean, "p_assigned_by" "uuid", "p_start_at" timestamp with time zone, "p_end_at" timestamp with time zone, "p_target_status" "public"."booking_status", "p_history_changed_by" "uuid", "p_history_reason" "text", "p_history_metadata" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."confirm_hold_assignment_with_transition"("p_booking_id" "uuid", "p_table_ids" "uuid"[], "p_idempotency_key" "text", "p_require_adjacency" boolean, "p_assigned_by" "uuid", "p_start_at" timestamp with time zone, "p_end_at" timestamp with time zone, "p_target_status" "public"."booking_status", "p_history_changed_by" "uuid", "p_history_reason" "text", "p_history_metadata" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_booking_with_capacity_check"("p_restaurant_id" "uuid", "p_customer_id" "uuid", "p_booking_date" "date", "p_start_time" time without time zone, "p_end_time" time without time zone, "p_party_size" integer, "p_booking_type" "text", "p_customer_name" "text", "p_customer_email" "text", "p_customer_phone" "text", "p_seating_preference" "text", "p_notes" "text", "p_marketing_opt_in" boolean, "p_idempotency_key" "text", "p_source" "text", "p_auth_user_id" "uuid", "p_client_request_id" "text", "p_details" "jsonb", "p_loyalty_points_awarded" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."create_booking_with_capacity_check"("p_restaurant_id" "uuid", "p_customer_id" "uuid", "p_booking_date" "date", "p_start_time" time without time zone, "p_end_time" time without time zone, "p_party_size" integer, "p_booking_type" "text", "p_customer_name" "text", "p_customer_email" "text", "p_customer_phone" "text", "p_seating_preference" "text", "p_notes" "text", "p_marketing_opt_in" boolean, "p_idempotency_key" "text", "p_source" "text", "p_auth_user_id" "uuid", "p_client_request_id" "text", "p_details" "jsonb", "p_loyalty_points_awarded" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_booking_with_capacity_check"("p_restaurant_id" "uuid", "p_customer_id" "uuid", "p_booking_date" "date", "p_start_time" time without time zone, "p_end_time" time without time zone, "p_party_size" integer, "p_booking_type" "text", "p_customer_name" "text", "p_customer_email" "text", "p_customer_phone" "text", "p_seating_preference" "text", "p_notes" "text", "p_marketing_opt_in" boolean, "p_idempotency_key" "text", "p_source" "text", "p_auth_user_id" "uuid", "p_client_request_id" "text", "p_details" "jsonb", "p_loyalty_points_awarded" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."current_restaurant_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."current_restaurant_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."current_restaurant_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."enforce_bar_drinks_only"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_bar_drinks_only"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_bar_drinks_only"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_booking_reference"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_booking_reference"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_booking_reference"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_or_create_booking_slot"("p_restaurant_id" "uuid", "p_slot_date" "date", "p_slot_time" time without time zone, "p_default_capacity" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_or_create_booking_slot"("p_restaurant_id" "uuid", "p_slot_date" "date", "p_slot_time" time without time zone, "p_default_capacity" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_or_create_booking_slot"("p_restaurant_id" "uuid", "p_slot_date" "date", "p_slot_time" time without time zone, "p_default_capacity" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_booking_slot_version"() TO "anon";
GRANT ALL ON FUNCTION "public"."increment_booking_slot_version"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_booking_slot_version"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_holds_strict_conflicts_enabled"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_holds_strict_conflicts_enabled"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_holds_strict_conflicts_enabled"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_table_available_v2"("p_table_id" "uuid", "p_start_at" timestamp with time zone, "p_end_at" timestamp with time zone, "p_exclude_booking_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_table_available_v2"("p_table_id" "uuid", "p_start_at" timestamp with time zone, "p_end_at" timestamp with time zone, "p_exclude_booking_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_table_available_v2"("p_table_id" "uuid", "p_start_at" timestamp with time zone, "p_end_at" timestamp with time zone, "p_exclude_booking_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."log_table_assignment_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_table_assignment_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_table_assignment_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."on_allocations_refresh"() TO "anon";
GRANT ALL ON FUNCTION "public"."on_allocations_refresh"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."on_allocations_refresh"() TO "service_role";



GRANT ALL ON FUNCTION "public"."on_booking_status_refresh"() TO "anon";
GRANT ALL ON FUNCTION "public"."on_booking_status_refresh"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."on_booking_status_refresh"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."ops_email_delivery_attempts_feed"("p_restaurant_id" "uuid", "p_range" "text", "p_page" integer, "p_page_size" integer, "p_statuses" "text"[], "p_recipient_email" "text", "p_message_id" "text", "p_booking_ref" "text", "p_template_type" "text", "p_email_type" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."ops_email_delivery_attempts_feed"("p_restaurant_id" "uuid", "p_range" "text", "p_page" integer, "p_page_size" integer, "p_statuses" "text"[], "p_recipient_email" "text", "p_message_id" "text", "p_booking_ref" "text", "p_template_type" "text", "p_email_type" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."ops_email_delivery_attempts_feed"("p_restaurant_id" "uuid", "p_range" "text", "p_page" integer, "p_page_size" integer, "p_statuses" "text"[], "p_recipient_email" "text", "p_message_id" "text", "p_booking_ref" "text", "p_template_type" "text", "p_email_type" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ops_email_delivery_attempts_feed"("p_restaurant_id" "uuid", "p_range" "text", "p_page" integer, "p_page_size" integer, "p_statuses" "text"[], "p_recipient_email" "text", "p_message_id" "text", "p_booking_ref" "text", "p_template_type" "text", "p_email_type" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."ops_email_delivery_attempts_summary"("p_restaurant_id" "uuid", "p_range" "text", "p_statuses" "text"[], "p_recipient_email" "text", "p_message_id" "text", "p_booking_ref" "text", "p_template_type" "text", "p_email_type" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."ops_email_delivery_attempts_summary"("p_restaurant_id" "uuid", "p_range" "text", "p_statuses" "text"[], "p_recipient_email" "text", "p_message_id" "text", "p_booking_ref" "text", "p_template_type" "text", "p_email_type" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."ops_email_delivery_attempts_summary"("p_restaurant_id" "uuid", "p_range" "text", "p_statuses" "text"[], "p_recipient_email" "text", "p_message_id" "text", "p_booking_ref" "text", "p_template_type" "text", "p_email_type" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ops_email_delivery_attempts_summary"("p_restaurant_id" "uuid", "p_range" "text", "p_statuses" "text"[], "p_recipient_email" "text", "p_message_id" "text", "p_booking_ref" "text", "p_template_type" "text", "p_email_type" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."process_late_arrivals"() TO "anon";
GRANT ALL ON FUNCTION "public"."process_late_arrivals"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."process_late_arrivals"() TO "service_role";



GRANT ALL ON FUNCTION "public"."prune_allocations_history"("p_cutoff" timestamp with time zone, "p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."prune_allocations_history"("p_cutoff" timestamp with time zone, "p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."prune_allocations_history"("p_cutoff" timestamp with time zone, "p_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."refresh_table_status"("p_table_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."refresh_table_status"("p_table_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."refresh_table_status"("p_table_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."release_hold_and_emit"("p_hold_id" "uuid", "p_actor_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."release_hold_and_emit"("p_hold_id" "uuid", "p_actor_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."release_hold_and_emit"("p_hold_id" "uuid", "p_actor_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."release_soft_holds"("p_session_token" "uuid", "p_table_ids" "uuid"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."release_soft_holds"("p_session_token" "uuid", "p_table_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."release_soft_holds"("p_session_token" "uuid", "p_table_ids" "uuid"[]) TO "service_role";



REVOKE ALL ON FUNCTION "public"."release_zone_floorplan_lock_v1"("p_zone_id" "uuid", "p_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."release_zone_floorplan_lock_v1"("p_zone_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."release_zone_floorplan_lock_v1"("p_zone_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."release_zone_floorplan_lock_v1"("p_zone_id" "uuid", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."require_restaurant_context"() TO "anon";
GRANT ALL ON FUNCTION "public"."require_restaurant_context"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."require_restaurant_context"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."restore_zone_floorplan_layout_v1"("p_zone_id" "uuid", "p_restaurant_id" "uuid", "p_user_id" "uuid", "p_version_id" "uuid", "p_note" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."restore_zone_floorplan_layout_v1"("p_zone_id" "uuid", "p_restaurant_id" "uuid", "p_user_id" "uuid", "p_version_id" "uuid", "p_note" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."restore_zone_floorplan_layout_v1"("p_zone_id" "uuid", "p_restaurant_id" "uuid", "p_user_id" "uuid", "p_version_id" "uuid", "p_note" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."restore_zone_floorplan_layout_v1"("p_zone_id" "uuid", "p_restaurant_id" "uuid", "p_user_id" "uuid", "p_version_id" "uuid", "p_note" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_booking_instants"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_booking_instants"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_booking_instants"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_booking_reference"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_booking_reference"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_booking_reference"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_hold_conflict_enforcement"("enabled" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."set_hold_conflict_enforcement"("enabled" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_hold_conflict_enforcement"("enabled" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "public"."set_restaurant_context"("p_restaurant_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_restaurant_context"("p_restaurant_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."set_restaurant_context"("p_restaurant_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_restaurant_context"("p_restaurant_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_timestamp_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_timestamp_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_timestamp_updated_at"() TO "service_role";



GRANT ALL ON TABLE "public"."booking_table_assignments" TO "anon";
GRANT ALL ON TABLE "public"."booking_table_assignments" TO "authenticated";
GRANT ALL ON TABLE "public"."booking_table_assignments" TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_confirmed_assignment_windows"("p_booking_id" "uuid", "p_table_ids" "uuid"[], "p_window_start" timestamp with time zone, "p_window_end" timestamp with time zone, "p_actor_id" "uuid", "p_hold_id" "uuid", "p_merge_group_id" "uuid", "p_idempotency_key" "text", "p_payload_checksum" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."sync_confirmed_assignment_windows"("p_booking_id" "uuid", "p_table_ids" "uuid"[], "p_window_start" timestamp with time zone, "p_window_end" timestamp with time zone, "p_actor_id" "uuid", "p_hold_id" "uuid", "p_merge_group_id" "uuid", "p_idempotency_key" "text", "p_payload_checksum" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_confirmed_assignment_windows"("p_booking_id" "uuid", "p_table_ids" "uuid"[], "p_window_start" timestamp with time zone, "p_window_end" timestamp with time zone, "p_actor_id" "uuid", "p_hold_id" "uuid", "p_merge_group_id" "uuid", "p_idempotency_key" "text", "p_payload_checksum" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_table_hold_windows"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_table_hold_windows"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_table_hold_windows"() TO "service_role";



GRANT ALL ON FUNCTION "public"."unassign_table_from_booking"("p_booking_id" "uuid", "p_table_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."unassign_table_from_booking"("p_booking_id" "uuid", "p_table_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."unassign_table_from_booking"("p_booking_id" "uuid", "p_table_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."unassign_tables_atomic"("p_booking_id" "uuid", "p_table_ids" "uuid"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."unassign_tables_atomic"("p_booking_id" "uuid", "p_table_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."unassign_tables_atomic"("p_booking_id" "uuid", "p_table_ids" "uuid"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."update_booking_with_capacity_check"("p_booking_id" "uuid", "p_restaurant_id" "uuid", "p_customer_id" "uuid", "p_booking_date" "date", "p_start_time" time without time zone, "p_end_time" time without time zone, "p_party_size" integer, "p_booking_type" "text", "p_customer_name" "text", "p_customer_email" "text", "p_customer_phone" "text", "p_seating_preference" "text", "p_notes" "text", "p_marketing_opt_in" boolean, "p_auth_user_id" "uuid", "p_client_request_id" "text", "p_details" "jsonb", "p_loyalty_points_awarded" integer, "p_source" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."update_booking_with_capacity_check"("p_booking_id" "uuid", "p_restaurant_id" "uuid", "p_customer_id" "uuid", "p_booking_date" "date", "p_start_time" time without time zone, "p_end_time" time without time zone, "p_party_size" integer, "p_booking_type" "text", "p_customer_name" "text", "p_customer_email" "text", "p_customer_phone" "text", "p_seating_preference" "text", "p_notes" "text", "p_marketing_opt_in" boolean, "p_auth_user_id" "uuid", "p_client_request_id" "text", "p_details" "jsonb", "p_loyalty_points_awarded" integer, "p_source" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_booking_with_capacity_check"("p_booking_id" "uuid", "p_restaurant_id" "uuid", "p_customer_id" "uuid", "p_booking_date" "date", "p_start_time" time without time zone, "p_end_time" time without time zone, "p_party_size" integer, "p_booking_type" "text", "p_customer_name" "text", "p_customer_email" "text", "p_customer_phone" "text", "p_seating_preference" "text", "p_notes" "text", "p_marketing_opt_in" boolean, "p_auth_user_id" "uuid", "p_client_request_id" "text", "p_details" "jsonb", "p_loyalty_points_awarded" integer, "p_source" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_table_hold_windows"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_table_hold_windows"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_table_hold_windows"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."user_restaurants"() TO "anon";
GRANT ALL ON FUNCTION "public"."user_restaurants"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_restaurants"() TO "service_role";



GRANT ALL ON FUNCTION "public"."user_restaurants_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."user_restaurants_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_restaurants_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_booking_capacity_after_assignment"("p_booking_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."validate_booking_capacity_after_assignment"("p_booking_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_booking_capacity_after_assignment"("p_booking_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_booking_has_assignments"() TO "anon";
GRANT ALL ON FUNCTION "public"."validate_booking_has_assignments"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_booking_has_assignments"() TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_table_adjacency"() TO "anon";
GRANT ALL ON FUNCTION "public"."validate_table_adjacency"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_table_adjacency"() TO "service_role";



GRANT ALL ON TABLE "public"."_migrations" TO "anon";
GRANT ALL ON TABLE "public"."_migrations" TO "authenticated";
GRANT ALL ON TABLE "public"."_migrations" TO "service_role";



GRANT ALL ON SEQUENCE "public"."_migrations_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."_migrations_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."_migrations_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."allocations" TO "anon";
GRANT ALL ON TABLE "public"."allocations" TO "authenticated";
GRANT ALL ON TABLE "public"."allocations" TO "service_role";



GRANT ALL ON TABLE "public"."allocations_archive" TO "anon";
GRANT ALL ON TABLE "public"."allocations_archive" TO "authenticated";
GRANT ALL ON TABLE "public"."allocations_archive" TO "service_role";



GRANT ALL ON TABLE "public"."allowed_capacities" TO "anon";
GRANT ALL ON TABLE "public"."allowed_capacities" TO "authenticated";
GRANT ALL ON TABLE "public"."allowed_capacities" TO "service_role";



GRANT ALL ON TABLE "public"."analytics_events" TO "anon";
GRANT ALL ON TABLE "public"."analytics_events" TO "authenticated";
GRANT ALL ON TABLE "public"."analytics_events" TO "service_role";



GRANT ALL ON TABLE "public"."audit_logs" TO "service_role";



GRANT ALL ON TABLE "public"."booking_assignment_attempts" TO "anon";
GRANT ALL ON TABLE "public"."booking_assignment_attempts" TO "authenticated";
GRANT ALL ON TABLE "public"."booking_assignment_attempts" TO "service_role";



GRANT ALL ON TABLE "public"."booking_assignment_idempotency" TO "service_role";



GRANT ALL ON TABLE "public"."booking_confirmation_results" TO "anon";
GRANT ALL ON TABLE "public"."booking_confirmation_results" TO "authenticated";
GRANT ALL ON TABLE "public"."booking_confirmation_results" TO "service_role";



GRANT ALL ON TABLE "public"."booking_occasions" TO "anon";
GRANT ALL ON TABLE "public"."booking_occasions" TO "authenticated";
GRANT ALL ON TABLE "public"."booking_occasions" TO "service_role";



GRANT ALL ON TABLE "public"."booking_occasions_audit" TO "anon";
GRANT ALL ON TABLE "public"."booking_occasions_audit" TO "authenticated";
GRANT ALL ON TABLE "public"."booking_occasions_audit" TO "service_role";



GRANT ALL ON TABLE "public"."booking_slots" TO "anon";
GRANT ALL ON TABLE "public"."booking_slots" TO "authenticated";
GRANT ALL ON TABLE "public"."booking_slots" TO "service_role";



GRANT ALL ON TABLE "public"."booking_state_history" TO "anon";
GRANT ALL ON TABLE "public"."booking_state_history" TO "authenticated";
GRANT ALL ON TABLE "public"."booking_state_history" TO "service_role";



GRANT ALL ON SEQUENCE "public"."booking_state_history_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."booking_state_history_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."booking_state_history_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."booking_versions" TO "anon";
GRANT ALL ON TABLE "public"."booking_versions" TO "authenticated";
GRANT ALL ON TABLE "public"."booking_versions" TO "service_role";



GRANT ALL ON TABLE "public"."bookings" TO "anon";
GRANT ALL ON TABLE "public"."bookings" TO "authenticated";
GRANT ALL ON TABLE "public"."bookings" TO "service_role";



GRANT ALL ON TABLE "public"."capacity_outbox" TO "anon";
GRANT ALL ON TABLE "public"."capacity_outbox" TO "authenticated";
GRANT ALL ON TABLE "public"."capacity_outbox" TO "service_role";



GRANT ALL ON TABLE "public"."customer_profiles" TO "anon";
GRANT ALL ON TABLE "public"."customer_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."customer_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."customers" TO "anon";
GRANT ALL ON TABLE "public"."customers" TO "authenticated";
GRANT ALL ON TABLE "public"."customers" TO "service_role";



GRANT ALL ON TABLE "public"."demand_profiles" TO "anon";
GRANT ALL ON TABLE "public"."demand_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."demand_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."email_delivery_log" TO "anon";
GRANT ALL ON TABLE "public"."email_delivery_log" TO "authenticated";
GRANT ALL ON TABLE "public"."email_delivery_log" TO "service_role";



GRANT ALL ON TABLE "public"."feature_flag_overrides" TO "service_role";



GRANT ALL ON TABLE "public"."leads" TO "anon";
GRANT ALL ON TABLE "public"."leads" TO "authenticated";
GRANT ALL ON TABLE "public"."leads" TO "service_role";



GRANT ALL ON TABLE "public"."manual_assignment_sessions" TO "anon";
GRANT ALL ON TABLE "public"."manual_assignment_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."manual_assignment_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."merge_rules" TO "anon";
GRANT ALL ON TABLE "public"."merge_rules" TO "authenticated";
GRANT ALL ON TABLE "public"."merge_rules" TO "service_role";



GRANT ALL ON TABLE "public"."observability_events" TO "anon";
GRANT ALL ON TABLE "public"."observability_events" TO "authenticated";
GRANT ALL ON TABLE "public"."observability_events" TO "service_role";



GRANT ALL ON TABLE "public"."profile_update_requests" TO "anon";
GRANT ALL ON TABLE "public"."profile_update_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."profile_update_requests" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."restaurant_capacity_rules" TO "anon";
GRANT ALL ON TABLE "public"."restaurant_capacity_rules" TO "authenticated";
GRANT ALL ON TABLE "public"."restaurant_capacity_rules" TO "service_role";



GRANT ALL ON TABLE "public"."restaurant_invites" TO "anon";
GRANT ALL ON TABLE "public"."restaurant_invites" TO "authenticated";
GRANT ALL ON TABLE "public"."restaurant_invites" TO "service_role";



GRANT ALL ON TABLE "public"."restaurant_memberships" TO "anon";
GRANT ALL ON TABLE "public"."restaurant_memberships" TO "authenticated";
GRANT ALL ON TABLE "public"."restaurant_memberships" TO "service_role";



GRANT ALL ON TABLE "public"."restaurant_operating_hours" TO "anon";
GRANT ALL ON TABLE "public"."restaurant_operating_hours" TO "authenticated";
GRANT ALL ON TABLE "public"."restaurant_operating_hours" TO "service_role";



GRANT ALL ON TABLE "public"."restaurant_service_periods" TO "anon";
GRANT ALL ON TABLE "public"."restaurant_service_periods" TO "authenticated";
GRANT ALL ON TABLE "public"."restaurant_service_periods" TO "service_role";



GRANT ALL ON TABLE "public"."restaurant_turn_bands" TO "anon";
GRANT ALL ON TABLE "public"."restaurant_turn_bands" TO "authenticated";
GRANT ALL ON TABLE "public"."restaurant_turn_bands" TO "service_role";



GRANT ALL ON TABLE "public"."restaurants" TO "anon";
GRANT ALL ON TABLE "public"."restaurants" TO "authenticated";
GRANT ALL ON TABLE "public"."restaurants" TO "service_role";



GRANT ALL ON TABLE "public"."service_policy" TO "anon";
GRANT ALL ON TABLE "public"."service_policy" TO "authenticated";
GRANT ALL ON TABLE "public"."service_policy" TO "service_role";



GRANT ALL ON TABLE "public"."strategic_configs" TO "anon";
GRANT ALL ON TABLE "public"."strategic_configs" TO "authenticated";
GRANT ALL ON TABLE "public"."strategic_configs" TO "service_role";



GRANT ALL ON TABLE "public"."table_adjacencies" TO "anon";
GRANT ALL ON TABLE "public"."table_adjacencies" TO "authenticated";
GRANT ALL ON TABLE "public"."table_adjacencies" TO "service_role";



GRANT ALL ON TABLE "public"."table_hold_members" TO "anon";
GRANT ALL ON TABLE "public"."table_hold_members" TO "authenticated";
GRANT ALL ON TABLE "public"."table_hold_members" TO "service_role";



GRANT ALL ON TABLE "public"."table_hold_windows" TO "service_role";



GRANT ALL ON TABLE "public"."table_holds" TO "anon";
GRANT ALL ON TABLE "public"."table_holds" TO "authenticated";
GRANT ALL ON TABLE "public"."table_holds" TO "service_role";



GRANT ALL ON TABLE "public"."table_inventory" TO "anon";
GRANT ALL ON TABLE "public"."table_inventory" TO "authenticated";
GRANT ALL ON TABLE "public"."table_inventory" TO "service_role";



GRANT ALL ON TABLE "public"."table_merge_graph" TO "anon";
GRANT ALL ON TABLE "public"."table_merge_graph" TO "authenticated";
GRANT ALL ON TABLE "public"."table_merge_graph" TO "service_role";



GRANT ALL ON TABLE "public"."table_scarcity_metrics" TO "anon";
GRANT ALL ON TABLE "public"."table_scarcity_metrics" TO "authenticated";
GRANT ALL ON TABLE "public"."table_scarcity_metrics" TO "service_role";



GRANT ALL ON TABLE "public"."table_soft_holds" TO "service_role";



GRANT ALL ON TABLE "public"."user_profiles" TO "anon";
GRANT ALL ON TABLE "public"."user_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."waiting_list" TO "anon";
GRANT ALL ON TABLE "public"."waiting_list" TO "authenticated";
GRANT ALL ON TABLE "public"."waiting_list" TO "service_role";



GRANT ALL ON TABLE "public"."zone_floorplan_edit_locks" TO "anon";
GRANT ALL ON TABLE "public"."zone_floorplan_edit_locks" TO "authenticated";
GRANT ALL ON TABLE "public"."zone_floorplan_edit_locks" TO "service_role";



GRANT ALL ON TABLE "public"."zone_floorplan_layout_versions" TO "anon";
GRANT ALL ON TABLE "public"."zone_floorplan_layout_versions" TO "authenticated";
GRANT ALL ON TABLE "public"."zone_floorplan_layout_versions" TO "service_role";



GRANT ALL ON TABLE "public"."zones" TO "anon";
GRANT ALL ON TABLE "public"."zones" TO "authenticated";
GRANT ALL ON TABLE "public"."zones" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







