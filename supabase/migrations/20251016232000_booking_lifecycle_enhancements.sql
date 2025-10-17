-- Migration: Booking lifecycle enforcement & summary support
-- Description: Tighten timestamp invariants, add supporting indexes, and expose booking status summary helper.
-- Date: 2025-10-16

-- Ensure the booking_status enum contains the checked_in value (idempotent for replays)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_enum e
        JOIN pg_type t ON t.oid = e.enumtypid
        WHERE t.typname = 'booking_status'
          AND e.enumlabel = 'checked_in'
    ) THEN
        ALTER TYPE public.booking_status ADD VALUE 'checked_in';
    END IF;
END
$$;

-- Backfill obvious timestamp gaps for completed bookings to satisfy new constraints
WITH updatable AS (
    SELECT
        id,
        COALESCE(checked_in_at, updated_at, created_at) AS fallback_check_in,
        COALESCE(checked_out_at, updated_at) AS fallback_check_out
    FROM public.bookings
    WHERE status = 'completed'
)
UPDATE public.bookings AS b
SET
    checked_in_at = CASE
        WHEN b.checked_in_at IS NULL THEN updatable.fallback_check_in
        ELSE b.checked_in_at
    END,
    checked_out_at = CASE
        WHEN b.checked_out_at IS NULL THEN updatable.fallback_check_out
        ELSE b.checked_out_at
    END
FROM updatable
WHERE b.id = updatable.id;

-- Add lifecycle timestamp consistency constraint (not valid to avoid blocking legacy data; new rows must comply)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'bookings_lifecycle_timestamp_consistency'
          AND conrelid = 'public.bookings'::regclass
    ) THEN
        ALTER TABLE public.bookings
        ADD CONSTRAINT bookings_lifecycle_timestamp_consistency
        CHECK (
            (
                status IN ('pending', 'pending_allocation', 'confirmed')
                AND checked_in_at IS NULL
                AND checked_out_at IS NULL
            )
            OR (
                status = 'checked_in'
                AND checked_in_at IS NOT NULL
                AND checked_out_at IS NULL
            )
            OR (
                status = 'completed'
                AND checked_in_at IS NOT NULL
                AND checked_out_at IS NOT NULL
                AND checked_out_at >= checked_in_at
            )
            OR (
                status = 'cancelled'
            )
            OR (
                status = 'no_show'
                AND checked_in_at IS NULL
                AND checked_out_at IS NULL
            )
        )
        NOT VALID;
    END IF;
END
$$;

COMMENT ON CONSTRAINT bookings_lifecycle_timestamp_consistency ON public.bookings
    IS 'Ensures booking lifecycle timestamps align with the status (checked-in bookings must have check-in timestamps, completed bookings need both timestamps, etc).';

-- Supporting index for status summary queries
CREATE INDEX IF NOT EXISTS bookings_restaurant_date_status_idx
    ON public.bookings (restaurant_id, booking_date, status);

-- Helper function for bulk status summaries
CREATE OR REPLACE FUNCTION public.booking_status_summary(
    p_restaurant_id uuid,
    p_start_date date DEFAULT NULL,
    p_end_date date DEFAULT NULL,
    p_status_filter public.booking_status[] DEFAULT NULL
)
RETURNS TABLE (
    status public.booking_status,
    total bigint
)
LANGUAGE sql
AS $$
    SELECT
        b.status,
        COUNT(*)::bigint AS total
    FROM public.bookings b
    WHERE b.restaurant_id = p_restaurant_id
      AND (p_start_date IS NULL OR b.booking_date >= p_start_date)
      AND (p_end_date IS NULL OR b.booking_date <= p_end_date)
      AND (p_status_filter IS NULL OR b.status = ANY(p_status_filter))
    GROUP BY b.status
    ORDER BY b.status;
$$;

COMMENT ON FUNCTION public.booking_status_summary(uuid, date, date, public.booking_status[])
    IS 'Returns aggregated booking counts by status for a restaurant across an optional date range and status filter.';

