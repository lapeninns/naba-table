-- Migration: Restore tables removed during database cleanup that are still needed by the application
-- These tables were inadvertently removed but are required for:
-- - analytics_events: Booking event tracking
-- - demand_profiles: Dynamic pricing by day/time
-- - table_scarcity_metrics: Pre-computed scarcity scores
-- - table_hold_members: Junction table for holds→tables
-- - table_hold_windows: Materialized view for fast conflict detection

-- ============================================================================
-- 1. ENUMS (create if not exists)
-- ============================================================================

-- analytics_event_type enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'analytics_event_type') THEN
        CREATE TYPE public.analytics_event_type AS ENUM (
            'booking.created',
            'booking.cancelled',
            'booking.confirmed',
            'booking.completed',
            'booking.no_show',
            'booking.modified'
        );
    END IF;
END$$;

-- ============================================================================
-- 2. TABLES
-- ============================================================================

-- analytics_events table
CREATE TABLE IF NOT EXISTS public.analytics_events (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    event_type public.analytics_event_type NOT NULL,
    schema_version text NOT NULL,
    restaurant_id uuid NOT NULL,
    booking_id uuid NOT NULL,
    customer_id uuid,
    emitted_by text DEFAULT 'server'::text NOT NULL,
    payload jsonb NOT NULL,
    occurred_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT analytics_events_pkey PRIMARY KEY (id)
);

-- demand_profiles table
CREATE TABLE IF NOT EXISTS public.demand_profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    restaurant_id uuid NOT NULL,
    day_of_week smallint NOT NULL,
    service_window text NOT NULL,
    multiplier numeric(3,2) DEFAULT 1.0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    start_minute integer,
    end_minute integer,
    priority integer DEFAULT 1,
    label text,
    CONSTRAINT demand_profiles_pkey PRIMARY KEY (id),
    CONSTRAINT demand_profiles_check CHECK (((end_minute IS NULL) OR (end_minute > start_minute AND end_minute <= 1440))),
    CONSTRAINT demand_profiles_day_of_week_check CHECK (((day_of_week >= 0) AND (day_of_week <= 6))),
    CONSTRAINT demand_profiles_multiplier_check CHECK (((multiplier >= 0.1) AND (multiplier <= 10.0))),
    CONSTRAINT demand_profiles_priority_check CHECK ((priority >= 1)),
    CONSTRAINT demand_profiles_start_minute_check CHECK (((start_minute IS NULL) OR (start_minute >= 0 AND start_minute < 1440)))
);

-- table_scarcity_metrics table
CREATE TABLE IF NOT EXISTS public.table_scarcity_metrics (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    restaurant_id uuid NOT NULL,
    table_type text NOT NULL,
    scarcity_score numeric(5,4) NOT NULL,
    computed_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT table_scarcity_metrics_pkey PRIMARY KEY (id),
    CONSTRAINT table_scarcity_metrics_scarcity_score_check CHECK (((scarcity_score >= (0)::numeric) AND (scarcity_score <= (1)::numeric))),
    CONSTRAINT unique_restaurant_table_type UNIQUE (restaurant_id, table_type)
);

-- table_hold_members table (junction table for holds)
CREATE TABLE IF NOT EXISTS public.table_hold_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    hold_id uuid NOT NULL,
    table_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT table_hold_members_pkey PRIMARY KEY (id),
    CONSTRAINT table_hold_members_hold_id_table_id_key UNIQUE (hold_id, table_id)
);

-- table_hold_windows table (materialized view for fast conflict detection)
CREATE TABLE IF NOT EXISTS public.table_hold_windows (
    hold_id uuid NOT NULL,
    table_id uuid NOT NULL,
    restaurant_id uuid NOT NULL,
    booking_id uuid,
    start_at timestamp with time zone NOT NULL,
    end_at timestamp with time zone NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    hold_window tstzrange GENERATED ALWAYS AS (tstzrange(start_at, end_at, '[)'::text)) STORED,
    CONSTRAINT table_hold_windows_pkey PRIMARY KEY (hold_id, table_id)
);

-- ============================================================================
-- 3. INDEXES
-- ============================================================================

