-- cleanup-bookings.sql
-- Removes all bookings for "The Corner House" and "Old Crown" restaurants.
-- Explicitly preserves "White Horse Pub".

DO $$
DECLARE
    target_restaurant_ids uuid[];
    deleted_count integer;
BEGIN
    -- 1. Identify the target restaurants
    SELECT array_agg(id) INTO target_restaurant_ids
    FROM restaurants
    WHERE (name ILIKE '%Corner House%' OR name ILIKE '%Old Crown%')
      AND name NOT ILIKE '%White Horse%';

    IF target_restaurant_ids IS NULL THEN
        RAISE NOTICE 'No matching restaurants found to clean up.';
        RETURN;
    END IF;

    RAISE NOTICE 'Targeting restaurants with IDs: %', target_restaurant_ids;

    -- 2. Delete Bookings (Cascade should handle allocations, but we can be explicit if needed)
    -- Note: We rely on ON DELETE CASCADE for related tables like assignments/allocations.
    -- If your schema doesn't cascade, you'd delete from those tables here first.
    
    WITH deleted_rows AS (
        DELETE FROM bookings
        WHERE restaurant_id = ANY(target_restaurant_ids)
        RETURNING id
    )
    SELECT count(*) INTO deleted_count FROM deleted_rows;

    RAISE NOTICE 'Successfully removed % bookings.', deleted_count;

END $$;
