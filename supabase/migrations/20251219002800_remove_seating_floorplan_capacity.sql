-- NOTE: This migration is generated to remove seating/floor-plan/capacity features.
-- Review against your actual schema before applying (remote-only policy).

-- Drop floor plan layout storage artifacts table if it exists (if you had one).
-- The current implementation stores layout JSON in Supabase Storage, not a DB table.

-- Allowed capacities feature: remove table if present.
DROP TABLE IF EXISTS public.allowed_capacities;

-- If your table inventory stored a position column for floor-plan, drop it.
-- Adjust table name/column name if different.
ALTER TABLE IF EXISTS public.tables
  DROP COLUMN IF EXISTS position;

-- If you have any capacity configuration fields used only by the seating/capacity pages,
-- drop them here once confirmed. Examples (commented out):
-- ALTER TABLE IF EXISTS public.restaurants DROP COLUMN IF EXISTS max_covers;
-- ALTER TABLE IF EXISTS public.restaurants DROP COLUMN IF EXISTS capacity_enabled;
