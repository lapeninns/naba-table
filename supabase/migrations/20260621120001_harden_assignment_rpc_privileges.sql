-- Harden assignment / booking-lifecycle SECURITY DEFINER RPC execute privileges.
--
-- Closes Codex Security findings (one fix, many findings):
--   confirmed:    triage-003, triage-019, triage-022, triage-026, triage-061
--   needs_review: triage-014, triage-015, triage-016, triage-025, triage-029
-- All name SECURITY DEFINER functions that still exist in the deployed DB
-- (proven via generated types/supabase.ts and active service-role callers) but have
-- NO REVOKE in the current repo migration tree. PostgreSQL grants EXECUTE on new
-- functions to PUBLIC by default, so anon/authenticated can likely reach these
-- privileged routines directly through PostgREST /rest/v1/rpc/<fn>, bypassing the
-- application's route-level membership/tenant checks and table RLS.
--
-- Why a pg_proc loop instead of explicit signatures:
--   The defining migrations were squashed/removed from the tree (commit 8ca36098
--   "Clean"); these functions persist only in the remote DB, frequently with
--   multiple overloads (e.g. assign_tables_atomic_v2 has a 5-arg and a 7-arg form).
--   Looping over pg_proc by name revokes EXECUTE from PUBLIC/anon/authenticated and
--   grants service_role for EVERY overload, is idempotent (re-running is a no-op),
--   and does NOT error if a function is absent on a given environment.
--
-- This mirrors the established service-only hardening pattern in
-- 20260527111100_harden_service_only_rpc_privileges.sql and
-- 20260516092900_atomic_unassign_tables_status.sql (which already hardened
-- unassign_tables_atomic — left untouched here).
--
-- Containment: every listed function is invoked by trusted server-side code through a
-- service-role client AFTER route-level auth/tenant checks or public-booking
-- validation. None is intended to be called directly by browser anon/authenticated
-- clients.
--
-- GATED: applying this migration to a remote Supabase project and confirming the
-- resulting ACLs with `pnpm db:check-drift` is an approval-gated external operation
-- (see .omo/evidence/security-findings-verify-fix/). Authoring + local verification
-- (migration-content test) is done; remote apply + scanner rerun remain gated.

DO $$
DECLARE
  target_names text[] := ARRAY[
    'assign_tables_atomic_v2',
    'assign_single_table',
    'assign_merged_tables',
    'assign_tables_atomic',
    'refresh_table_status',
    'update_booking_with_capacity_check',
    'apply_booking_state_transition',
    'sync_confirmed_assignment_windows',
    'confirm_hold_assignment_with_transition'
  ];
  fn record;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = ANY (target_names)
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn.sig);
    RAISE NOTICE 'hardened execute privileges on %', fn.sig;
  END LOOP;
END
$$;
