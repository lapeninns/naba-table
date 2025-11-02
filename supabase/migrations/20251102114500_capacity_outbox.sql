-- Capacity Outbox for post-commit sync & telemetry
-- Remote-only per AGENTS.md. Creates an outbox table with idempotent dedupe support and retry fields.

CREATE TABLE IF NOT EXISTS public.capacity_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','done','dead')),
  event_type text NOT NULL,
  dedupe_key text,
  attempt_count integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz,
  restaurant_id uuid,
  booking_id uuid,
  idempotency_key text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS capacity_outbox_status_idx ON public.capacity_outbox(status);
CREATE INDEX IF NOT EXISTS capacity_outbox_next_attempt_idx ON public.capacity_outbox(next_attempt_at);
CREATE INDEX IF NOT EXISTS capacity_outbox_restaurant_idx ON public.capacity_outbox(restaurant_id);
CREATE INDEX IF NOT EXISTS capacity_outbox_booking_idx ON public.capacity_outbox(booking_id);

-- Ensure dedupe on (event_type, dedupe_key) if provided
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='capacity_outbox_dedupe_unique'
  ) THEN
    CREATE UNIQUE INDEX capacity_outbox_dedupe_unique
      ON public.capacity_outbox (event_type, dedupe_key)
      WHERE dedupe_key IS NOT NULL;
  END IF;
END $$;

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION public.set_timestamp_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_capacity_outbox_updated_at ON public.capacity_outbox;
CREATE TRIGGER trg_capacity_outbox_updated_at
BEFORE UPDATE ON public.capacity_outbox
FOR EACH ROW EXECUTE FUNCTION public.set_timestamp_updated_at();

COMMENT ON TABLE public.capacity_outbox IS 'Outbox for reliable post-commit processing (sync, telemetry).';
