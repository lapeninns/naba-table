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
