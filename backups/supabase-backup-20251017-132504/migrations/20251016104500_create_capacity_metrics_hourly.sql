-- Migration: Create capacity_metrics_hourly table and helper function
-- Story 6: Capacity testing & monitoring

BEGIN;

CREATE TABLE IF NOT EXISTS public.capacity_metrics_hourly (
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  window_start timestamptz NOT NULL,
  success_count integer NOT NULL DEFAULT 0,
  conflict_count integer NOT NULL DEFAULT 0,
  capacity_exceeded_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT capacity_metrics_hourly_pkey PRIMARY KEY (restaurant_id, window_start)
);

CREATE INDEX IF NOT EXISTS idx_capacity_metrics_hourly_window
  ON public.capacity_metrics_hourly(window_start DESC);

CREATE OR REPLACE FUNCTION public.increment_capacity_metrics(
  p_restaurant_id uuid,
  p_window_start timestamptz,
  p_success_delta integer DEFAULT 0,
  p_conflict_delta integer DEFAULT 0,
  p_capacity_exceeded_delta integer DEFAULT 0
) RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.capacity_metrics_hourly (
    restaurant_id,
    window_start,
    success_count,
    conflict_count,
    capacity_exceeded_count
  )
  VALUES (
    p_restaurant_id,
    date_trunc('hour', p_window_start),
    GREATEST(p_success_delta, 0),
    GREATEST(p_conflict_delta, 0),
    GREATEST(p_capacity_exceeded_delta, 0)
  )
  ON CONFLICT (restaurant_id, window_start)
  DO UPDATE SET
    success_count = public.capacity_metrics_hourly.success_count + GREATEST(p_success_delta, 0),
    conflict_count = public.capacity_metrics_hourly.conflict_count + GREATEST(p_conflict_delta, 0),
    capacity_exceeded_count = public.capacity_metrics_hourly.capacity_exceeded_count + GREATEST(p_capacity_exceeded_delta, 0),
    updated_at = timezone('utc', now());
END;
$$;

COMMENT ON FUNCTION public.increment_capacity_metrics IS 'Increment hourly capacity metrics counters with atomic upsert.';

CREATE OR REPLACE FUNCTION public.capacity_metrics_hourly_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := timezone('utc', now());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS capacity_metrics_hourly_set_updated_at ON public.capacity_metrics_hourly;
CREATE TRIGGER capacity_metrics_hourly_set_updated_at
BEFORE UPDATE ON public.capacity_metrics_hourly
FOR EACH ROW
EXECUTE FUNCTION public.capacity_metrics_hourly_updated_at();

COMMIT;
