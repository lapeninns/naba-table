-- Migration: Restore remaining tables removed during database cleanup
-- These tables are actively used by the application

-- ============================================================================
-- 1. ENUMS (create if not exists)
-- ============================================================================

-- booking_change_type enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'booking_change_type') THEN
        CREATE TYPE public.booking_change_type AS ENUM (
            'created',
            'updated',
            'cancelled',
            'confirmed',
            'seated',
            'completed',
            'no_show',
            'table_assigned',
            'table_unassigned'
        );
    END IF;
END$$;

-- ============================================================================
-- 2. TABLES
-- ============================================================================

-- booking_assignment_idempotency table (critical for table assignment)
CREATE TABLE IF NOT EXISTS public.booking_assignment_idempotency (
    booking_id uuid NOT NULL,
    idempotency_key text NOT NULL,
    table_ids uuid[] NOT NULL,
    assignment_window tstzrange NOT NULL,
    merge_group_allocation_id uuid,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    table_set_hash text,
    CONSTRAINT booking_assignment_idempotency_pkey PRIMARY KEY (booking_id, idempotency_key)
);

COMMENT ON TABLE public.booking_assignment_idempotency IS 'Tracks idempotent table assignments to prevent duplicate allocations.';
COMMENT ON COLUMN public.booking_assignment_idempotency.table_set_hash IS 'MD5 hash of sorted table ids used to dedupe idempotency payloads.';

-- booking_versions table (audit trail for booking changes)
CREATE TABLE IF NOT EXISTS public.booking_versions (
    version_id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    booking_id uuid NOT NULL,
    restaurant_id uuid NOT NULL,
    change_type public.booking_change_type NOT NULL,
    changed_by text,
    changed_at timestamp with time zone DEFAULT now() NOT NULL,
    old_data jsonb,
    new_data jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT booking_versions_pkey PRIMARY KEY (version_id)
);

COMMENT ON TABLE public.booking_versions IS 'Audit trail for booking changes with before/after snapshots.';

-- user_profiles table (global customer identity)
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id uuid NOT NULL,
    name text,
    email public.citext,
    phone text,
    marketing_opt_in boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT user_profiles_pkey PRIMARY KEY (id),
    CONSTRAINT user_profiles_phone_e164_check CHECK (((phone IS NULL) OR (phone ~ '^\+[1-9]\d{1,14}$'::text)))
);

COMMENT ON TABLE public.user_profiles IS 'Global customer identity (1:1 with auth.users).';
COMMENT ON COLUMN public.user_profiles.phone IS 'User phone number stored in E.164 format (leading + and digits only).';

-- waiting_list table
CREATE TABLE IF NOT EXISTS public.waiting_list (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    restaurant_id uuid NOT NULL,
    booking_date date NOT NULL,
    desired_time time without time zone NOT NULL,
    party_size integer NOT NULL,
    seating_preference public.seating_preference_type DEFAULT 'any'::public.seating_preference_type NOT NULL,
    customer_name text NOT NULL,
    customer_email text NOT NULL,
    customer_phone text,
    notes text,
    status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT waiting_list_pkey PRIMARY KEY (id),
    CONSTRAINT waiting_list_party_size_check CHECK ((party_size > 0))
);

COMMENT ON TABLE public.waiting_list IS 'Customers waiting for availability on fully booked dates/times.';

-- leads table (marketing leads)
CREATE TABLE IF NOT EXISTS public.leads (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT leads_pkey PRIMARY KEY (id),
    CONSTRAINT leads_email_key UNIQUE (email)
);

COMMENT ON TABLE public.leads IS 'Marketing email leads for newsletter signups.';

-- strategic_configs table (strategic planner configuration)
CREATE TABLE IF NOT EXISTS public.strategic_configs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    restaurant_id uuid NOT NULL,
    config_key text NOT NULL,
    config_value jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT strategic_configs_pkey PRIMARY KEY (id),
    CONSTRAINT strategic_configs_restaurant_key_unique UNIQUE (restaurant_id, config_key)
);

