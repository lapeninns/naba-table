-- Durable Google edit-budget reservations for dual-sync publishes.
--
-- Google Business Profile has a tight per-location edit budget. The
-- application calls the function below before external Google writes so
-- the budget survives process restarts and queue worker handoffs.

BEGIN;

CREATE TABLE IF NOT EXISTS public.dual_sync_google_edit_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'google_business_profile',
  write_group text NOT NULL,
  reserved_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  window_ms integer NOT NULL DEFAULT 60000,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT dual_sync_google_edit_reservations_provider_check
    CHECK (provider IN ('google_business_profile')),
  CONSTRAINT dual_sync_google_edit_reservations_window_check
    CHECK (window_ms > 0)
);

CREATE INDEX IF NOT EXISTS dual_sync_google_edit_reservations_window_idx
  ON public.dual_sync_google_edit_reservations (
    restaurant_id,
    provider,
    reserved_at DESC
  );

CREATE INDEX IF NOT EXISTS dual_sync_google_edit_reservations_group_idx
  ON public.dual_sync_google_edit_reservations (
    restaurant_id,
    provider,
    write_group,
    reserved_at DESC
  );

ALTER TABLE public.dual_sync_google_edit_reservations ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'dual_sync_google_edit_reservations'
      AND policyname = 'Service role can manage dual sync Google edit reservations'
  ) THEN
    CREATE POLICY "Service role can manage dual sync Google edit reservations"
      ON public.dual_sync_google_edit_reservations
      FOR ALL TO service_role
      USING (true) WITH CHECK (true);
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.dual_sync_reserve_google_edit_budget(
  p_restaurant_id uuid,
  p_write_group text,
  p_limit integer DEFAULT 10,
  p_window_ms integer DEFAULT 60000,
  p_now timestamptz DEFAULT timezone('utc', now())
)
RETURNS TABLE (
  allowed boolean,
  retry_after_ms integer,
  remaining integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window interval;
  v_active_count integer;
  v_oldest_reserved_at timestamptz;
BEGIN
  IF p_limit <= 0 THEN
    RAISE EXCEPTION 'p_limit must be positive';
  END IF;
  IF p_window_ms <= 0 THEN
    RAISE EXCEPTION 'p_window_ms must be positive';
  END IF;
  IF p_write_group IS NULL OR length(trim(p_write_group)) = 0 THEN
    RAISE EXCEPTION 'p_write_group is required';
  END IF;

  v_window := (p_window_ms::text || ' milliseconds')::interval;

  PERFORM pg_advisory_xact_lock(
    hashtext('dual_sync_google_edit_budget:' || p_restaurant_id::text)
  );

  DELETE FROM public.dual_sync_google_edit_reservations
  WHERE provider = 'google_business_profile'
    AND reserved_at <= p_now - v_window;

  SELECT count(*)::integer, min(reserved_at)
  INTO v_active_count, v_oldest_reserved_at
  FROM public.dual_sync_google_edit_reservations
  WHERE restaurant_id = p_restaurant_id
    AND provider = 'google_business_profile'
    AND reserved_at > p_now - v_window;

  IF v_active_count >= p_limit THEN
    allowed := false;
    retry_after_ms := greatest(
      ceil(extract(epoch FROM ((v_oldest_reserved_at + v_window) - p_now)) * 1000)::integer,
      1
    );
    remaining := 0;
    RETURN NEXT;
    RETURN;
  END IF;

  INSERT INTO public.dual_sync_google_edit_reservations (
    restaurant_id,
    provider,
    write_group,
    reserved_at,
    window_ms
  )
  VALUES (
    p_restaurant_id,
    'google_business_profile',
    trim(p_write_group),
    p_now,
    p_window_ms
  );

  allowed := true;
  retry_after_ms := NULL;
  remaining := greatest(p_limit - v_active_count - 1, 0);
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.dual_sync_reserve_google_edit_budget(
  uuid,
  text,
  integer,
  integer,
  timestamptz
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.dual_sync_reserve_google_edit_budget(
  uuid,
  text,
  integer,
  integer,
  timestamptz
) TO service_role;

COMMENT ON TABLE public.dual_sync_google_edit_reservations IS
  'Durable sliding-window Google edit-budget reservations for unified dual-sync publishes.';

COMMENT ON FUNCTION public.dual_sync_reserve_google_edit_budget(uuid, text, integer, integer, timestamptz) IS
  'Atomically reserves one Google Business Profile edit budget slot for a restaurant/location before a dual-sync export write.';

COMMIT;
