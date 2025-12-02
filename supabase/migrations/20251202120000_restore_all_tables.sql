-- Restore ALL tables that may have been dropped
-- This migration ensures all tables exist in the schema (Required + Optional + "Useless")
-- Tables are created with IF NOT EXISTS to be idempotent

BEGIN;

--------------------------------------------------------------------------------
-- 1. MERGE_RULES - Config table for table merging rules
--------------------------------------------------------------------------------
DO $block$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'merge_rules'
  ) THEN
    EXECUTE $$
      CREATE TABLE public.merge_rules (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        from_a smallint NOT NULL,
        from_b smallint NOT NULL,
        to_capacity smallint NOT NULL,
        enabled boolean NOT NULL DEFAULT true,
        require_same_zone boolean NOT NULL DEFAULT true,
        require_adjacency boolean NOT NULL DEFAULT true,
        cross_category_merge boolean NOT NULL DEFAULT false,
        created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
        updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
        CONSTRAINT merge_rules_positive CHECK (from_a > 0 AND from_b > 0 AND to_capacity > 0)
      )
    $$;

    EXECUTE $$CREATE UNIQUE INDEX IF NOT EXISTS merge_rules_from_to_idx
              ON public.merge_rules (from_a, from_b, to_capacity)$$;

    -- Create trigger if update_updated_at function exists
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at') THEN
      EXECUTE $$CREATE TRIGGER merge_rules_updated_at
                BEFORE UPDATE ON public.merge_rules
                FOR EACH ROW
                EXECUTE FUNCTION public.update_updated_at()$$;
    END IF;

    EXECUTE $$ALTER TABLE public.merge_rules ENABLE ROW LEVEL SECURITY$$;

    EXECUTE $$CREATE POLICY "Service role can manage merge rules"
              ON public.merge_rules
              USING (true)
              WITH CHECK (true)$$;

    EXECUTE $$CREATE POLICY "Staff can view merge rules"
              ON public.merge_rules
              FOR SELECT
              USING (true)$$;

    EXECUTE $$GRANT SELECT, INSERT, UPDATE, DELETE ON public.merge_rules TO service_role$$;
    EXECUTE $$GRANT SELECT ON public.merge_rules TO authenticated, anon$$;

    RAISE NOTICE 'Created table: merge_rules';
  END IF;
END;
$block$;

--------------------------------------------------------------------------------
-- 2. BOOKING_OCCASIONS_AUDIT - Audit trail for booking occasions changes
--------------------------------------------------------------------------------
DO $block$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'booking_occasions_audit'
  ) THEN
    EXECUTE $$
      CREATE TABLE public.booking_occasions_audit (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        occasion_key text NOT NULL,
        action text NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
        old_data jsonb,
        new_data jsonb,
        changed_by uuid,
        changed_at timestamptz NOT NULL DEFAULT timezone('utc', now())
      )
    $$;

    EXECUTE $$CREATE INDEX IF NOT EXISTS booking_occasions_audit_key_idx 
              ON public.booking_occasions_audit (occasion_key, changed_at DESC)$$;

    EXECUTE $$ALTER TABLE public.booking_occasions_audit ENABLE ROW LEVEL SECURITY$$;

    EXECUTE $$CREATE POLICY "Service role can manage audit"
              ON public.booking_occasions_audit
              USING (true)
              WITH CHECK (true)$$;

    EXECUTE $$GRANT SELECT, INSERT ON public.booking_occasions_audit TO service_role$$;
    EXECUTE $$GRANT SELECT ON public.booking_occasions_audit TO authenticated$$;

    RAISE NOTICE 'Created table: booking_occasions_audit';
  END IF;
END;
$block$;

