-- Ensure observability_events exists for selector telemetry + audit logging.
-- +goose Up
DO $migration$
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
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'observability_events_severity_check'
      AND conrelid = 'public.observability_events'::regclass
  ) THEN
    EXECUTE $add_severity_check$
      ALTER TABLE public.observability_events
        ADD CONSTRAINT observability_events_severity_check
          CHECK (
            severity = ANY (ARRAY['info'::text, 'warning'::text, 'error'::text, 'critical'::text])
          )
    $add_severity_check$;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.constraint_column_usage
    WHERE table_schema = 'public'
      AND table_name = 'observability_events'
      AND constraint_name = 'observability_events_booking_id_fkey'
  ) THEN
    EXECUTE $add_booking_fk$
      ALTER TABLE public.observability_events
        ADD CONSTRAINT observability_events_booking_id_fkey
          FOREIGN KEY (booking_id)
          REFERENCES public.bookings(id)
          ON DELETE SET NULL
    $add_booking_fk$;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.constraint_column_usage
    WHERE table_schema = 'public'
      AND table_name = 'observability_events'
      AND constraint_name = 'observability_events_restaurant_id_fkey'
  ) THEN
    EXECUTE $add_restaurant_fk$
      ALTER TABLE public.observability_events
        ADD CONSTRAINT observability_events_restaurant_id_fkey
          FOREIGN KEY (restaurant_id)
          REFERENCES public.restaurants(id)
          ON DELETE SET NULL
    $add_restaurant_fk$;
  END IF;

  EXECUTE $set_table_comment$
    COMMENT ON TABLE public.observability_events IS
      'Write-ahead observability log for allocator + booking workflows. Stores structured context for downstream analysis.'
  $set_table_comment$;

  EXECUTE $set_column_comment$
    COMMENT ON COLUMN public.observability_events.context IS
      'Structured JSON payload describing telemetry context (selectors, actors, diagnostics).'
  $set_column_comment$;

  CREATE INDEX IF NOT EXISTS observability_events_created_at_idx
    ON public.observability_events (created_at DESC);

  CREATE INDEX IF NOT EXISTS observability_events_source_idx
    ON public.observability_events (source);

  CREATE INDEX IF NOT EXISTS observability_events_booking_idx
    ON public.observability_events (booking_id);
END;
$migration$;
-- +goose Down
DO $migration$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'observability_events'
  ) THEN
    EXECUTE 'DROP TABLE public.observability_events CASCADE';
  END IF;
END;
$migration$;
