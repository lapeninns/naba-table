-- MIGRATION 20251103090100: AUDIT & REMEDIATE BOOKING LIFECYCLE INCONSISTENCIES
-- Purpose: Correct historical booking data to align with lifecycle rules prior to constraint validation.
-- This script is idempotent; run during low-traffic windows and review audit queries beforehand.

BEGIN;

-- Ensure long-running updates are not aborted mid-flight (caller may override as needed).
SET LOCAL statement_timeout = '0';

-- ====================================================================
-- STEP 1: AUDIT (recommended to run manually before remediation)
-- ====================================================================
-- SELECT id, status, checked_in_at, checked_out_at
-- FROM public.bookings
-- WHERE status = 'completed'
--   AND checked_out_at IS NULL;
--
-- SELECT id, status, checked_in_at
-- FROM public.bookings
-- WHERE status IN ('checked_in', 'completed')
--   AND checked_in_at IS NULL;
--
-- SELECT id, status, checked_in_at, checked_out_at
-- FROM public.bookings
-- WHERE status IN ('cancelled', 'no_show')
--   AND (checked_in_at IS NOT NULL OR checked_out_at IS NOT NULL);
--
-- SELECT id, status, checked_in_at, checked_out_at
-- FROM public.bookings
-- WHERE checked_out_at IS NOT NULL
--   AND checked_in_at IS NOT NULL
--   AND checked_out_at < checked_in_at;

-- ====================================================================
-- STEP 2: REMEDIATION
-- ====================================================================

-- Rule 1: Cancelled or no-show bookings may not retain lifecycle timestamps.
UPDATE public.bookings
SET checked_in_at = NULL,
    checked_out_at = NULL
WHERE status IN ('cancelled', 'no_show')
  AND (checked_in_at IS NOT NULL OR checked_out_at IS NOT NULL);

-- Rule 2: Guard against negative durations by dropping invalid checkout timestamps.
UPDATE public.bookings
SET checked_out_at = NULL
WHERE checked_out_at IS NOT NULL
  AND checked_in_at IS NOT NULL
  AND checked_out_at < checked_in_at;

-- Rule 3: Completed bookings must have a checkout timestamp; infer from end_at when missing.
UPDATE public.bookings
SET checked_out_at = end_at
WHERE status = 'completed'
  AND checked_in_at IS NOT NULL
  AND checked_out_at IS NULL
  AND end_at IS NOT NULL;

-- Rule 4: Checked-in or completed bookings require a check-in timestamp; fallback to start_at.
UPDATE public.bookings
SET checked_in_at = start_at
WHERE status IN ('checked_in', 'completed')
  AND checked_in_at IS NULL
  AND start_at IS NOT NULL;

-- Optional final audit for manual review (uncomment when needed).
-- SELECT id, status, start_at, end_at, checked_in_at, checked_out_at
-- FROM public.bookings
-- WHERE status = 'completed'
--   AND (checked_in_at IS NULL OR checked_out_at IS NULL);

COMMIT;