COMMENT ON TABLE public.strategic_configs IS 'Restaurant-specific strategic planner configuration.';

-- feature_flag_overrides table
CREATE TABLE IF NOT EXISTS public.feature_flag_overrides (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    flag text NOT NULL,
    environment text NOT NULL,
    value boolean NOT NULL,
    notes jsonb,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_by uuid,
    CONSTRAINT feature_flag_overrides_pkey PRIMARY KEY (id),
    CONSTRAINT feature_flag_overrides_flag_env_unique UNIQUE (flag, environment)
);

COMMENT ON TABLE public.feature_flag_overrides IS 'Runtime feature flag overrides per environment.';

-- ============================================================================
-- 3. INDEXES
-- ============================================================================

-- booking_assignment_idempotency indexes
CREATE INDEX IF NOT EXISTS idx_booking_assignment_idempotency_booking ON public.booking_assignment_idempotency USING btree (booking_id);
CREATE INDEX IF NOT EXISTS idx_booking_assignment_idempotency_created ON public.booking_assignment_idempotency USING btree (created_at);

-- booking_versions indexes
CREATE INDEX IF NOT EXISTS idx_booking_versions_booking_id ON public.booking_versions USING btree (booking_id);
CREATE INDEX IF NOT EXISTS idx_booking_versions_restaurant_id ON public.booking_versions USING btree (restaurant_id);
CREATE INDEX IF NOT EXISTS idx_booking_versions_changed_at ON public.booking_versions USING btree (changed_at);

-- user_profiles indexes
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON public.user_profiles USING btree (email);

-- waiting_list indexes
CREATE INDEX IF NOT EXISTS idx_waiting_list_restaurant_date ON public.waiting_list USING btree (restaurant_id, booking_date);
CREATE INDEX IF NOT EXISTS idx_waiting_list_status ON public.waiting_list USING btree (status);

-- strategic_configs indexes
CREATE INDEX IF NOT EXISTS idx_strategic_configs_restaurant ON public.strategic_configs USING btree (restaurant_id);

-- ============================================================================
-- 4. FOREIGN KEYS
-- ============================================================================

-- booking_assignment_idempotency foreign keys
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'booking_assignment_idempotency_booking_id_fkey') THEN
        ALTER TABLE public.booking_assignment_idempotency
            ADD CONSTRAINT booking_assignment_idempotency_booking_id_fkey
            FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE CASCADE;
    END IF;
END$$;

-- booking_versions foreign keys
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'booking_versions_booking_id_fkey') THEN
        ALTER TABLE public.booking_versions
            ADD CONSTRAINT booking_versions_booking_id_fkey
            FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE CASCADE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'booking_versions_restaurant_id_fkey') THEN
        ALTER TABLE public.booking_versions
            ADD CONSTRAINT booking_versions_restaurant_id_fkey
            FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;
    END IF;
END$$;

-- user_profiles foreign keys (links to auth.users)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_profiles_id_fkey') THEN
        ALTER TABLE public.user_profiles
            ADD CONSTRAINT user_profiles_id_fkey
            FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;
END$$;

-- waiting_list foreign keys
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'waiting_list_restaurant_id_fkey') THEN
        ALTER TABLE public.waiting_list
            ADD CONSTRAINT waiting_list_restaurant_id_fkey
            FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;
    END IF;
END$$;

-- strategic_configs foreign keys
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'strategic_configs_restaurant_id_fkey') THEN
        ALTER TABLE public.strategic_configs
            ADD CONSTRAINT strategic_configs_restaurant_id_fkey
            FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;
    END IF;
END$$;

-- ============================================================================
-- 5. RLS POLICIES
-- ============================================================================

-- Enable RLS
ALTER TABLE public.booking_assignment_idempotency ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waiting_list ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.strategic_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_flag_overrides ENABLE ROW LEVEL SECURITY;

