-- Migration: add label and override_type columns to restaurant_capacity_rules
-- Story 5: Capacity Admin Dashboard improvements

BEGIN;

-- Create enum for override types if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'capacity_override_type'
  ) THEN
    CREATE TYPE capacity_override_type AS ENUM (
      'holiday',
      'event',
      'manual',
      'emergency'
    );
  END IF;
END;
$$;

-- Add descriptive label column
ALTER TABLE public.restaurant_capacity_rules
ADD COLUMN IF NOT EXISTS label text;

COMMENT ON COLUMN public.restaurant_capacity_rules.label IS
  'Human-friendly name for this capacity rule or override (e.g., “Christmas Eve Dinner”).';

-- Add override type column using enum
ALTER TABLE public.restaurant_capacity_rules
ADD COLUMN IF NOT EXISTS override_type capacity_override_type;

COMMENT ON COLUMN public.restaurant_capacity_rules.override_type IS
  'Categorizes overrides (holiday, event, manual adjustments, emergencies).';

COMMIT;
