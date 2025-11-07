-- Validation statements to run only after resolving overlaps/null windows
-- Usage: psql -f scripts/validate_overlap_constraints.sql $SUPABASE_DB_URL

BEGIN;

  \echo 'Validating booking assignment exclusion constraint'
  ALTER TABLE public.booking_table_assignments
    VALIDATE CONSTRAINT bta_no_overlap;

  \echo 'Validating hold window exclusion constraint'
  ALTER TABLE public.table_hold_windows
    VALIDATE CONSTRAINT thw_no_overlap;

COMMIT;

\echo 'Validation complete. Consider running ANALYZE on affected tables.'