-- booking_assignment_idempotency policies
DROP POLICY IF EXISTS "Service role full access to booking_assignment_idempotency" ON public.booking_assignment_idempotency;
CREATE POLICY "Service role full access to booking_assignment_idempotency" ON public.booking_assignment_idempotency
    FOR ALL USING (true) WITH CHECK (true);

-- booking_versions policies
DROP POLICY IF EXISTS "Restaurant members can view booking versions" ON public.booking_versions;
CREATE POLICY "Restaurant members can view booking versions" ON public.booking_versions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.restaurant_memberships rm
            WHERE rm.restaurant_id = booking_versions.restaurant_id
              AND rm.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Service role full access to booking_versions" ON public.booking_versions;
CREATE POLICY "Service role full access to booking_versions" ON public.booking_versions
    FOR ALL USING (true) WITH CHECK (true);

-- user_profiles policies
DROP POLICY IF EXISTS "Users can view own profile" ON public.user_profiles;
CREATE POLICY "Users can view own profile" ON public.user_profiles
    FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;
CREATE POLICY "Users can update own profile" ON public.user_profiles
    FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Service role full access to user_profiles" ON public.user_profiles;
CREATE POLICY "Service role full access to user_profiles" ON public.user_profiles
    FOR ALL USING (true) WITH CHECK (true);

-- waiting_list policies
DROP POLICY IF EXISTS "Restaurant members can manage waiting list" ON public.waiting_list;
CREATE POLICY "Restaurant members can manage waiting list" ON public.waiting_list
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.restaurant_memberships rm
            WHERE rm.restaurant_id = waiting_list.restaurant_id
              AND rm.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Service role full access to waiting_list" ON public.waiting_list;
CREATE POLICY "Service role full access to waiting_list" ON public.waiting_list
    FOR ALL USING (true) WITH CHECK (true);

-- leads policies
DROP POLICY IF EXISTS "Service role full access to leads" ON public.leads;
CREATE POLICY "Service role full access to leads" ON public.leads
    FOR ALL USING (true) WITH CHECK (true);

-- strategic_configs policies
DROP POLICY IF EXISTS "Restaurant owners can manage strategic configs" ON public.strategic_configs;
CREATE POLICY "Restaurant owners can manage strategic configs" ON public.strategic_configs
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.restaurant_memberships rm
            WHERE rm.restaurant_id = strategic_configs.restaurant_id
              AND rm.user_id = auth.uid()
              AND rm.role IN ('owner', 'admin')
        )
    );

DROP POLICY IF EXISTS "Service role full access to strategic_configs" ON public.strategic_configs;
CREATE POLICY "Service role full access to strategic_configs" ON public.strategic_configs
    FOR ALL USING (true) WITH CHECK (true);

-- feature_flag_overrides policies
DROP POLICY IF EXISTS "Service role full access to feature_flag_overrides" ON public.feature_flag_overrides;
CREATE POLICY "Service role full access to feature_flag_overrides" ON public.feature_flag_overrides
    FOR ALL USING (true) WITH CHECK (true);

-- ============================================================================
-- 6. TRIGGERS
-- ============================================================================

-- Updated_at trigger for waiting_list
DROP TRIGGER IF EXISTS update_waiting_list_updated_at ON public.waiting_list;
CREATE TRIGGER update_waiting_list_updated_at
    BEFORE UPDATE ON public.waiting_list
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Updated_at trigger for user_profiles
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON public.user_profiles;
CREATE TRIGGER update_user_profiles_updated_at
    BEFORE UPDATE ON public.user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Updated_at trigger for strategic_configs
DROP TRIGGER IF EXISTS update_strategic_configs_updated_at ON public.strategic_configs;
CREATE TRIGGER update_strategic_configs_updated_at
    BEFORE UPDATE ON public.strategic_configs
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- DONE
-- ============================================================================
