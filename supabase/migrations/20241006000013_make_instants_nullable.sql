-- Make start_at and end_at nullable temporarily so they can be set by trigger
-- The trigger will always set these values before the row is inserted

ALTER TABLE public.bookings 
ALTER COLUMN start_at DROP NOT NULL,
ALTER COLUMN end_at DROP NOT NULL;

-- Add NOT NULL constraint back after the trigger sets the value
-- This is handled by the trigger itself during INSERT
