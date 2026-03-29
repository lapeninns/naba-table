-- Migration: add_ops_customers_history_rpc
-- Purpose: Move ops customers guest-history filtering/sorting/pagination into Postgres
-- while preserving live booking semantics (not customer_profiles snapshots).

CREATE OR REPLACE FUNCTION public.ops_customers_history_base(
  p_restaurant_id uuid,
  p_search text DEFAULT NULL,
  p_marketing_opt_in text DEFAULT 'all',
  p_last_visit text DEFAULT 'any',
  p_min_bookings integer DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  restaurant_id uuid,
  name text,
  email text,
  phone text,
  marketing_opt_in boolean,
  created_at timestamptz,
  updated_at timestamptz,
  first_booking_at timestamptz,
  last_visit_at timestamptz,
  total_bookings integer,
  total_covers integer,
  total_cancellations integer,
  total_count integer
)
LANGUAGE sql
STABLE
AS $$
  WITH normalized AS (
    SELECT
      p_restaurant_id AS restaurant_id,
      CASE
        WHEN NULLIF(trim(p_search), '') IS NULL THEN NULL
        ELSE '%' || replace(replace(NULLIF(trim(p_search), ''), '%', '\%'), '_', '\_') || '%'
      END AS search_pattern,
      CASE COALESCE(NULLIF(trim(p_marketing_opt_in), ''), 'all')
        WHEN 'opted_in' THEN 'opted_in'
        WHEN 'opted_out' THEN 'opted_out'
        ELSE 'all'
      END AS marketing_opt_in,
      CASE COALESCE(NULLIF(trim(p_last_visit), ''), 'any')
        WHEN '30d' THEN '30d'
        WHEN '90d' THEN '90d'
        WHEN '365d' THEN '365d'
        WHEN 'never' THEN 'never'
        ELSE 'any'
      END AS last_visit,
      GREATEST(COALESCE(p_min_bookings, 0), 0) AS min_bookings,
      now() AS now_ts
  ),
  customer_identity AS (
    SELECT
      c.id,
      c.restaurant_id,
      c.full_name AS name,
      c.email,
      c.phone,
      c.marketing_opt_in,
      c.created_at,
      c.updated_at
    FROM public.customers c
    JOIN normalized n ON c.restaurant_id = n.restaurant_id
    WHERE (
      n.marketing_opt_in = 'all'
      OR (n.marketing_opt_in = 'opted_in' AND c.marketing_opt_in = true)
      OR (n.marketing_opt_in = 'opted_out' AND c.marketing_opt_in = false)
    )
      AND (
        n.search_pattern IS NULL
        OR c.full_name ILIKE n.search_pattern ESCAPE '\'
        OR c.email ILIKE n.search_pattern ESCAPE '\'
        OR c.phone ILIKE n.search_pattern ESCAPE '\'
      )
  ),
  booking_rollups AS (
    SELECT
      b.customer_id,
      MIN(COALESCE(b.start_at, b.created_at))
        FILTER (WHERE b.status <> 'PRIORITY_WAITLIST') AS first_booking_at,
      MAX(COALESCE(b.start_at, b.created_at))
        FILTER (
          WHERE b.status <> 'PRIORITY_WAITLIST'
            AND b.status <> 'cancelled'
            AND b.status <> 'no_show'
            AND COALESCE(b.start_at, b.created_at) <= (SELECT now_ts FROM normalized)
        ) AS last_visit_at,
      COUNT(*) FILTER (WHERE b.status <> 'PRIORITY_WAITLIST')::integer AS total_bookings,
      COALESCE(SUM(b.party_size) FILTER (WHERE b.status <> 'PRIORITY_WAITLIST'), 0)::integer AS total_covers,
      COUNT(*) FILTER (WHERE b.status IN ('cancelled', 'no_show'))::integer AS total_cancellations
    FROM public.bookings b
    JOIN customer_identity ci ON ci.id = b.customer_id
    JOIN normalized n ON b.restaurant_id = n.restaurant_id
    GROUP BY b.customer_id
  ),
  history AS (
    SELECT
      ci.id,
      ci.restaurant_id,
      ci.name,
      ci.email,
      ci.phone,
      ci.marketing_opt_in,
      ci.created_at,
      ci.updated_at,
      br.first_booking_at,
      br.last_visit_at,
      COALESCE(br.total_bookings, 0) AS total_bookings,
      COALESCE(br.total_covers, 0) AS total_covers,
      COALESCE(br.total_cancellations, 0) AS total_cancellations
    FROM customer_identity ci
    LEFT JOIN booking_rollups br ON br.customer_id = ci.id
  )
  SELECT
    h.id,
    h.restaurant_id,
    h.name,
    h.email,
    h.phone,
    h.marketing_opt_in,
    h.created_at,
    h.updated_at,
    h.first_booking_at,
    h.last_visit_at,
    h.total_bookings,
    h.total_covers,
    h.total_cancellations
  FROM history h
  JOIN normalized n ON true
  WHERE h.total_bookings >= n.min_bookings
    AND (
      n.last_visit = 'any'
      OR (n.last_visit = 'never' AND h.last_visit_at IS NULL)
      OR (n.last_visit = '30d' AND h.last_visit_at >= n.now_ts - interval '30 days')
      OR (n.last_visit = '90d' AND h.last_visit_at >= n.now_ts - interval '90 days')
      OR (n.last_visit = '365d' AND h.last_visit_at >= n.now_ts - interval '365 days')
    );
