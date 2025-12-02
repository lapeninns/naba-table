-- Pre-migration check: Identify duplicate table-slot assignments
-- This query should be run BEFORE applying the unique constraint migration
-- to identify and fix any existing data integrity issues.

-- Find duplicate assignments (same table assigned to same slot multiple times)
SELECT 
    table_id,
    slot_id,
    COUNT(*) as assignment_count,
    ARRAY_AGG(booking_id ORDER BY assigned_at) as booking_ids,
    ARRAY_AGG(id ORDER BY assigned_at) as assignment_ids,
    MIN(assigned_at) as first_assigned,
    MAX(assigned_at) as last_assigned
FROM public.booking_table_assignments
WHERE slot_id IS NOT NULL -- Only check slot-based assignments
GROUP BY table_id, slot_id
HAVING COUNT(*) > 1
ORDER BY assignment_count DESC, table_id, slot_id;
-- Summary of duplicate issues
SELECT 
    COUNT(DISTINCT table_id) as affected_tables,
    COUNT(DISTINCT slot_id) as affected_slots,
    SUM(duplicate_count - 1) as total_duplicates_to_resolve
FROM (
    SELECT 
        table_id,
        slot_id,
        COUNT(*) as duplicate_count
    FROM public.booking_table_assignments
    WHERE slot_id IS NOT NULL
    GROUP BY table_id, slot_id
    HAVING COUNT(*) > 1
) duplicates;
-- If duplicates exist, this cleanup script can be adapted based on business rules:
-- Option 1: Keep the earliest assignment, delete others
-- Option 2: Keep the most recent assignment, delete others
-- Option 3: Manual review required

-- EXAMPLE cleanup (commented out - review before using):
-- DELETE FROM public.booking_table_assignments
-- WHERE id IN (
--     SELECT id 
--     FROM (
--         SELECT 
--             id,
--             ROW_NUMBER() OVER (
--                 PARTITION BY table_id, slot_id 
--                 ORDER BY assigned_at ASC
--             ) as rn
--         FROM public.booking_table_assignments
--         WHERE slot_id IS NOT NULL
--     ) ranked
--     WHERE rn > 1
-- );;
