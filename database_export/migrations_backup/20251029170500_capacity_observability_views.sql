-- Create reporting views for allocator observability baselines.
-- +goose Up
DO $ensure_table$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'observability_events'
  ) THEN
    EXECUTE $create_table$
      CREATE TABLE public.observability_events (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
        source text NOT NULL,
        event_type text NOT NULL,
        severity text NOT NULL DEFAULT 'info',
        context jsonb,
        restaurant_id uuid,
        booking_id uuid
      )
    $create_table$;

    EXECUTE $severity_check$
      ALTER TABLE public.observability_events
        ADD CONSTRAINT observability_events_severity_check
          CHECK (
            severity = ANY (ARRAY['info'::text, 'warning'::text, 'error'::text, 'critical'::text])
          )
    $severity_check$;

    CREATE INDEX IF NOT EXISTS observability_events_created_at_idx
      ON public.observability_events (created_at DESC);
  END IF;
END;
$ensure_table$;
CREATE OR REPLACE VIEW public.capacity_observability_selector_metrics AS
WITH base AS (
  SELECT
    restaurant_id,
    date_trunc('day', created_at) AS bucket_day,
    event_type,
    NULLIF(context -> 'timing' ->> 'plannerMs', '')::double precision AS planner_ms,
    NULLIF(context ->> 'durationMs', '')::double precision AS total_duration_ms,
    COALESCE(jsonb_array_length(context -> 'candidates'), 0)::double precision AS candidate_count
  FROM public.observability_events
  WHERE source = 'capacity.selector'
)
SELECT
  restaurant_id,
  bucket_day,
  COUNT(*) FILTER (WHERE event_type = 'capacity.selector.assignment') AS assignments,
  COUNT(*) FILTER (WHERE event_type = 'capacity.selector.skipped') AS skipped,
  AVG(planner_ms) FILTER (WHERE planner_ms IS NOT NULL) AS avg_planner_ms,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY planner_ms) FILTER (WHERE planner_ms IS NOT NULL) AS p95_planner_ms,
  AVG(total_duration_ms) FILTER (WHERE total_duration_ms IS NOT NULL) AS avg_total_duration_ms,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY total_duration_ms) FILTER (WHERE total_duration_ms IS NOT NULL) AS p95_total_duration_ms,
  AVG(candidate_count) AS avg_candidate_count,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY candidate_count) AS p95_candidate_count
FROM base
GROUP BY restaurant_id, bucket_day;
CREATE OR REPLACE VIEW public.capacity_observability_hold_metrics AS
WITH buckets AS (
  SELECT DISTINCT
    restaurant_id,
    date_trunc('day', created_at) AS bucket_day
  FROM public.observability_events
  WHERE (source = 'capacity.selector' AND event_type = 'capacity.selector.quote')
     OR (source = 'capacity.hold' AND event_type IN ('capacity.hold.confirmed', 'capacity.hold.strict_conflict'))
),
quotes AS (
  SELECT
    restaurant_id,
    date_trunc('day', created_at) AS bucket_day,
    COUNT(DISTINCT NULLIF(context ->> 'holdId', '')) AS quotes
  FROM public.observability_events
  WHERE source = 'capacity.selector'
    AND event_type = 'capacity.selector.quote'
  GROUP BY restaurant_id, bucket_day
),
confirmations AS (
  SELECT
    restaurant_id,
    date_trunc('day', created_at) AS bucket_day,
    COUNT(DISTINCT NULLIF(context ->> 'holdId', '')) AS confirmations
  FROM public.observability_events
  WHERE source = 'capacity.hold'
    AND event_type = 'capacity.hold.confirmed'
  GROUP BY restaurant_id, bucket_day
),
strict_conflicts AS (
  SELECT
    restaurant_id,
    date_trunc('day', created_at) AS bucket_day,
    COUNT(*) AS strict_conflicts
  FROM public.observability_events
  WHERE source = 'capacity.hold'
    AND event_type = 'capacity.hold.strict_conflict'
  GROUP BY restaurant_id, bucket_day
)
SELECT
  b.restaurant_id,
  b.bucket_day,
  COALESCE(q.quotes, 0) AS quotes,
  COALESCE(c.confirmations, 0) AS confirmations,
  CASE WHEN COALESCE(q.quotes, 0) > 0
       THEN COALESCE(c.confirmations, 0)::double precision / COALESCE(q.quotes, 0)
       ELSE NULL
  END AS quote_to_confirm_rate,
  COALESCE(s.strict_conflicts, 0) AS strict_conflicts
FROM buckets b
LEFT JOIN quotes q
  ON q.restaurant_id = b.restaurant_id AND q.bucket_day = b.bucket_day
LEFT JOIN confirmations c
  ON c.restaurant_id = b.restaurant_id AND c.bucket_day = b.bucket_day
LEFT JOIN strict_conflicts s
  ON s.restaurant_id = b.restaurant_id AND s.bucket_day = b.bucket_day;
CREATE OR REPLACE VIEW public.capacity_observability_rpc_conflicts AS
SELECT
  restaurant_id,
  date_trunc('day', created_at) AS bucket_day,
  NULLIF(context -> 'error' ->> 'code', '') AS conflict_code,
  COUNT(*) AS occurrences,
  MAX(context -> 'error' ->> 'message') AS last_message
FROM public.observability_events
WHERE source = 'capacity.rpc'
  AND event_type = 'capacity.rpc.conflict'
GROUP BY restaurant_id, bucket_day, conflict_code;
-- +goose Down
DROP VIEW IF EXISTS public.capacity_observability_rpc_conflicts;
DROP VIEW IF EXISTS public.capacity_observability_hold_metrics;
DROP VIEW IF EXISTS public.capacity_observability_selector_metrics;
