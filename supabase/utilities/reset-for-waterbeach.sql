-- reset-for-waterbeach.sql
-- Complete database reset: truncates all data, then reseeds with Waterbeach only
-- Run via: psql "$SUPABASE_DB_URL" -f supabase/utilities/reset-for-waterbeach.sql

\echo '🔄 Starting complete database reset for Waterbeach-only setup...'

BEGIN;

SET LOCAL client_min_messages = warning;

-- Truncate all data tables (preserving schema)
\echo '  🗑️  Truncating all tables...'

TRUNCATE TABLE
    public.table_hold_windows,
    public.table_hold_members,
    public.table_holds,
    public.booking_assignment_idempotency,
    public.booking_table_assignments,
    public.allocations,
    public.observability_events,
    public.analytics_events,
    public.booking_slots,
    public.booking_state_history,
    public.booking_versions,
    public.booking_occasions,
    public.bookings,
    public.customer_profiles,
    public.customers,
    public.loyalty_point_events,
    public.loyalty_points,
    public.loyalty_programs,
    public.restaurant_invites,
    public.restaurant_memberships,
    public.restaurant_operating_hours,
    public.restaurant_service_periods,
    public.restaurants,
    public.service_policy,
    public.feature_flag_overrides,
    public.table_adjacencies,
    public.table_inventory,
    public.allowed_capacities,
    public.zones,
    public.profile_update_requests,
    public.profiles
CASCADE;

\echo '  ✓ All tables truncated'

-- Note: auth.users not truncated to preserve owner account
-- If you need to reset auth.users, run separately: TRUNCATE TABLE auth.users CASCADE;

COMMIT;

\echo '✅ Database reset complete. Ready for Waterbeach seed.'
