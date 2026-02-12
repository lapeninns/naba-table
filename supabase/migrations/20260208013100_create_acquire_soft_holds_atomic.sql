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

