-- Benchmark script for restaurant-level booking overlap detection.
-- Run with psql, overriding defaults as needed:
--   psql "$DATABASE_URL" \
--     -v restaurant_id='39cb1346-20fb-4fa2-b163-0230e1caf749' \
--     -v booking_date='2025-03-01' \
--     -v start_time='19:00' \
--     -v end_time='21:00' \
--     -v ignore_booking_id='' \
--     -v result_limit='50' \
--     -f scripts/perf/booking-conflict-benchmark.sql
--
-- Set `EXPLAIN_ONLY=1` to skip execution and return only the plan
--   psql ... -v explain_only='1' -f scripts/perf/booking-conflict-benchmark.sql

\timing on

\if :{?restaurant_id} \else \set restaurant_id '' \endif
\if :{?booking_date} \else \set booking_date '' \endif
\if :{?start_time} \else \set start_time '' \endif
\if :{?end_time} \else \set end_time '' \endif
\if :{?ignore_booking_id} \else \set ignore_booking_id '' \endif
\if :{?result_limit} \else \set result_limit '' \endif
\if :{?explain_only} \else \set explain_only '0' \endif

SELECT CASE
  WHEN LOWER(COALESCE(NULLIF(:'explain_only', ''), '0')) IN ('1','true','on') THEN 'on'
  ELSE 'off'
END AS run_explain_only \gset

WITH request AS (
  SELECT
    COALESCE(NULLIF(:'restaurant_id', ''), '39cb1346-20fb-4fa2-b163-0230e1caf749')::uuid AS restaurant_id,
    COALESCE(NULLIF(:'booking_date', ''), current_date::text)::date                      AS booking_date,
    COALESCE(NULLIF(:'start_time', ''), '19:00')::time                                    AS start_time,
    COALESCE(NULLIF(:'end_time', ''), '21:00')::time                                      AS end_time,
    NULLIF(
      CASE
        WHEN UPPER(:'ignore_booking_id') = 'NULL' THEN NULL
        ELSE :'ignore_booking_id'
      END,
      ''
    )::uuid                                                                              AS ignore_booking_id,
    GREATEST(1, COALESCE(NULLIF(:'result_limit', '')::int, 50))                            AS result_limit
), blocking_statuses AS (
  SELECT ARRAY['pending','pending_allocation','confirmed']::public.booking_status[] AS statuses
), conflicts AS (
  SELECT
    b.id,
    b.reference,
    b.start_time,
    b.end_time,
    b.party_size,
    b.status,
    b.customer_name,
    b.customer_email,
    b.customer_phone
  FROM request r
  JOIN blocking_statuses bs ON TRUE
  JOIN public.bookings b
    ON b.restaurant_id = r.restaurant_id
   AND b.booking_date = r.booking_date
   AND b.status = ANY(bs.statuses)
   AND (r.ignore_booking_id IS NULL OR b.id <> r.ignore_booking_id)
   AND b.start_time < r.end_time
   AND b.end_time > r.start_time
  ORDER BY b.start_time ASC
  LIMIT (SELECT result_limit FROM request)
)
SELECT
  r.restaurant_id,
  r.booking_date,
  r.start_time AS requested_start_time,
  r.end_time   AS requested_end_time,
  c.id,
  c.reference,
  c.start_time,
  c.end_time,
  c.party_size,
  c.status,
  c.customer_name,
  c.customer_email,
  c.customer_phone
FROM request r
JOIN conflicts c ON TRUE;

\if :run_explain_only
  \echo 'EXPLAIN (ANALYZE, BUFFERS, FORMAT YAML) for restaurant overlap query:'
  EXPLAIN (ANALYZE, BUFFERS, FORMAT YAML)
  WITH request AS (
    SELECT
      COALESCE(NULLIF(:'restaurant_id', ''), '39cb1346-20fb-4fa2-b163-0230e1caf749')::uuid AS restaurant_id,
      COALESCE(NULLIF(:'booking_date', ''), current_date::text)::date                      AS booking_date,
      COALESCE(NULLIF(:'start_time', ''), '19:00')::time                                    AS start_time,
      COALESCE(NULLIF(:'end_time', ''), '21:00')::time                                      AS end_time,
      NULLIF(
        CASE
          WHEN UPPER(:'ignore_booking_id') = 'NULL' THEN NULL
          ELSE :'ignore_booking_id'
        END,
        ''
      )::uuid                                                                              AS ignore_booking_id,
      GREATEST(1, COALESCE(NULLIF(:'result_limit', '')::int, 50))                           AS result_limit
  ), blocking_statuses AS (
    SELECT ARRAY['pending','pending_allocation','confirmed']::public.booking_status[] AS statuses
  )
  SELECT
    b.id,
    b.reference,
    b.start_time,
    b.end_time,
    b.party_size,
    b.status
  FROM request r
  JOIN blocking_statuses bs ON TRUE
  JOIN public.bookings b
    ON b.restaurant_id = r.restaurant_id
   AND b.booking_date = r.booking_date
   AND b.status = ANY(bs.statuses)
   AND (r.ignore_booking_id IS NULL OR b.id <> r.ignore_booking_id)
   AND b.start_time < r.end_time
   AND b.end_time > r.start_time
  ORDER BY b.start_time ASC
  LIMIT (SELECT result_limit FROM request);
\else
  \echo 'Query executed without EXPLAIN.'
\endif
