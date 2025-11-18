-- MIGRATION 20251118170000: HARDEN RESTAURANT TIMEZONE
-- Purpose: Ensure every restaurant has a valid, non-null timezone to make scheduling and display logic more reliable.

BEGIN;

SET LOCAL statement_timeout = '0';

-- Update existing rows that might have a null or empty timezone
UPDATE public.restaurants
SET timezone = 'Europe/London'
WHERE timezone IS NULL OR trim(timezone) = '';

-- Alter the column to be non-nullable and set a default
ALTER TABLE public.restaurants
  ALTER COLUMN timezone SET NOT NULL,
  ALTER COLUMN timezone SET DEFAULT 'Europe/London';

COMMENT ON COLUMN public.restaurants.timezone IS 'Timezone of the restaurant (e.g., ''America/New_York''). Non-nullable, defaults to ''Europe/London''.';

COMMIT;
