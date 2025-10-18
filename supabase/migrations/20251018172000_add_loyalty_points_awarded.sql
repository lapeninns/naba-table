-- Migration: Add loyalty points tracking to bookings
-- Description: Ensure bookings table has loyalty_points_awarded integer column with default 0.
-- Date: 2025-10-18

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS loyalty_points_awarded integer DEFAULT 0;

UPDATE public.bookings
SET loyalty_points_awarded = 0
WHERE loyalty_points_awarded IS NULL;

ALTER TABLE public.bookings
  ALTER COLUMN loyalty_points_awarded SET NOT NULL;
