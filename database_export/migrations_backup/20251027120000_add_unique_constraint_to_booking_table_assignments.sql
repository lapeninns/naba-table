-- Add unique constraint to prevent duplicate table assignments per slot
-- This enforces that a table can only be assigned to a specific slot once

-- Add the unique constraint
ALTER TABLE public.booking_table_assignments
ADD CONSTRAINT booking_table_assignments_table_id_slot_id_key 
UNIQUE (table_id, slot_id);
-- Create an index to support the constraint (automatically created by UNIQUE)
-- Note: PostgreSQL automatically creates an index for UNIQUE constraints;
