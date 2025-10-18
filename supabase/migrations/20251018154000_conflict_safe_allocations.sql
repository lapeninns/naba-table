-- Migration: Conflict-safe allocations & atomic assignment RPCs
-- Description: Restructure allocations table, add range exclusion, and introduce transactional table assignment RPCs.
-- Date: 2025-10-18

-- =====================================================
-- 1. Ensure required extensions (btree_gist for EXCLUDE)
-- =====================================================
CREATE EXTENSION IF NOT EXISTS "btree_gist" WITH SCHEMA public;

-- =====================================================
-- 2. Reshape public.allocations to use tstzrange windows
-- =====================================================
ALTER TABLE public.allocations
  ADD COLUMN IF NOT EXISTS restaurant_id uuid,
  ADD COLUMN IF NOT EXISTS "window" tstzrange,
  ADD COLUMN IF NOT EXISTS created_by uuid;

UPDATE public.allocations a
SET restaurant_id = b.restaurant_id
FROM public.bookings b
WHERE a.booking_id = b.id
  AND a.restaurant_id IS NULL;

UPDATE public.allocations
SET "window" = tstzrange(block_start, block_end, '[)')
WHERE "window" IS NULL
  AND block_start IS NOT NULL
  AND block_end IS NOT NULL;

UPDATE public.allocations
SET "window" = tstzrange(
    COALESCE(block_start, block_end - interval '1 minute'),
    COALESCE(block_end, block_start + interval '1 minute'),
    '[)'
  )
WHERE "window" IS NULL
  AND (block_start IS NOT NULL OR block_end IS NOT NULL);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.allocations WHERE "window" IS NULL) THEN
    RAISE EXCEPTION 'allocations window could not be backfilled prior to enforcing NOT NULL';
  END IF;
END;
$$;

ALTER TABLE public.allocations
  ALTER COLUMN restaurant_id SET NOT NULL,
  ALTER COLUMN "window" SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'allocations_restaurant_id_fkey'
  ) THEN
    ALTER TABLE public.allocations
      ADD CONSTRAINT allocations_restaurant_id_fkey
        FOREIGN KEY (restaurant_id)
        REFERENCES public.restaurants(id)
        ON DELETE CASCADE;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'allocations_created_by_fkey'
  ) THEN
    ALTER TABLE public.allocations
      ADD CONSTRAINT allocations_created_by_fkey
        FOREIGN KEY (created_by)
        REFERENCES auth.users(id)
        ON DELETE SET NULL;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'allocations_booking_resource_key'
  ) THEN
    ALTER TABLE public.allocations
      ADD CONSTRAINT allocations_booking_resource_key
        UNIQUE (booking_id, resource_type, resource_id);
  END IF;
END;
$$;

DROP INDEX IF EXISTS allocations_resource_idx;

CREATE INDEX IF NOT EXISTS allocations_resource_window_idx
  ON public.allocations
  USING gist (resource_type, resource_id, "window");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'allocations_resource_window_excl'
  ) THEN
    ALTER TABLE public.allocations
      ADD CONSTRAINT allocations_resource_window_excl
        EXCLUDE USING gist (
          resource_type WITH =,
          resource_id WITH =,
          "window" WITH &&
        )
        DEFERRABLE INITIALLY DEFERRED;
  END IF;
END;
$$;

ALTER TABLE public.allocations
  DROP COLUMN IF EXISTS block_start,
  DROP COLUMN IF EXISTS block_end;

-- =====================================================
-- 3. Tighten RLS policies and helper function
-- =====================================================
DROP POLICY IF EXISTS "Staff can view allocations" ON public.allocations;

CREATE POLICY "Staff can view allocations for their restaurants"
  ON public.allocations
  FOR SELECT
  TO authenticated
  USING (restaurant_id IN (SELECT public.user_restaurants()));

DROP FUNCTION IF EXISTS public.allocations_overlap(uuid, text, timestamptz, timestamptz);

