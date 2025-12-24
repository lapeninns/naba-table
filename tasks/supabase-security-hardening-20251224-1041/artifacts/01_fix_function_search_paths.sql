-- ============================================================================
-- Migration: Fix Function Search Path Mutable (Security Hardening)
-- ============================================================================
-- 
-- CORRECTED VERSION: Uses search_path = public (not empty string)
-- 
-- Why search_path = public instead of empty:
-- - Empty search_path breaks functions that don't use fully qualified names
-- - search_path = public is still secure as it's explicit
-- - Prevents dynamic search_path hijacking
-- ============================================================================

-- Fix all functions to use search_path = public
DO $$
DECLARE
    func_record RECORD;
    alter_sql TEXT;
    success_count INT := 0;
    target_functions TEXT[] := ARRAY[
        'allocations_overlap',
        'allowed_capacities_set_updated_at',
        'apply_booking_state_transition',
        'are_tables_connected',
        'assign_tables_atomic',
        'booking_status_summary',
        'current_restaurant_id',
        'generate_booking_reference',
        'get_or_create_booking_slot',
        'increment_booking_slot_version',
        'is_holds_strict_conflicts_enabled',
        'is_table_available_v2',
        'log_table_assignment_change',
        'on_allocations_refresh',
        'on_booking_status_refresh',
        'process_late_arrivals',
        'prune_allocations_history',
        'refresh_table_status',
        'require_restaurant_context',
        'set_booking_instants',
        'set_booking_reference',
        'set_hold_conflict_enforcement',
        'set_timestamp_updated_at',
        'set_updated_at',
        'sync_table_hold_windows',
        'unassign_table_from_booking',
        'unassign_tables_atomic',
        'update_table_hold_windows',
        'update_updated_at',
        'update_updated_at_column',
        'user_restaurants',
        'validate_booking_capacity_after_assignment',
        'validate_booking_has_assignments',
        'validate_table_adjacency',
        'confirm_hold_assignment_tx',
        'confirm_hold_assignment_with_transition'
    ];
BEGIN
    FOR func_record IN
        SELECT 
            n.nspname AS schema_name,
            p.proname AS function_name,
            pg_get_function_identity_arguments(p.oid) AS args
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
          AND p.proname = ANY(target_functions)
    LOOP
        alter_sql := format(
            'ALTER FUNCTION %I.%I(%s) SET search_path = public;',
            func_record.schema_name,
            func_record.function_name,
            func_record.args
        );
        
        BEGIN
            EXECUTE alter_sql;
            success_count := success_count + 1;
            RAISE NOTICE 'SUCCESS: %', alter_sql;
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'FAILED: % - Error: %', alter_sql, SQLERRM;
        END;
    END LOOP;
    
    RAISE NOTICE '========================================';
    RAISE NOTICE 'SUMMARY: % functions updated', success_count;
    RAISE NOTICE '========================================';
END;
$$;

-- ============================================================================
-- Verification: Check which functions have search_path set
-- ============================================================================

SELECT 
    p.proname AS function_name,
    pg_get_function_identity_arguments(p.oid) AS args,
    p.proconfig AS config
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proconfig IS NOT NULL
  AND 'search_path=public' = ANY(p.proconfig)
ORDER BY p.proname
LIMIT 20;