$$;

CREATE OR REPLACE FUNCTION public.ops_customers_history_feed(
  p_restaurant_id uuid,
  p_search text DEFAULT NULL,
  p_marketing_opt_in text DEFAULT 'all',
  p_last_visit text DEFAULT 'any',
  p_min_bookings integer DEFAULT 0,
  p_sort_by text DEFAULT 'last_visit',
  p_sort_order text DEFAULT 'desc',
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 50
)
RETURNS TABLE (
  id uuid,
  restaurant_id uuid,
  name text,
  email text,
  phone text,
  marketing_opt_in boolean,
  created_at timestamptz,
  updated_at timestamptz,
  first_booking_at timestamptz,
  last_visit_at timestamptz,
  total_bookings integer,
  total_covers integer,
  total_cancellations integer
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_sort_by text;
  v_sort_order text;
  v_page integer;
  v_page_size integer;
  v_offset integer;
  v_limit integer;
BEGIN
  IF p_restaurant_id IS NULL THEN
    RAISE EXCEPTION 'p_restaurant_id is required' USING ERRCODE = '22004';
  END IF;

  v_sort_by := CASE COALESCE(NULLIF(trim(p_sort_by), ''), 'last_visit')
    WHEN 'bookings' THEN 'bookings'
    ELSE 'last_visit'
  END;
  v_sort_order := CASE COALESCE(NULLIF(trim(p_sort_order), ''), 'desc')
    WHEN 'asc' THEN 'asc'
    ELSE 'desc'
  END;
  v_page := GREATEST(COALESCE(p_page, 1), 1);
  v_page_size := LEAST(GREATEST(COALESCE(p_page_size, 50), 1), 500);
  v_offset := (v_page - 1) * v_page_size;
  v_limit := v_page_size + 1;

  IF v_sort_by = 'bookings' THEN
    IF v_sort_order = 'asc' THEN
      RETURN QUERY
      SELECT
        *,
        COUNT(*) OVER ()::integer AS total_count
      FROM public.ops_customers_history_base(
        p_restaurant_id,
        p_search,
        p_marketing_opt_in,
        p_last_visit,
        p_min_bookings
      )
      ORDER BY total_bookings ASC, name ASC
      OFFSET v_offset
      LIMIT v_limit;
    ELSE
      RETURN QUERY
      SELECT
        *,
        COUNT(*) OVER ()::integer AS total_count
      FROM public.ops_customers_history_base(
        p_restaurant_id,
        p_search,
        p_marketing_opt_in,
        p_last_visit,
        p_min_bookings
      )
      ORDER BY total_bookings DESC, name ASC
      OFFSET v_offset
      LIMIT v_limit;
    END IF;
  END IF;

  IF v_sort_order = 'asc' THEN
    RETURN QUERY
    SELECT
      *,
      COUNT(*) OVER ()::integer AS total_count
    FROM public.ops_customers_history_base(
      p_restaurant_id,
      p_search,
      p_marketing_opt_in,
      p_last_visit,
      p_min_bookings
    )
    ORDER BY
      CASE WHEN last_visit_at IS NULL THEN 1 ELSE 0 END ASC,
      last_visit_at ASC,
      name ASC
    OFFSET v_offset
    LIMIT v_limit;
  ELSE
    RETURN QUERY
    SELECT
      *,
      COUNT(*) OVER ()::integer AS total_count
    FROM public.ops_customers_history_base(
      p_restaurant_id,
      p_search,
      p_marketing_opt_in,
      p_last_visit,
      p_min_bookings
    )
    ORDER BY
      CASE WHEN last_visit_at IS NULL THEN 1 ELSE 0 END ASC,
      last_visit_at DESC,
      name ASC
    OFFSET v_offset
    LIMIT v_limit;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.ops_customers_history_summary(
  p_restaurant_id uuid,
  p_search text DEFAULT NULL,
  p_marketing_opt_in text DEFAULT 'all',
  p_last_visit text DEFAULT 'any',
  p_min_bookings integer DEFAULT 0
)
RETURNS TABLE (
  total integer,
  opted_in integer,
  opted_out integer,
  returning integer,
  vip integer,
  never_visited integer
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    COUNT(*)::integer AS total,
    COUNT(*) FILTER (WHERE marketing_opt_in = true)::integer AS opted_in,
    COUNT(*) FILTER (WHERE marketing_opt_in = false)::integer AS opted_out,
    COUNT(*) FILTER (WHERE total_bookings >= 2)::integer AS returning,
    COUNT(*) FILTER (WHERE total_bookings >= 5)::integer AS vip,
    COUNT(*) FILTER (WHERE last_visit_at IS NULL)::integer AS never_visited
  FROM public.ops_customers_history_base(
    p_restaurant_id,
    p_search,
    p_marketing_opt_in,
    p_last_visit,
    p_min_bookings
  );
$$;
