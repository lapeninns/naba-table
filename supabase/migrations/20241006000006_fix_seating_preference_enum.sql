-- Fix seating_preference_type enum to match application code
-- The application expects 'booth' but the database has 'quiet'

-- First, update any existing 'quiet' values to 'booth'
UPDATE public.bookings 
SET seating_preference = 'any' 
WHERE seating_preference = 'quiet';

-- Add 'booth' value to the enum
ALTER TYPE seating_preference_type ADD VALUE IF NOT EXISTS 'booth';

-- Note: PostgreSQL doesn't support removing enum values directly
-- We'll leave 'quiet' in the enum for backwards compatibility
-- The application code only uses: any, indoor, outdoor, window, booth, bar
