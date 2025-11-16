-- MIGRATION 20251103090300: SCHEMA DOCUMENTATION FOR AMBIGUOUS COLUMNS

BEGIN;
COMMENT ON COLUMN public.allocations.shadow IS 'True when allocation is tentative (shadow). Shadow allocations are visible to staff but do not block standard bookings.';
COMMENT ON COLUMN public.bookings.pending_ref IS 'Temporary reference used while an asynchronous booking is pending confirmation. Should be NULL for finalized bookings.';
COMMENT ON COLUMN public.service_policy.allow_after_hours IS 'If true, privileged staff may override standard operating hours when creating bookings.';
COMMIT;
