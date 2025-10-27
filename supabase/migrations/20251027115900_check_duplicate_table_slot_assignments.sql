-- Pre-migration check: Identify duplicate table-slot assignments
-- This is a read-only check that logs warnings if duplicates exist

DO $$
DECLARE
    duplicate_count INTEGER;
BEGIN
    -- Count duplicates
    SELECT COUNT(*) INTO duplicate_count
    FROM (
        SELECT table_id, slot_id
        FROM public.booking_table_assignments
        WHERE slot_id IS NOT NULL
        GROUP BY table_id, slot_id
        HAVING COUNT(*) > 1
    ) dup;
    
    -- Log the results
    IF duplicate_count > 0 THEN
        RAISE WARNING 'Found % duplicate table-slot assignments. Manual cleanup may be required.', duplicate_count;
    ELSE
        RAISE NOTICE 'No duplicate table-slot assignments found. Safe to proceed.';
    END IF;
END $$;
