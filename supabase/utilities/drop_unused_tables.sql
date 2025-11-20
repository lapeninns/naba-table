-- ⚠️ DANGER: This script will DROP ALL TABLES in the 'public' schema
-- that are NOT in the 'keep_tables' list below.
-- It is irreversible. Make sure you have a backup!

DO $$ 
DECLARE 
    r RECORD; 
    keep_tables text[] := ARRAY[
        -- System / Migrations
        '_migrations', 
        'schema_migrations',
        'spatial_ref_sys',

        -- Core Application Tables (Identified as Used)
        'allocations', 
        'allowed_capacities', 
        'analytics_events', 
        'audit_logs', 
        'booking_assignment_attempts', 
        'booking_assignment_idempotency', 
        'booking_assignment_state_history', 
        'booking_confirmation_results', 
        'booking_occasions', 
        'booking_slots', 
        'booking_state_history', 
        'booking_table_assignments', 
        'booking_versions', 
        'bookings', 
        'capacity_observability_hold_metrics', 
        'capacity_observability_rpc_conflicts', 
        'capacity_observability_selector_metrics', 
        'capacity_outbox', 
        'current_bookings', 
        'customer_profiles', 
        'customers', 
        'demand_profiles', 
        'feature_flag_overrides', 
        'leads', 
        'loyalty_point_events', 
        'loyalty_points', 
        'loyalty_programs', 
        'merge_rules', 
        'observability_events', 
        'profile_update_requests', 
        'profiles', 
        'restaurant_invites', 
        'restaurant_memberships', 
        'restaurant_operating_hours', 
        'restaurant_service_periods', 
        'restaurants', 
        'service_policy', 
        'strategic_configs', 
        'table_adjacencies', 
        'table_hold_members', 
        'table_hold_windows', 
        'table_holds', 
        'table_inventory', 
        'table_scarcity_metrics', 
        'user_profiles', 
        'waiting_list', 
        'zones',
        'restaurant_capacity_rules'
    ];
BEGIN 
    FOR r IN (
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' 
    ) LOOP 
        IF NOT (r.tablename = ANY(keep_tables)) THEN
            RAISE NOTICE 'Dropping unused table: %', r.tablename;
            EXECUTE 'DROP TABLE IF EXISTS public.' || quote_ident(r.tablename) || ' CASCADE'; 
        ELSE
            RAISE NOTICE 'Keeping table: %', r.tablename;
        END IF; 
    END LOOP; 
END $$;