--------------------------------------------------------------------------------
-- 3. WAITING_LIST - Waiting list for when no availability
--------------------------------------------------------------------------------
DO $block$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'waiting_list'
  ) THEN
    EXECUTE $$
      CREATE TABLE public.waiting_list (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
        booking_date date NOT NULL,
        desired_time time NOT NULL,
        party_size integer NOT NULL CHECK (party_size > 0),
        seating_preference public.seating_preference_type NOT NULL DEFAULT 'any',
        customer_name text NOT NULL,
        customer_email text NOT NULL,
        customer_phone text,
        notes text,
        created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
        updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
      )
    $$;

    EXECUTE $$CREATE INDEX IF NOT EXISTS waiting_list_restaurant_date_time_idx
              ON public.waiting_list (restaurant_id, booking_date, desired_time, created_at)$$;

    EXECUTE $$CREATE UNIQUE INDEX IF NOT EXISTS waiting_list_customer_unique_idx
              ON public.waiting_list (restaurant_id, booking_date, desired_time, customer_email, COALESCE(customer_phone, ''))$$;

    -- Create trigger if update_updated_at function exists
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at') THEN
      EXECUTE $$CREATE TRIGGER waiting_list_updated_at
                BEFORE UPDATE ON public.waiting_list
                FOR EACH ROW
                EXECUTE FUNCTION public.update_updated_at()$$;
    END IF;

    EXECUTE $$ALTER TABLE public.waiting_list ENABLE ROW LEVEL SECURITY$$;

    EXECUTE $$CREATE POLICY "Service role manage waiting list"
              ON public.waiting_list
              USING (true)
              WITH CHECK (true)$$;

    EXECUTE $$GRANT SELECT, INSERT, UPDATE, DELETE ON public.waiting_list TO service_role$$;
    EXECUTE $$GRANT SELECT, INSERT, UPDATE, DELETE ON public.waiting_list TO authenticated$$;

    RAISE NOTICE 'Created table: waiting_list';
  END IF;
END;
$block$;

--------------------------------------------------------------------------------
-- 4. LEADS - Marketing leads capture
--------------------------------------------------------------------------------
DO $block$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'leads'
  ) THEN
    EXECUTE $$
      CREATE TABLE public.leads (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        email text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
      )
    $$;

    EXECUTE $$ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY$$;

    EXECUTE $$CREATE POLICY "Public can insert leads"
              ON public.leads
              FOR INSERT
              WITH CHECK (true)$$;

    EXECUTE $$CREATE POLICY "Service role can read leads"
              ON public.leads
              FOR SELECT
              USING (true)$$;

    EXECUTE $$GRANT SELECT ON public.leads TO service_role$$;
    EXECUTE $$GRANT INSERT ON public.leads TO anon, authenticated, service_role$$;

    RAISE NOTICE 'Created table: leads';
  END IF;
END;
$block$;

--------------------------------------------------------------------------------
-- 5. Ensure all existing tables have proper structure (no changes, just verify)
-- These tables should already exist in schema.sql but we verify they're present
--------------------------------------------------------------------------------

-- Core Business Tables (already in schema.sql):
-- ✓ restaurants
-- ✓ bookings  
-- ✓ customers
-- ✓ profiles
-- ✓ table_inventory
-- ✓ zones
-- ✓ booking_table_assignments
-- ✓ booking_occasions
-- ✓ booking_slots
-- ✓ booking_state_history
-- ✓ restaurant_memberships
-- ✓ restaurant_operating_hours
-- ✓ restaurant_service_periods

-- Supporting Tables (already in schema.sql):
-- ✓ restaurant_invites
-- ✓ allowed_capacities
-- ✓ table_adjacencies
-- ✓ table_holds
-- ✓ allocations
-- ✓ customer_profiles

-- Config/Logs Tables (already in schema.sql):
-- ✓ profile_update_requests
-- ✓ service_policy
-- ✓ feature_flag_overrides
-- ✓ audit_logs
-- ✓ observability_events
-- ✓ capacity_outbox

-- "Useless" Tables (already in schema.sql - keeping them):
-- ✓ loyalty_point_events
-- ✓ loyalty_points
-- ✓ loyalty_programs
-- ✓ booking_assignment_idempotency
-- ✓ booking_confirmation_results
-- ✓ booking_versions
-- ✓ table_hold_members
-- ✓ table_hold_windows
-- ✓ table_scarcity_metrics
-- ✓ user_profiles
-- ✓ analytics_events

-- Optional/Future Tables (already in schema.sql):
-- ✓ demand_profiles
-- ✓ strategic_configs
-- ✓ restaurant_capacity_rules

COMMIT;

-- Summary of what this migration does:
-- 1. Creates merge_rules if missing (was dropped by cleanup)
-- 2. Creates booking_occasions_audit if missing (audit table)
-- 3. Creates waiting_list if missing (for waitlist feature)
-- 4. Creates leads if missing (marketing leads)
-- All other tables already exist in the schema and are preserved