-- analytics_events indexes
CREATE INDEX IF NOT EXISTS idx_analytics_events_restaurant_id ON public.analytics_events USING btree (restaurant_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_booking_id ON public.analytics_events USING btree (booking_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_event_type ON public.analytics_events USING btree (event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_events_occurred_at ON public.analytics_events USING btree (occurred_at);

-- demand_profiles indexes
CREATE INDEX IF NOT EXISTS idx_demand_profiles_restaurant_day_window ON public.demand_profiles USING btree (restaurant_id, day_of_week, service_window);
CREATE INDEX IF NOT EXISTS idx_demand_profiles_updated_at ON public.demand_profiles USING btree (updated_at);

-- table_scarcity_metrics indexes
CREATE INDEX IF NOT EXISTS idx_table_scarcity_metrics_computed_at ON public.table_scarcity_metrics USING btree (computed_at);
CREATE INDEX IF NOT EXISTS idx_table_scarcity_metrics_restaurant_type ON public.table_scarcity_metrics USING btree (restaurant_id, table_type);

-- table_hold_members indexes
CREATE INDEX IF NOT EXISTS table_hold_members_table_idx ON public.table_hold_members USING btree (table_id);

-- table_hold_windows indexes
CREATE INDEX IF NOT EXISTS table_hold_windows_restaurant_idx ON public.table_hold_windows USING btree (restaurant_id);

-- ============================================================================
-- 4. FOREIGN KEYS
-- ============================================================================

-- analytics_events foreign keys
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'analytics_events_restaurant_id_fkey') THEN
        ALTER TABLE public.analytics_events
            ADD CONSTRAINT analytics_events_restaurant_id_fkey
            FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'analytics_events_booking_id_fkey') THEN
        ALTER TABLE public.analytics_events
            ADD CONSTRAINT analytics_events_booking_id_fkey
            FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE CASCADE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'analytics_events_customer_id_fkey') THEN
        ALTER TABLE public.analytics_events
            ADD CONSTRAINT analytics_events_customer_id_fkey
            FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;
    END IF;
END$$;

-- demand_profiles foreign keys
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'demand_profiles_restaurant_id_fkey') THEN
        ALTER TABLE public.demand_profiles
            ADD CONSTRAINT demand_profiles_restaurant_id_fkey
            FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;
    END IF;
END$$;

-- table_scarcity_metrics foreign keys
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'table_scarcity_metrics_restaurant_id_fkey') THEN
        ALTER TABLE public.table_scarcity_metrics
            ADD CONSTRAINT table_scarcity_metrics_restaurant_id_fkey
            FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;
    END IF;
END$$;

-- table_hold_members foreign keys
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'table_hold_members_hold_id_fkey') THEN
        ALTER TABLE public.table_hold_members
            ADD CONSTRAINT table_hold_members_hold_id_fkey
            FOREIGN KEY (hold_id) REFERENCES public.table_holds(id) ON DELETE CASCADE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'table_hold_members_table_id_fkey') THEN
        ALTER TABLE public.table_hold_members
            ADD CONSTRAINT table_hold_members_table_id_fkey
            FOREIGN KEY (table_id) REFERENCES public.table_inventory(id) ON DELETE CASCADE;
    END IF;
END$$;

-- table_hold_windows foreign keys
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'table_hold_windows_hold_id_fkey') THEN
        ALTER TABLE public.table_hold_windows
            ADD CONSTRAINT table_hold_windows_hold_id_fkey
            FOREIGN KEY (hold_id) REFERENCES public.table_holds(id) ON DELETE CASCADE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'table_hold_windows_table_id_fkey') THEN
        ALTER TABLE public.table_hold_windows
            ADD CONSTRAINT table_hold_windows_table_id_fkey
            FOREIGN KEY (table_id) REFERENCES public.table_inventory(id) ON DELETE CASCADE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'table_hold_windows_restaurant_id_fkey') THEN
        ALTER TABLE public.table_hold_windows
            ADD CONSTRAINT table_hold_windows_restaurant_id_fkey
            FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;
    END IF;
END$$;

-- ============================================================================
-- 5. EXCLUSION CONSTRAINT FOR HOLD WINDOWS (prevents overlapping holds)
-- ============================================================================

-- First ensure btree_gist extension is enabled
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Add exclusion constraint for non-overlapping holds on same table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'table_hold_windows_no_overlap') THEN
        ALTER TABLE public.table_hold_windows
            ADD CONSTRAINT table_hold_windows_no_overlap
            EXCLUDE USING gist (table_id WITH =, hold_window WITH &&);
    END IF;
END$$;

-- ============================================================================
-- 6. RLS POLICIES
-- ============================================================================

-- Enable RLS on new tables
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.demand_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.table_scarcity_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.table_hold_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.table_hold_windows ENABLE ROW LEVEL SECURITY;

-- analytics_events policies
DROP POLICY IF EXISTS "Service role full access to analytics_events" ON public.analytics_events;
CREATE POLICY "Service role full access to analytics_events" ON public.analytics_events
    FOR ALL USING (true) WITH CHECK (true);

-- demand_profiles policies
DROP POLICY IF EXISTS "Owners and managers can manage demand profiles" ON public.demand_profiles;
CREATE POLICY "Owners and managers can manage demand profiles" ON public.demand_profiles
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.restaurant_memberships rm
            WHERE rm.restaurant_id = demand_profiles.restaurant_id
              AND rm.user_id = auth.uid()
              AND rm.role IN ('owner', 'manager', 'admin')
        )
    );

