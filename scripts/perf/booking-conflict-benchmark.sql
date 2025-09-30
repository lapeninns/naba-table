-- Benchmark script for batched booking conflict detection.
-- Run with psql, overriding defaults as needed:
--   psql "$DATABASE_URL" \
--     -v restaurant_id='39cb1346-20fb-4fa2-b163-0230e1caf749' \
--     -v booking_date='2025-03-01' \
--     -v start_time='19:00' \
--     -v end_time='21:00' \
--     -v party_size='4' \
--     -v seating_preference='any' \
--     -v ignore_booking_id='' \
--     -v candidate_limit='50' \
--     -f scripts/perf/booking-conflict-benchmark.sql
--
-- Set `EXPLAIN_ONLY=1` to skip execution and return only the plan
--   psql ... -v explain_only='1' -f scripts/perf/booking-conflict-benchmark.sql

\timing on

\if :{?restaurant_id} \else \set restaurant_id '' \endif
\if :{?booking_date} \else \set booking_date '' \endif
\if :{?start_time} \else \set start_time '' \endif
\if :{?end_time} \else \set end_time '' \endif
\if :{?party_size} \else \set party_size '' \endif
\if :{?seating_preference} \else \set seating_preference '' \endif
\if :{?ignore_booking_id} \else \set ignore_booking_id '' \endif
\if :{?candidate_limit} \else \set candidate_limit '' \endif
\if :{?explain_only} \else \set explain_only '0' \endif

SELECT CASE
  WHEN LOWER(COALESCE(NULLIF(:'explain_only', ''), '0')) IN ('1','true','on') THEN 'on'
  ELSE 'off'
END AS run_explain_only \gset

WITH request AS (
  SELECT
    COALESCE(NULLIF(:'restaurant_id', ''), '39cb1346-20fb-4fa2-b163-0230e1caf749')::uuid      AS restaurant_id,
    COALESCE(NULLIF(:'booking_date', ''), current_date::text)::date                         AS booking_date,
    COALESCE(NULLIF(:'start_time', ''), '19:00')::time                                       AS start_time,
    COALESCE(NULLIF(:'end_time', ''), '21:00')::time                                         AS end_time,
    GREATEST(1, COALESCE(NULLIF(:'party_size', '')::int, 2))                                 AS party_size,
    LOWER(COALESCE(NULLIF(:'seating_preference', ''), 'any'))::public.seating_preference_type AS seating_preference,
    NULLIF(
      CASE
        WHEN UPPER(:'ignore_booking_id') = 'NULL' THEN NULL
        ELSE :'ignore_booking_id'
      END,
      ''
    )::uuid                                                                               AS ignore_booking_id,
    GREATEST(1, COALESCE(NULLIF(:'candidate_limit', '')::int, 50))                           AS candidate_limit
), blocking_statuses AS (
  SELECT ARRAY['pending','pending_allocation','confirmed']::public.booking_status[] AS statuses
), candidate_tables AS (
  SELECT
    t.id,
    t.capacity,
    t.seating_type,
    t.features
  FROM public.restaurant_tables t
  CROSS JOIN request r
  WHERE t.restaurant_id = r.restaurant_id
    AND t.capacity >= r.party_size
    AND (r.seating_preference = 'any' OR t.seating_type = r.seating_preference)
  ORDER BY t.capacity ASC, t.id ASC
  LIMIT (SELECT candidate_limit FROM request)
), table_conflicts AS (
  SELECT
    ct.id AS table_id,
    b.id  AS booking_id,
    b.start_time,
    b.end_time,
    b.status,
    b.party_size,
    b.reference
  FROM candidate_tables ct
  CROSS JOIN request r
  JOIN blocking_statuses bs ON TRUE
  LEFT JOIN LATERAL (
    SELECT b.*
    FROM public.bookings b
    WHERE b.table_id = ct.id
      AND b.booking_date = r.booking_date
      AND b.status = ANY(bs.statuses)
      AND (r.ignore_booking_id IS NULL OR b.id <> r.ignore_booking_id)
      AND b.start_time < r.end_time
      AND b.end_time > r.start_time
    ORDER BY b.start_time ASC
  ) AS b ON TRUE
)
SELECT
  r.restaurant_id,
  r.booking_date,
  r.start_time AS requested_start_time,
  r.end_time   AS requested_end_time,
  r.party_size,
  r.seating_preference,
  ct.table_id,
  ct.start_time,
  ct.end_time,
  ct.status,
  ct.party_size AS occupying_party_size,
  ct.reference  AS occupying_reference
