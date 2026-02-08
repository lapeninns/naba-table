-- Migration: Change booking_table_assignments FK to CASCADE on table deletion
-- Issue: [7b] Orphaned assignments when tables are deleted from inventory
-- Fix: ON DELETE CASCADE ensures automatic cleanup when tables are removed

-- Purpose: When a table is deleted from table_inventory, any booking_table_assignments
-- referencing that table should be automatically removed. This prevents:
-- 1. TABLES_NOT_FOUND errors when loading assignment context
-- 2. Need for reactive background cleanup jobs
-- 3. Orphaned data accumulation

BEGIN;

-- Drop the existing RESTRICT constraint
ALTER TABLE public.booking_table_assignments
  DROP CONSTRAINT IF EXISTS booking_table_assignments_table_id_fkey;

-- Re-add with CASCADE behavior
ALTER TABLE public.booking_table_assignments
  ADD CONSTRAINT booking_table_assignments_table_id_fkey
    FOREIGN KEY (table_id)
    REFERENCES public.table_inventory(id)
    ON DELETE CASCADE;

-- Also ensure booking FK cascades (for when bookings are deleted)
ALTER TABLE public.booking_table_assignments
  DROP CONSTRAINT IF EXISTS booking_table_assignments_booking_id_fkey;

ALTER TABLE public.booking_table_assignments
  ADD CONSTRAINT booking_table_assignments_booking_id_fkey
    FOREIGN KEY (booking_id)
    REFERENCES public.bookings(id)
    ON DELETE CASCADE;

COMMIT;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';


-- ---------------------------------------------------------------------------
-- MERGED FROM: 20260118_lock_down_table_soft_holds_access.sql
-- ---------------------------------------------------------------------------

-- Migration: Lock down access to table_soft_holds
-- Issue: Soft-holds table was readable/writable by authenticated users, exposing session tokens
-- Fix: Remove direct table privileges/policies; rely on SECURITY DEFINER RPCs only

BEGIN;

-- Remove direct table access for client roles
REVOKE ALL ON TABLE public.table_soft_holds FROM authenticated;
REVOKE ALL ON TABLE public.table_soft_holds FROM anon;

-- Ensure service role retains access
GRANT ALL ON TABLE public.table_soft_holds TO service_role;

-- Remove overly-permissive authenticated policies
DROP POLICY IF EXISTS "Users can view soft holds" ON public.table_soft_holds;
DROP POLICY IF EXISTS "Users can insert soft holds" ON public.table_soft_holds;
DROP POLICY IF EXISTS "Users can delete their own soft holds" ON public.table_soft_holds;

-- Keep RLS enabled; no authenticated policies means no direct access
ALTER TABLE public.table_soft_holds ENABLE ROW LEVEL SECURITY;

-- Ensure the RPCs remain SECURITY DEFINER and scoped to public schema
ALTER FUNCTION public.acquire_soft_holds_atomic(uuid[], tstzrange, uuid, uuid, uuid, integer) SECURITY DEFINER;
ALTER FUNCTION public.acquire_soft_holds_atomic(uuid[], tstzrange, uuid, uuid, uuid, integer) SET search_path = public;

ALTER FUNCTION public.release_soft_holds(uuid, uuid[]) SECURITY DEFINER;
ALTER FUNCTION public.release_soft_holds(uuid, uuid[]) SET search_path = public;

ALTER FUNCTION public.check_soft_hold_ownership(uuid, uuid[], tstzrange) SECURITY DEFINER;
ALTER FUNCTION public.check_soft_hold_ownership(uuid, uuid[], tstzrange) SET search_path = public;

COMMIT;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
