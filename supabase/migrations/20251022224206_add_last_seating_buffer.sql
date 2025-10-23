DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'restaurants'
      AND column_name = 'reservation_last_seating_buffer_minutes'
  ) THEN
    EXECUTE $add_column$
      ALTER TABLE public.restaurants
        ADD COLUMN reservation_last_seating_buffer_minutes integer NOT NULL DEFAULT 120
    $add_column$;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'restaurants_reservation_last_seating_buffer_minutes_check'
      AND conrelid = 'public.restaurants'::regclass
  ) THEN
    EXECUTE $add_constraint$
      ALTER TABLE public.restaurants
        ADD CONSTRAINT restaurants_reservation_last_seating_buffer_minutes_check
          CHECK (
              reservation_last_seating_buffer_minutes >= 15
              AND reservation_last_seating_buffer_minutes <= 300
          )
    $add_constraint$;
  END IF;

  EXECUTE $comment$
    COMMENT ON COLUMN public.restaurants.reservation_last_seating_buffer_minutes IS
      'Minimum minutes before closing when the final reservation may start.'
  $comment$;
END;
$migration$;
