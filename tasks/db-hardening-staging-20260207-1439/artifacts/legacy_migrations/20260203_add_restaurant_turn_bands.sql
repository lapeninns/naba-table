-- Migration: Add restaurant_turn_bands for per-restaurant party-size durations
-- Purpose: Allow ops to configure turn durations by booking option and party size.

BEGIN;

CREATE TABLE IF NOT EXISTS public.restaurant_turn_bands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL,
  booking_option text NOT NULL,
  max_party_size integer NOT NULL,
  duration_minutes integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'restaurant_turn_bands_restaurant_id_fkey'
  ) THEN
    ALTER TABLE public.restaurant_turn_bands
      ADD CONSTRAINT restaurant_turn_bands_restaurant_id_fkey
      FOREIGN KEY (restaurant_id)
      REFERENCES public.restaurants(id)
      ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'restaurant_turn_bands_booking_option_fkey'
  ) THEN
    ALTER TABLE public.restaurant_turn_bands
      ADD CONSTRAINT restaurant_turn_bands_booking_option_fkey
      FOREIGN KEY (booking_option)
      REFERENCES public.booking_occasions(key)
      ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'restaurant_turn_bands_max_party_size_check'
  ) THEN
    ALTER TABLE public.restaurant_turn_bands
      ADD CONSTRAINT restaurant_turn_bands_max_party_size_check
      CHECK (max_party_size > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'restaurant_turn_bands_duration_minutes_check'
  ) THEN
    ALTER TABLE public.restaurant_turn_bands
      ADD CONSTRAINT restaurant_turn_bands_duration_minutes_check
      CHECK (duration_minutes > 0 AND duration_minutes <= 1440);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS restaurant_turn_bands_unique_idx
  ON public.restaurant_turn_bands (restaurant_id, booking_option, max_party_size);

CREATE INDEX IF NOT EXISTS restaurant_turn_bands_lookup_idx
  ON public.restaurant_turn_bands (restaurant_id, booking_option, max_party_size);

ALTER TABLE public.restaurant_turn_bands ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'restaurant_turn_bands_updated_at'
      AND tgrelid = 'public.restaurant_turn_bands'::regclass
  ) THEN
    CREATE TRIGGER restaurant_turn_bands_updated_at
      BEFORE UPDATE ON public.restaurant_turn_bands
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at();
  END IF;
EXCEPTION
  WHEN undefined_object THEN
    RAISE NOTICE 'update_updated_at function not found, skipping trigger';
END $$;

DROP POLICY IF EXISTS "Service role can manage turn bands" ON public.restaurant_turn_bands;
CREATE POLICY "Service role can manage turn bands"
  ON public.restaurant_turn_bands
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Staff can manage turn bands" ON public.restaurant_turn_bands;
DO $$
BEGIN
  CREATE POLICY "Staff can manage turn bands"
    ON public.restaurant_turn_bands
    USING ((restaurant_id IN (SELECT public.user_restaurants() AS user_restaurants)))
    WITH CHECK ((restaurant_id IN (SELECT public.user_restaurants() AS user_restaurants)));
EXCEPTION
  WHEN undefined_function THEN
    RAISE NOTICE 'user_restaurants function not found, skipping staff policy';
END $$;

GRANT SELECT, INSERT, DELETE, UPDATE ON TABLE public.restaurant_turn_bands TO service_role;
GRANT SELECT, INSERT, DELETE, UPDATE ON TABLE public.restaurant_turn_bands TO authenticated;

COMMENT ON TABLE public.restaurant_turn_bands IS
  'Party-size-based reservation durations per restaurant and booking option.';
COMMENT ON COLUMN public.restaurant_turn_bands.restaurant_id IS
  'Restaurant the turn bands apply to.';
COMMENT ON COLUMN public.restaurant_turn_bands.booking_option IS
  'Booking option key (e.g., lunch, dinner, tasting).';
COMMENT ON COLUMN public.restaurant_turn_bands.max_party_size IS
  'Upper bound of the party size for this duration band.';
COMMENT ON COLUMN public.restaurant_turn_bands.duration_minutes IS
  'Duration in minutes for the party size band.';

COMMIT;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
