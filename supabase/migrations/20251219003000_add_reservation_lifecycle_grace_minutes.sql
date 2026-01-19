-- Add missing reservation_lifecycle_grace_minutes column to restaurants table
-- This column stores the grace period in minutes for reservation lifecycle transitions

ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS reservation_lifecycle_grace_minutes INTEGER DEFAULT 15;

COMMENT ON COLUMN public.restaurants.reservation_lifecycle_grace_minutes IS 'Grace period in minutes for reservation lifecycle state transitions (check-in, no-show, etc.)';