CREATE OR REPLACE FUNCTION public.allocations_overlap(a tstzrange, b tstzrange)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(a && b, false);
$$;

COMMENT ON FUNCTION public.allocations_overlap(tstzrange, tstzrange)
  IS 'Returns true when two timestamptz ranges overlap (half-open [start,end) semantics).';

-- =====================================================
-- 4. Booking assignments idempotency plumbing
-- =====================================================
ALTER TABLE public.booking_table_assignments
  ADD COLUMN IF NOT EXISTS idempotency_key text,
  ADD COLUMN IF NOT EXISTS merge_group_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'booking_table_assignments_merge_group_id_fkey'
  ) THEN
    ALTER TABLE public.booking_table_assignments
      ADD CONSTRAINT booking_table_assignments_merge_group_id_fkey
        FOREIGN KEY (merge_group_id)
        REFERENCES public.merge_groups(id)
        ON DELETE SET NULL;
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS booking_table_assignments_booking_id_idempotency_key_key
  ON public.booking_table_assignments (booking_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- =====================================================
-- 5. Atomic assignment RPC
-- =====================================================
DO $$
BEGIN
  EXECUTE $fn$
    CREATE OR REPLACE FUNCTION public.assign_tables_atomic(
      p_booking_id uuid,
      p_table_ids uuid[],
      p_window tstzrange,
      p_assigned_by uuid DEFAULT NULL,
      p_idempotency_key text DEFAULT NULL
    )
    RETURNS TABLE (
      table_id uuid,
      assignment_id uuid,
      merge_group_id uuid
    )
    LANGUAGE plpgsql
    SECURITY DEFINER
    AS $body$
    DECLARE
      v_booking RECORD;
      v_restaurant_id uuid;
      v_target_tables uuid[];
      v_table RECORD;
      v_total_capacity integer := 0;
      v_first_zone uuid := NULL;
      v_merge_group_id uuid := NULL;
      v_slot_id uuid := NULL;
      v_now timestamptz := now();
      v_window tstzrange := p_window;
      v_assignment_id uuid;
      v_loaded_count integer := 0;
      v_table_id uuid;
    BEGIN
      IF p_table_ids IS NULL OR array_length(p_table_ids, 1) = 0 THEN
        RAISE EXCEPTION 'assign_tables_atomic requires at least one table id'
          USING ERRCODE = '23514';
      END IF;

      SELECT array_agg(DISTINCT table_id)
      INTO v_target_tables
      FROM unnest(p_table_ids) AS t(table_id);

      IF v_target_tables IS NULL OR array_length(v_target_tables, 1) = 0 THEN
        RAISE EXCEPTION 'assign_tables_atomic requires at least one valid table id'
          USING ERRCODE = '23514';
      END IF;

      SELECT *
      INTO v_booking
      FROM public.bookings
      WHERE id = p_booking_id
      FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Booking % not found', p_booking_id
          USING ERRCODE = 'P0002';
      END IF;

      v_restaurant_id := v_booking.restaurant_id;

      IF v_window IS NULL THEN
        v_window := tstzrange(v_booking.start_at, v_booking.end_at, '[)');
      END IF;

      IF v_window IS NULL OR lower(v_window) IS NULL OR upper(v_window) IS NULL OR lower(v_window) >= upper(v_window) THEN
        RAISE EXCEPTION 'Invalid assignment window for booking %', p_booking_id
          USING ERRCODE = '22000';
      END IF;

      FOR v_table IN
        SELECT id, restaurant_id, zone_id, capacity
        FROM public.table_inventory
        WHERE id = ANY (v_target_tables)
        ORDER BY id
        FOR UPDATE
      LOOP
        IF v_table.restaurant_id <> v_restaurant_id THEN
          RAISE EXCEPTION 'Table % belongs to a different restaurant', v_table.id;
        END IF;

        IF v_table.zone_id IS NULL THEN
          RAISE EXCEPTION 'Table % is not assigned to a zone', v_table.id;
        END IF;

        IF v_first_zone IS NULL THEN
          v_first_zone := v_table.zone_id;
        ELSIF v_first_zone <> v_table.zone_id THEN
          RAISE EXCEPTION 'All tables must belong to the same zone';
        END IF;

        v_total_capacity := v_total_capacity + COALESCE(v_table.capacity, 0);
        v_loaded_count := v_loaded_count + 1;
      END LOOP;

      IF v_loaded_count <> array_length(v_target_tables, 1) THEN
        RAISE EXCEPTION 'Unable to load all requested tables';
      END IF;

      IF array_length(v_target_tables, 1) > 1 THEN
        INSERT INTO public.merge_groups (capacity, created_at)
        VALUES (NULLIF(v_total_capacity, 0), v_now)
        RETURNING id INTO v_merge_group_id;

        INSERT INTO public.merge_group_members (merge_group_id, table_id)
        SELECT v_merge_group_id, unnest(v_target_tables)
        ON CONFLICT DO NOTHING;
      END IF;

      IF v_booking.booking_date IS NOT NULL AND v_booking.start_time IS NOT NULL THEN
        SELECT id
        INTO v_slot_id
        FROM public.booking_slots
        WHERE restaurant_id = v_restaurant_id
          AND slot_date = v_booking.booking_date
          AND slot_time = v_booking.start_time
        LIMIT 1;

        IF v_slot_id IS NULL THEN
          SELECT public.get_or_create_booking_slot(v_restaurant_id, v_booking.booking_date, v_booking.start_time, 999)
          INTO v_slot_id;
        END IF;
      END IF;

      FOREACH v_table_id IN ARRAY v_target_tables LOOP
        INSERT INTO public.booking_table_assignments (
          booking_id,
          table_id,
          slot_id,
          assigned_by,
          idempotency_key,
          merge_group_id
        ) VALUES (
          p_booking_id,
          v_table_id,
          v_slot_id,
          p_assigned_by,
          p_idempotency_key,
          v_merge_group_id
        )
        ON CONFLICT (booking_id, table_id) DO UPDATE
        SET assigned_by = EXCLUDED.assigned_by,
            assigned_at = v_now,
            idempotency_key = COALESCE(EXCLUDED.idempotency_key, public.booking_table_assignments.idempotency_key),
            merge_group_id = COALESCE(EXCLUDED.merge_group_id, public.booking_table_assignments.merge_group_id)
        RETURNING id INTO v_assignment_id;

        INSERT INTO public.allocations (
          booking_id,
          restaurant_id,
          resource_type,
          resource_id,
          "window",
          created_by,
          shadow,
          created_at,
          updated_at
        ) VALUES (
          p_booking_id,
          v_restaurant_id,
          'table',
          v_table_id,
          v_window,
          p_assigned_by,
          false,
          v_now,
          v_now
        )
        ON CONFLICT ON CONSTRAINT allocations_booking_resource_key DO UPDATE
        SET "window" = EXCLUDED."window",
            created_by = EXCLUDED.created_by,
            updated_at = v_now;

        UPDATE public.table_inventory
        SET status = 'reserved'::public.table_status
        WHERE id = v_table_id;

        table_id := v_table_id;
        assignment_id := v_assignment_id;
        merge_group_id := v_merge_group_id;
        RETURN NEXT;
      END LOOP;

      IF v_merge_group_id IS NOT NULL THEN
        INSERT INTO public.allocations (
          booking_id,
          restaurant_id,
          resource_type,
          resource_id,
          "window",
          created_by,
          shadow,
          created_at,
          updated_at
        ) VALUES (
          p_booking_id,
          v_restaurant_id,
          'merge_group',
          v_merge_group_id,
          v_window,
          p_assigned_by,
          false,
          v_now,
          v_now
        )
        ON CONFLICT ON CONSTRAINT allocations_booking_resource_key DO UPDATE
        SET "window" = EXCLUDED."window",
            created_by = EXCLUDED.created_by,
            updated_at = v_now;
      END IF;

      RETURN;
    END;
    $body$;
  $fn$;
END;
$$;

-- =====================================================
-- 6. Atomic unassign RPC
-- =====================================================
DO $$
BEGIN
  EXECUTE $fn$
    CREATE OR REPLACE FUNCTION public.unassign_tables_atomic(
      p_booking_id uuid,
      p_table_ids uuid[] DEFAULT NULL,
      p_merge_group_id uuid DEFAULT NULL
    )
    RETURNS TABLE (
      table_id uuid,
      merge_group_id uuid
    )
    LANGUAGE plpgsql
    SECURITY DEFINER
    AS $body$
    DECLARE
      v_target_tables uuid[] := p_table_ids;
      v_removed RECORD;
      v_tables_from_group uuid[];
      v_merge_group_id uuid := p_merge_group_id;
    BEGIN
      IF v_target_tables IS NOT NULL THEN
        SELECT array_agg(DISTINCT table_id)
        INTO v_target_tables
        FROM unnest(v_target_tables) AS t(table_id);
      END IF;

      IF (v_target_tables IS NULL OR array_length(v_target_tables, 1) = 0) THEN
        IF v_merge_group_id IS NULL THEN
          RAISE EXCEPTION 'Provide table_ids or merge_group_id to unassign'
            USING ERRCODE = '23514';
        END IF;

        SELECT array_agg(table_id)
        INTO v_tables_from_group
        FROM public.merge_group_members
        WHERE merge_group_id = v_merge_group_id;

        v_target_tables := v_tables_from_group;
      END IF;

      IF v_target_tables IS NULL OR array_length(v_target_tables, 1) = 0 THEN
        RETURN;
      END IF;

      FOR v_removed IN
        DELETE FROM public.booking_table_assignments
        WHERE booking_id = p_booking_id
          AND table_id = ANY (v_target_tables)
        RETURNING table_id, merge_group_id
      LOOP
        table_id := v_removed.table_id;
        merge_group_id := v_removed.merge_group_id;
        IF v_merge_group_id IS NULL THEN
          v_merge_group_id := v_removed.merge_group_id;
        END IF;

        DELETE FROM public.allocations
        WHERE booking_id = p_booking_id
          AND resource_type = 'table'
          AND resource_id = v_removed.table_id;

        UPDATE public.table_inventory ti
        SET status = 'available'::public.table_status
        WHERE ti.id = v_removed.table_id
          AND NOT EXISTS (
            SELECT 1
            FROM public.booking_table_assignments bta
            WHERE bta.table_id = v_removed.table_id
          );

        RETURN NEXT;
      END LOOP;

      IF v_merge_group_id IS NULL THEN
        SELECT merge_group_id
        INTO v_merge_group_id
        FROM public.booking_table_assignments
        WHERE booking_id = p_booking_id
          AND merge_group_id IS NOT NULL
        LIMIT 1;
      END IF;

      IF v_merge_group_id IS NOT NULL THEN
        DELETE FROM public.allocations
        WHERE booking_id = p_booking_id
          AND resource_type = 'merge_group'
          AND resource_id = v_merge_group_id;

        UPDATE public.merge_groups
        SET dissolved_at = now()
        WHERE id = v_merge_group_id
          AND NOT EXISTS (
            SELECT 1
            FROM public.booking_table_assignments bta
            WHERE bta.merge_group_id = v_merge_group_id
          );

        DELETE FROM public.merge_group_members
        WHERE merge_group_id = v_merge_group_id
          AND NOT EXISTS (
            SELECT 1
            FROM public.booking_table_assignments bta
            WHERE bta.merge_group_id = v_merge_group_id
          );
      END IF;

      RETURN;
    END;
    $body$;
  $fn$;
END;
$$;

-- =====================================================
-- 7. Grant execute permissions
-- =====================================================
DO $$
BEGIN
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.assign_tables_atomic(uuid, uuid[], tstzrange, uuid, text) TO service_role';
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.unassign_tables_atomic(uuid, uuid[], uuid) TO service_role';
END;
$$;
