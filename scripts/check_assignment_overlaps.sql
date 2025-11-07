-- Utility query to detect overlapping assignments/holds prior to VALIDATE CONSTRAINT
-- Usage: psql -f scripts/check_assignment_overlaps.sql $SUPABASE_DB_URL

\echo 'Booking table assignment overlaps'
SELECT table_id,
       COUNT(*) AS conflicting_pairs
FROM (
  SELECT a.table_id,
         a.booking_id AS booking_a,
         b.booking_id AS booking_b
  FROM public.booking_table_assignments a
  JOIN public.booking_table_assignments b
    ON a.table_id = b.table_id
   AND a.id <> b.id
   AND a.assignment_window && b.assignment_window
  WHERE a.table_id IS NOT NULL
) overlaps
GROUP BY table_id
ORDER BY conflicting_pairs DESC
LIMIT 50;

\echo 'Assignment rows with NULL windows or invalid ranges'
SELECT COUNT(*) AS null_or_invalid_assignments,
       SUM(CASE WHEN start_at IS NULL THEN 1 ELSE 0 END) AS missing_start_at,
       SUM(CASE WHEN end_at IS NULL THEN 1 ELSE 0 END) AS missing_end_at,
       SUM(CASE WHEN start_at >= end_at AND start_at IS NOT NULL AND end_at IS NOT NULL THEN 1 ELSE 0 END) AS non_positive_window
FROM public.booking_table_assignments;

\echo 'Sample assignment rows missing windows'
SELECT id,
       booking_id,
       table_id,
       start_at,
       end_at,
       assignment_window
FROM public.booking_table_assignments
WHERE start_at IS NULL
   OR end_at IS NULL
   OR assignment_window IS NULL
   OR start_at >= end_at
LIMIT 20;

\echo 'Hold window overlaps'
SELECT table_id,
       COUNT(*) AS conflicting_pairs
FROM (
  SELECT a.table_id,
         a.hold_id AS hold_a,
         b.hold_id AS hold_b
  FROM public.table_hold_windows a
  JOIN public.table_hold_windows b
    ON a.table_id = b.table_id
   AND a.hold_id <> b.hold_id
   AND a.hold_window && b.hold_window
) overlaps
GROUP BY table_id
ORDER BY conflicting_pairs DESC
LIMIT 50;

\echo 'Hold rows with NULL windows or inconsistent times'
SELECT COUNT(*) AS null_or_invalid_holds,
       SUM(CASE WHEN start_at IS NULL THEN 1 ELSE 0 END) AS missing_start_at,
       SUM(CASE WHEN end_at IS NULL THEN 1 ELSE 0 END) AS missing_end_at,
       SUM(CASE WHEN start_at >= end_at AND start_at IS NOT NULL AND end_at IS NOT NULL THEN 1 ELSE 0 END) AS non_positive_window,
       SUM(CASE WHEN expires_at < end_at THEN 1 ELSE 0 END) AS expires_before_end
FROM public.table_hold_windows;

\echo 'Sample hold rows missing windows or failing hygiene check'
SELECT hold_id,
       table_id,
       booking_id,
       start_at,
       end_at,
       expires_at,
       hold_window
FROM public.table_hold_windows
WHERE start_at IS NULL
   OR end_at IS NULL
   OR hold_window IS NULL
   OR start_at >= end_at
   OR expires_at < end_at
LIMIT 20;
