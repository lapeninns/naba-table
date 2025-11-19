-- Migration: Add PRIORITY_WAITLIST status and automated late-arrival processing
-- This migration introduces a new booking status and a cron job to handle late reservations.

-- Phase 1: Add the new status to the booking_status enum
-- The new status is added before 'no_show' for logical grouping of active vs terminal states.
ALTER TYPE public.booking_status ADD VALUE 'PRIORITY_WAITLIST' BEFORE 'no_show';

-- Phase 2: Create the function to process late arrivals
-- This function finds confirmed bookings that are more than 15 minutes late,
-- releases their table assignments, and updates their status to PRIORITY_WAITLIST.
CREATE OR REPLACE FUNCTION public.process_late_arrivals()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  late_booking_ids uuid[];
BEGIN
  -- Select all booking IDs that are confirmed and where the start time is more than 15 minutes in the past
  SELECT array_agg(id)
  INTO late_booking_ids
  FROM public.bookings
  WHERE
    status = 'confirmed'
    AND start_at < (timezone('utc', now()) - INTERVAL '15 minutes');

  IF array_length(late_booking_ids, 1) > 0 THEN
    -- Remove all table assignments for the identified late bookings to free up the tables
    DELETE FROM public.booking_table_assignments
    WHERE booking_id = ANY(late_booking_ids);

    -- Remove associated allocations to free up the resources for conflict checks
    DELETE FROM public.allocations
    WHERE booking_id = ANY(late_booking_ids);

    -- Update the status of the late bookings to PRIORITY_WAITLIST
    UPDATE public.bookings
    SET status = 'PRIORITY_WAITLIST'
    WHERE id = ANY(late_booking_ids);
  END IF;
END;
$$;

-- Phase 3: Schedule the function to run every minute using pg_cron
-- This ensures late arrivals are processed automatically and promptly.
-- The cron job is named 'process-late-arrivals-job' to be easily identifiable.
SELECT cron.schedule(
  'process-late-arrivals-job',
  '* * * * *', -- Cron syntax for "every minute"
  $$SELECT public.process_late_arrivals()$$
);
