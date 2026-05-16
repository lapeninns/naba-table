-- Harden soft-hold RPC authorization.
--
-- Finding coverage:
-- - .deepsec/findings/HIGH/nabatableLP-acl-check-9240a2b462.md
-- - .deepsec/findings/HIGH/nabatableLP-acl-check-c6eca39736.md
--
-- Safety / rollback:
-- - Forward-only permission narrowing: app callers use service clients after
--   route-level membership authorization.
-- - If emergency rollback is required, re-grant the three non-cleanup RPCs to
--   authenticated while investigating the app caller that still depends on
--   direct client RPC access.

CREATE OR REPLACE FUNCTION public.acquire_soft_holds_atomic(
  p_table_ids uuid[],
  p_window tstzrange,
  p_session_token uuid,
  p_restaurant_id uuid,
  p_booking_id uuid DEFAULT NULL,
  p_ttl_seconds integer DEFAULT 10
) RETURNS TABLE(
  table_id uuid,
  acquired boolean,
  blocking_session uuid,
  blocking_expires_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_now timestamptz := timezone('utc', now());
  v_ttl_seconds integer := GREATEST(5, LEAST(COALESCE(p_ttl_seconds, 10), 30));
  v_expires_at timestamptz := v_now + make_interval(secs => v_ttl_seconds);
  v_table_id uuid;
  v_requested_table_ids uuid[];
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

  IF p_restaurant_id IS NULL THEN
    RAISE EXCEPTION 'acquire_soft_holds_atomic requires a restaurant id'
      USING ERRCODE = '23514';
  END IF;

  SELECT array_agg(DISTINCT input.id ORDER BY input.id)
  INTO v_requested_table_ids
  FROM unnest(p_table_ids) AS input(id);

  SELECT array_agg(ti.id ORDER BY ti.id)
  INTO v_sorted_table_ids
  FROM public.table_inventory ti
  WHERE ti.id = ANY(v_requested_table_ids)
    AND ti.restaurant_id = p_restaurant_id;

  IF COALESCE(array_length(v_sorted_table_ids, 1), 0) <> array_length(v_requested_table_ids, 1) THEN
    RAISE EXCEPTION 'soft-hold tables must belong to the supplied restaurant'
      USING ERRCODE = '42501';
  END IF;

  IF p_booking_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.bookings b
    WHERE b.id = p_booking_id
      AND b.restaurant_id = p_restaurant_id
  ) THEN
    RAISE EXCEPTION 'soft-hold booking must belong to the supplied restaurant'
      USING ERRCODE = '42501';
  END IF;

  -- Best-effort cleanup for these tables.
  DELETE FROM public.table_soft_holds sh
  WHERE sh.table_id = ANY(v_sorted_table_ids)
    AND sh.expires_at <= v_now;

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
      blocking_session := NULL;
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
        UPDATE public.table_soft_holds sh
        SET expires_at = v_expires_at,
            restaurant_id = p_restaurant_id,
            booking_id = p_booking_id
        WHERE sh.table_id = v_table_id
          AND sh.session_token = p_session_token
          AND sh.expires_at > v_now;
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
            SELECT sh.expires_at
            INTO v_blocking
            FROM public.table_soft_holds sh
            WHERE sh.table_id = v_table_id
              AND sh.expires_at > v_now
              AND sh.hold_window && p_window
            LIMIT 1;

            v_all_acquired := false;
            table_id := v_table_id;
            acquired := false;
            blocking_session := NULL;
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
    DELETE FROM public.table_soft_holds sh
    WHERE sh.table_id = ANY(v_acquired_ids)
      AND sh.session_token = p_session_token;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.acquire_soft_holds_atomic(uuid[], tstzrange, uuid, uuid, uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.acquire_soft_holds_atomic(uuid[], tstzrange, uuid, uuid, uuid, integer) FROM anon;
REVOKE ALL ON FUNCTION public.acquire_soft_holds_atomic(uuid[], tstzrange, uuid, uuid, uuid, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.acquire_soft_holds_atomic(uuid[], tstzrange, uuid, uuid, uuid, integer) TO service_role;

REVOKE ALL ON FUNCTION public.release_soft_holds(uuid, uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.release_soft_holds(uuid, uuid[]) FROM anon;
REVOKE ALL ON FUNCTION public.release_soft_holds(uuid, uuid[]) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.release_soft_holds(uuid, uuid[]) TO service_role;

REVOKE ALL ON FUNCTION public.check_soft_hold_ownership(uuid, uuid[], tstzrange) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.check_soft_hold_ownership(uuid, uuid[], tstzrange) FROM anon;
REVOKE ALL ON FUNCTION public.check_soft_hold_ownership(uuid, uuid[], tstzrange) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.check_soft_hold_ownership(uuid, uuid[], tstzrange) TO service_role;

REVOKE ALL ON FUNCTION public.cleanup_expired_soft_holds(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cleanup_expired_soft_holds(integer) FROM anon;
REVOKE ALL ON FUNCTION public.cleanup_expired_soft_holds(integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_soft_holds(integer) TO service_role;