-- table_scarcity_metrics policies
DROP POLICY IF EXISTS "Owners and managers can manage scarcity metrics" ON public.table_scarcity_metrics;
CREATE POLICY "Owners and managers can manage scarcity metrics" ON public.table_scarcity_metrics
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.restaurant_memberships rm
            WHERE rm.restaurant_id = table_scarcity_metrics.restaurant_id
              AND rm.user_id = auth.uid()
              AND rm.role IN ('owner', 'manager', 'admin')
        )
    );

-- table_hold_members policies (inherits from table_holds access)
DROP POLICY IF EXISTS "Service role full access to table_hold_members" ON public.table_hold_members;
CREATE POLICY "Service role full access to table_hold_members" ON public.table_hold_members
    FOR ALL USING (true) WITH CHECK (true);

-- table_hold_windows policies
DROP POLICY IF EXISTS "Service role full access to table_hold_windows" ON public.table_hold_windows;
CREATE POLICY "Service role full access to table_hold_windows" ON public.table_hold_windows
    FOR ALL USING (true) WITH CHECK (true);

-- ============================================================================
-- 7. TRIGGERS FOR SYNCING table_hold_windows
-- ============================================================================

-- Function to sync table_hold_windows when table_hold_members changes
CREATE OR REPLACE FUNCTION public.sync_table_hold_windows()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  hold_row RECORD;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.table_hold_windows
    WHERE hold_id = OLD.hold_id AND table_id = OLD.table_id;
    RETURN OLD;
  END IF;

  -- For INSERT, get the parent hold details
  SELECT id, restaurant_id, booking_id, start_at, end_at, expires_at
  INTO hold_row
  FROM public.table_holds
  WHERE id = NEW.hold_id;

  IF hold_row IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.table_hold_windows (hold_id, table_id, restaurant_id, booking_id, start_at, end_at, expires_at)
  VALUES (
    NEW.hold_id,
    NEW.table_id,
    hold_row.restaurant_id,
    hold_row.booking_id,
    hold_row.start_at,
    hold_row.end_at,
    hold_row.expires_at
  )
  ON CONFLICT (hold_id, table_id) DO UPDATE SET
    restaurant_id = EXCLUDED.restaurant_id,
    booking_id = EXCLUDED.booking_id,
    start_at = EXCLUDED.start_at,
    end_at = EXCLUDED.end_at,
    expires_at = EXCLUDED.expires_at;

  RETURN NEW;
END;
$$;

-- Function to update table_hold_windows when table_holds changes
CREATE OR REPLACE FUNCTION public.update_table_hold_windows()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.table_hold_windows
  SET
    restaurant_id = NEW.restaurant_id,
    booking_id = NEW.booking_id,
    start_at = NEW.start_at,
    end_at = NEW.end_at,
    expires_at = NEW.expires_at
  WHERE hold_id = NEW.id;
  RETURN NEW;
END;
$$;

-- Create triggers
DROP TRIGGER IF EXISTS table_hold_members_sync_insert ON public.table_hold_members;
CREATE TRIGGER table_hold_members_sync_insert
    AFTER INSERT ON public.table_hold_members
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_table_hold_windows();

DROP TRIGGER IF EXISTS table_hold_members_sync_delete ON public.table_hold_members;
CREATE TRIGGER table_hold_members_sync_delete
    AFTER DELETE ON public.table_hold_members
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_table_hold_windows();

DROP TRIGGER IF EXISTS table_holds_sync_windows ON public.table_holds;
CREATE TRIGGER table_holds_sync_windows
    AFTER UPDATE ON public.table_holds
    FOR EACH ROW
    EXECUTE FUNCTION public.update_table_hold_windows();

-- ============================================================================
-- 8. UPDATE TIMESTAMP TRIGGERS
-- ============================================================================

-- Trigger for demand_profiles updated_at
DROP TRIGGER IF EXISTS update_demand_profiles_updated_at ON public.demand_profiles;
CREATE TRIGGER update_demand_profiles_updated_at
    BEFORE UPDATE ON public.demand_profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- DONE
-- ============================================================================

COMMENT ON TABLE public.analytics_events IS 'Tracks booking-related analytics events for reporting and metrics.';
COMMENT ON TABLE public.demand_profiles IS 'Configures dynamic pricing multipliers by day of week and service window.';
COMMENT ON TABLE public.table_scarcity_metrics IS 'Pre-computed scarcity scores for table types to optimize assignment.';
COMMENT ON TABLE public.table_hold_members IS 'Junction table linking table holds to specific tables.';
COMMENT ON TABLE public.table_hold_windows IS 'Denormalized view for fast conflict detection on table holds.';
