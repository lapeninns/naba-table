-- Migration: Enable maintenance allocations for tables
-- Date: 2025-10-18

ALTER TABLE public.allocations
  ADD COLUMN IF NOT EXISTS is_maintenance boolean NOT NULL DEFAULT false;

ALTER TABLE public.allocations
  ALTER COLUMN booking_id DROP NOT NULL;

COMMENT ON COLUMN public.allocations.is_maintenance IS 'True when allocation reserves a table for maintenance/out-of-service windows rather than a booking.';
