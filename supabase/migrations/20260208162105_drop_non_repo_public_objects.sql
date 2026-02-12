-- Migration: Drop non-repo public schema objects
-- Context:
--   Staging contained legacy objects from removed features (e.g., zone floorplan),
--   and the user requested: "delete everything that's not in this repo."
--
-- Policy:
--   - Remote-only Supabase workflow (no local Supabase).
--   - Fail fast if the objects are still depended on by kept tables/functions/triggers.
--
-- NOTE:
--   We intentionally avoid dropping standalone sequences here because sequences are often
--   implicit dependencies of kept tables (IDENTITY / SERIAL defaults) and are not reliably
--   referenced in application code.

DO $$
DECLARE
  v_drop_tables text[] := ARRAY[
    'zone_floorplan_edit_locks',
    'zone_floorplan_layout_versions'
  ];

  v_drop_functions text[] := ARRAY[
    'acquire_zone_floorplan_lock_v1',
    'allowed_capacities_set_updated_at',
    'apply_zone_floorplan_layout_v1',
    'enforce_bar_drinks_only',
    'increment_booking_slot_version',
    'log_table_assignment_change',
    'on_allocations_refresh',
    'on_booking_status_refresh',
    'release_zone_floorplan_lock_v1',
    'restore_zone_floorplan_layout_v1',
    'set_booking_instants',
    'set_booking_reference',
    'set_timestamp_updated_at',
    'sync_table_hold_windows',
    'update_table_hold_windows',
    'update_updated_at_column',
    'validate_booking_has_assignments',
    'validate_table_adjacency'
  ];

  r record;
  v_deps integer;
BEGIN
  -- ---------------------------------------------------------------------------
  -- Safety check: kept tables must not have FKs referencing dropped tables.
  -- ---------------------------------------------------------------------------
  FOR r IN
    SELECT
      con.conname AS constraint_name,
      nsp.nspname AS table_schema,
      rel.relname AS table_name,
      tnsp.nspname AS referenced_schema,
      tref.relname AS referenced_table
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    JOIN pg_class tref ON tref.oid = con.confrelid
    JOIN pg_namespace tnsp ON tnsp.oid = tref.relnamespace
    WHERE con.contype = 'f'
      AND nsp.nspname = 'public'
      AND tnsp.nspname = 'public'
      AND tref.relname = ANY (v_drop_tables)
      AND rel.relname <> ALL (v_drop_tables)
  LOOP
    RAISE EXCEPTION 'Refusing to drop table public.%. Kept table public.% still references it via FK constraint %.',
      r.referenced_table, r.table_name, r.constraint_name
      USING ERRCODE = '23503';
  END LOOP;

  -- ---------------------------------------------------------------------------
  -- Drop non-internal triggers that depend on functions we are dropping.
  -- (These triggers are not represented in the repo, and would otherwise make
  -- function drops fail.)
  -- ---------------------------------------------------------------------------
  FOR r IN
    SELECT
      t.tgname AS trigger_name,
      rel.relname AS table_name
    FROM pg_trigger t
    JOIN pg_class rel ON rel.oid = t.tgrelid
    JOIN pg_namespace rn ON rn.oid = rel.relnamespace
    JOIN pg_proc p ON p.oid = t.tgfoid
    JOIN pg_namespace pn ON pn.oid = p.pronamespace
    WHERE rn.nspname = 'public'
      AND pn.nspname = 'public'
      AND p.proname = ANY (v_drop_functions)
      AND NOT t.tgisinternal
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I;', r.trigger_name, r.table_name);
  END LOOP;

  -- ---------------------------------------------------------------------------
  -- Safety check: no kept functions should depend on dropped functions.
  -- ---------------------------------------------------------------------------
  -- We look for dependencies from other public functions (excluding the drop list)
  -- onto any of the functions in the drop list.
  SELECT COUNT(*)
  INTO v_deps
  FROM pg_depend d
  JOIN pg_proc target ON target.oid = d.refobjid
  JOIN pg_namespace target_ns ON target_ns.oid = target.pronamespace
  JOIN pg_proc depender ON depender.oid = d.objid
  JOIN pg_namespace depender_ns ON depender_ns.oid = depender.pronamespace
  WHERE target_ns.nspname = 'public'
    AND depender_ns.nspname = 'public'
    AND target.proname = ANY (v_drop_functions)
    AND depender.proname <> ALL (v_drop_functions);

  IF v_deps > 0 THEN
    RAISE EXCEPTION 'Refusing to drop functions: found % dependencies from other kept public functions.', v_deps
      USING ERRCODE = '2BP01';
  END IF;

  -- ---------------------------------------------------------------------------
  -- Drop functions (all overloads) first, then tables.
  -- ---------------------------------------------------------------------------
  FOR r IN
    SELECT p.oid, p.proname
    FROM pg_proc p
    JOIN pg_namespace pn ON pn.oid = p.pronamespace
    WHERE pn.nspname = 'public'
      AND p.proname = ANY (v_drop_functions)
  LOOP
    EXECUTE format(
      'DROP FUNCTION IF EXISTS public.%I(%s);',
      r.proname,
      pg_get_function_identity_arguments(r.oid)
    );
  END LOOP;

  FOR r IN
    SELECT unnest(v_drop_tables) AS table_name
  LOOP
    EXECUTE format('DROP TABLE IF EXISTS public.%I;', r.table_name);
  END LOOP;
END $$;