FROM request r
JOIN table_conflicts ct ON TRUE
ORDER BY ct.table_id, ct.start_time;

\if :run_explain_only
  \echo 'EXPLAIN (ANALYZE, BUFFERS, FORMAT YAML) for batched conflict query:'
  EXPLAIN (ANALYZE, BUFFERS, FORMAT YAML)
  WITH request AS (
    SELECT
      COALESCE(NULLIF(:'restaurant_id', ''), '39cb1346-20fb-4fa2-b163-0230e1caf749')::uuid      AS restaurant_id,
      COALESCE(NULLIF(:'booking_date', ''), current_date::text)::date                         AS booking_date,
      COALESCE(NULLIF(:'start_time', ''), '19:00')::time                                       AS start_time,
      COALESCE(NULLIF(:'end_time', ''), '21:00')::time                                         AS end_time,
      GREATEST(1, COALESCE(NULLIF(:'party_size', '')::int, 2))                                 AS party_size,
      LOWER(COALESCE(NULLIF(:'seating_preference', ''), 'any'))::public.seating_preference_type AS seating_preference,
      NULLIF(
        CASE
          WHEN UPPER(:'ignore_booking_id') = 'NULL' THEN NULL
          ELSE :'ignore_booking_id'
        END,
        ''
      )::uuid                                                                               AS ignore_booking_id,
      GREATEST(1, COALESCE(NULLIF(:'candidate_limit', '')::int, 50))                           AS candidate_limit
  ), blocking_statuses AS (
    SELECT ARRAY['pending','pending_allocation','confirmed']::public.booking_status[] AS statuses
  ), candidate_tables AS (
    SELECT
      t.id,
      t.capacity,
      t.seating_type,
      t.features
    FROM public.restaurant_tables t
    CROSS JOIN request r
    WHERE t.restaurant_id = r.restaurant_id
      AND t.capacity >= r.party_size
      AND (r.seating_preference = 'any' OR t.seating_type = r.seating_preference)
    ORDER BY t.capacity ASC, t.id ASC
    LIMIT (SELECT candidate_limit FROM request)
  ), table_conflicts AS (
    SELECT
      ct.id AS table_id,
      b.id  AS booking_id,
      b.start_time,
      b.end_time,
      b.status,
      b.party_size,
      b.reference
    FROM candidate_tables ct
    CROSS JOIN request r
    JOIN blocking_statuses bs ON TRUE
    LEFT JOIN LATERAL (
      SELECT b.*
      FROM public.bookings b
      WHERE b.table_id = ct.id
        AND b.booking_date = r.booking_date
        AND b.status = ANY(bs.statuses)
        AND (r.ignore_booking_id IS NULL OR b.id <> r.ignore_booking_id)
        AND b.start_time < r.end_time
        AND b.end_time > r.start_time
      ORDER BY b.start_time ASC
    ) AS b ON TRUE
  )
  SELECT
    r.restaurant_id,
    r.booking_date,
    r.start_time AS requested_start_time,
    r.end_time   AS requested_end_time,
    r.party_size,
    r.seating_preference,
    ct.table_id,
    ct.start_time,
    ct.end_time,
    ct.status,
    ct.party_size AS occupying_party_size,
    ct.reference  AS occupying_reference
  FROM request r
  JOIN table_conflicts ct ON TRUE
  ORDER BY ct.table_id, ct.start_time;
\endif
