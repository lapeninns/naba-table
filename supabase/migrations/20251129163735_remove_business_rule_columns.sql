-- Migration: Remove Business Rule Columns from table_inventory
-- Date: 2025-11-29
--
-- Background:
-- The columns min_party_size and max_party_size were storing business rules
-- in the database, when they should be derived from physical properties in code.
--
-- Business Logic (now in code):
-- - Movable tables: min_party_size = 1, max_party_size = null (unlimited, can be merged)
-- - Fixed tables: min_party_size = 1, max_party_size = capacity (strict limit)
--
-- This migration removes these columns as they are now derived via deriveTableRules()
-- in server/capacity/table-rules.ts
--
-- IMPORTANT: This is a breaking change. Ensure all code has been updated to use
-- deriveTableRules() before running this migration.

-- Drop the columns
ALTER TABLE public.table_inventory
  DROP COLUMN IF EXISTS min_party_size,
  DROP COLUMN IF EXISTS max_party_size;

-- Add comment to explain the change
COMMENT ON TABLE public.table_inventory IS
  'Physical table inventory. Party size rules are derived from mobility and capacity in application code.';

COMMENT ON COLUMN public.table_inventory.mobility IS
  'Physical property: whether table can be moved. Business rules are derived from this:
  - movable: can be merged with other tables (unlimited party size when combined)
  - fixed: cannot be merged (strict party size = capacity)';

COMMENT ON COLUMN public.table_inventory.capacity IS
  'Physical property: number of seats. For fixed tables, this is also the max party size.';
