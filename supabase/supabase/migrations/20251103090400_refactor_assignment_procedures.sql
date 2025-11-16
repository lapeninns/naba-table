-- MIGRATION 20251103090400: CONSOLIDATE TABLE ASSIGNMENT PROCEDURES
-- Provides explicit single-/multi-table assignment entrypoints and documents legacy RPC deprecation.

SET search_path TO public;
-- Explicit single-table wrapper with clear intent.
CREATE OR REPLACE FUNCTION public.assign_single_table(
  p_booking_id uuid,
  p_table_id uuid,
  p_assigned_by uuid DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
BEGIN
  IF p_table_id IS NULL THEN
    RAISE EXCEPTION 'assign_single_table requires a table id.';
  END IF;

  PERFORM public.assign_tables_atomic_v2(
    p_booking_id := p_booking_id,
    p_table_ids := ARRAY[p_table_id],
    p_idempotency_key := p_idempotency_key,
    p_require_adjacency := false,
    p_assigned_by := p_assigned_by
  );
END;
$$;
COMMENT ON FUNCTION public.assign_single_table(uuid, uuid, uuid, text)
  IS 'Atomically assigns a single table to a booking; preferred entrypoint for standard seating.';
-- Explicit merged-table wrapper for large parties.
CREATE OR REPLACE FUNCTION public.assign_merged_tables(
  p_booking_id uuid,
  p_table_ids uuid[],
  p_require_adjacency boolean DEFAULT true,
  p_assigned_by uuid DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_table_count integer;
BEGIN
  v_table_count := COALESCE(array_length(p_table_ids, 1), 0);

  IF v_table_count < 2 THEN
    RAISE EXCEPTION 'assign_merged_tables requires at least two table ids.';
  END IF;

  PERFORM public.assign_tables_atomic_v2(
    p_booking_id := p_booking_id,
    p_table_ids := p_table_ids,
    p_idempotency_key := p_idempotency_key,
    p_require_adjacency := p_require_adjacency,
    p_assigned_by := p_assigned_by
  );
END;
$$;
COMMENT ON FUNCTION public.assign_merged_tables(uuid, uuid[], boolean, uuid, text)
  IS 'Atomically assigns multiple tables to a booking with optional adjacency enforcement.';
-- Document legacy entrypoints as deprecated without altering behaviour.
DO $$
BEGIN
  EXECUTE 'COMMENT ON FUNCTION public.assign_tables_atomic(uuid, uuid[], tstzrange, uuid, text) IS ''DEPRECATED: prefer assign_single_table() or assign_merged_tables().''';
  EXECUTE 'COMMENT ON FUNCTION public.assign_tables_atomic_v2(uuid, uuid[], text, boolean, uuid) IS ''DEPRECATED: prefer assign_single_table() or assign_merged_tables().''';
  EXECUTE 'COMMENT ON FUNCTION public.assign_tables_atomic_v2(uuid, uuid[], text, boolean, uuid, timestamp with time zone, timestamp with time zone) IS ''DEPRECATED: prefer assign_single_table() or assign_merged_tables().''';
END $$;
