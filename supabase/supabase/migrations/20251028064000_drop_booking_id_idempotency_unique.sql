-- Drop the partial unique index that prevents multi-table assignments sharing the same idempotency key.
-- The allocator relies on booking_assignment_idempotency for dedupe; enforcing uniqueness here causes
-- assign_tables_atomic_v2 to explode when inserting multiple records per booking/key.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'booking_table_assignments_booking_id_idempotency_key_key'
  ) THEN
    EXECUTE 'DROP INDEX public.booking_table_assignments_booking_id_idempotency_key_key';
  END IF;
END;
$$;
