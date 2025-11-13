-- Add column to store the most recent inline auto-assign attempt metadata
ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS auto_assign_last_result jsonb;
