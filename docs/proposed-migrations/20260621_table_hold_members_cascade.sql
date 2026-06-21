-- ============================================================================
-- PROPOSED MIGRATION — REVIEW REQUIRED, NOT AUTO-APPLIED.
--
-- This file lives under docs/proposed-migrations/ (OUTSIDE supabase/migrations/)
-- specifically so `supabase db push` will NOT pick it up. To ship it: confirm the
-- assumption below against the live schema, test against a database, then move it
-- into supabase/migrations/ with a proper sequential timestamp.
--
-- Hold-sweep gap (#11): table_hold_members orphan rows
-- ----------------------------------------------------
-- sweepExpiredHolds (server/capacity/holds.ts) deletes the parent `table_holds`
-- rows FIRST (so a concurrent reader never sees an active-but-empty hold), then
-- best-effort deletes the `table_hold_members` rows. If that second delete fails,
-- the function logs and returns success, relying on a FK cascade to reap the
-- orphaned member rows. If `table_hold_members.hold_id` is NOT declared
-- `ON DELETE CASCADE`, those rows accumulate unbounded. (Safe direction — the
-- holds are gone so nothing reads them as active — but a slow storage leak.)
--
-- This migration makes the dependency explicit: it ensures the FK from
-- table_hold_members.hold_id -> table_holds(id) is ON DELETE CASCADE, regardless
-- of the existing constraint name (the table predates supabase/migrations/, so the
-- generated constraint name is looked up rather than assumed). Idempotent: a no-op
-- when the cascade is already in place.
-- ============================================================================

DO $$
DECLARE
  v_conname text;
  v_confdeltype "char";
BEGIN
  SELECT c.conname, c.confdeltype
    INTO v_conname, v_confdeltype
  FROM pg_constraint c
  JOIN pg_class child ON child.oid = c.conrelid
  JOIN pg_namespace n ON n.oid = child.relnamespace
  JOIN pg_class parent ON parent.oid = c.confrelid
  WHERE c.contype = 'f'
    AND n.nspname = 'public'
    AND child.relname = 'table_hold_members'
    AND parent.relname = 'table_holds'
  LIMIT 1;

  IF v_conname IS NULL THEN
    -- No FK present: add one with the cascade.
    ALTER TABLE public.table_hold_members
      ADD CONSTRAINT table_hold_members_hold_id_fkey
      FOREIGN KEY (hold_id) REFERENCES public.table_holds(id) ON DELETE CASCADE;
  ELSIF v_confdeltype <> 'c' THEN
    -- FK exists but is not ON DELETE CASCADE ('c'); replace it in place.
    EXECUTE format('ALTER TABLE public.table_hold_members DROP CONSTRAINT %I', v_conname);
    ALTER TABLE public.table_hold_members
      ADD CONSTRAINT table_hold_members_hold_id_fkey
      FOREIGN KEY (hold_id) REFERENCES public.table_holds(id) ON DELETE CASCADE;
  END IF;
END $$;
