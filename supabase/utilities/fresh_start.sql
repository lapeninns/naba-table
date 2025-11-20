-- 🔄 FRESH START SCRIPT
-- This script wipes all TRANSACTIONAL data (bookings, history, logs)
-- but PRESERVES your configuration (Restaurants, Tables, Zones, Settings).
-- Use this to reset the application state without losing your setup.

BEGIN;

-- 1. Core Transactional Data
--    (Cascades will handle dependent tables like booking_occasions, etc. if configured,
--     but we list major ones for clarity)
TRUNCATE TABLE public.bookings CASCADE;
TRUNCATE TABLE public.allocations CASCADE;
TRUNCATE TABLE public.table_holds CASCADE;

-- 2. Assignment & Capacity Data
TRUNCATE TABLE public.booking_table_assignments CASCADE;
TRUNCATE TABLE public.booking_assignment_attempts CASCADE;
TRUNCATE TABLE public.booking_assignment_idempotency CASCADE;
TRUNCATE TABLE public.booking_assignment_state_history CASCADE;
TRUNCATE TABLE public.capacity_outbox CASCADE;

-- 3. History & Versioning
TRUNCATE TABLE public.booking_state_history CASCADE;
TRUNCATE TABLE public.booking_versions CASCADE;
TRUNCATE TABLE public.booking_confirmation_results CASCADE;

-- 4. Logs & Observability
TRUNCATE TABLE public.audit_logs CASCADE;
TRUNCATE TABLE public.analytics_events CASCADE;

-- 5. Loyalty (Optional - Transactional)
TRUNCATE TABLE public.loyalty_point_events CASCADE;
TRUNCATE TABLE public.loyalty_points CASCADE;

-- 6. Other Transactional
TRUNCATE TABLE public.restaurant_invites CASCADE;

COMMIT;

-- ✅ What remains:
-- - Restaurants
-- - Table Inventory & Zones
-- - Service Periods & Operating Hours
-- - Configuration Rules (Merge rules, Capacity rules)
-- - Customers & Profiles (Users are preserved)
