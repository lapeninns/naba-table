-- Migration: Add demand profiles and table scarcity metrics for yield management
-- Created: 2025-10-30 14:23 UTC

BEGIN;

-- Create the update_updated_at_column function if it doesn't exist
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create demand_profiles table
CREATE TABLE public.demand_profiles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    day_of_week smallint NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sunday, 6=Saturday
    service_window text NOT NULL CHECK (service_window IN ('lunch', 'drinks', 'dinner', 'christmas_party', 'curry_and_carols')),
    multiplier numeric(3,2) NOT NULL DEFAULT 1.0 CHECK (multiplier >= 0.1 AND multiplier <= 10.0),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for demand_profiles
CREATE INDEX idx_demand_profiles_restaurant_day_window ON public.demand_profiles(restaurant_id, day_of_week, service_window);
CREATE INDEX idx_demand_profiles_updated_at ON public.demand_profiles(updated_at);

-- RLS for demand_profiles
ALTER TABLE public.demand_profiles ENABLE ROW LEVEL SECURITY;

-- Policy: Allow authenticated users to read demand profiles for their restaurants
CREATE POLICY "Users can view demand profiles for their restaurants" ON public.demand_profiles
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.restaurant_memberships rm
            WHERE rm.restaurant_id = demand_profiles.restaurant_id
            AND rm.user_id = auth.uid()
        )
    );

-- Policy: Allow owners/managers to manage demand profiles
CREATE POLICY "Owners and managers can manage demand profiles" ON public.demand_profiles
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.restaurant_memberships rm
            WHERE rm.restaurant_id = demand_profiles.restaurant_id
            AND rm.user_id = auth.uid()
            AND rm.role IN ('owner', 'manager')
        )
    );

-- Create table_scarcity_metrics table
CREATE TABLE public.table_scarcity_metrics (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    table_type text NOT NULL, -- e.g., '2-seater', 'booth', 'patio', 'private'
    scarcity_score numeric(5,4) NOT NULL CHECK (scarcity_score >= 0 AND scarcity_score <= 1),
    computed_at timestamptz NOT NULL DEFAULT now()
);

-- Unique constraint on restaurant_id + table_type
ALTER TABLE public.table_scarcity_metrics ADD CONSTRAINT unique_restaurant_table_type UNIQUE (restaurant_id, table_type);

-- Indexes for table_scarcity_metrics
CREATE INDEX idx_table_scarcity_metrics_restaurant_type ON public.table_scarcity_metrics(restaurant_id, table_type);
CREATE INDEX idx_table_scarcity_metrics_computed_at ON public.table_scarcity_metrics(computed_at);

-- RLS for table_scarcity_metrics
ALTER TABLE public.table_scarcity_metrics ENABLE ROW LEVEL SECURITY;

-- Policy: Allow authenticated users to read scarcity metrics for their restaurants
CREATE POLICY "Users can view scarcity metrics for their restaurants" ON public.table_scarcity_metrics
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.restaurant_memberships rm
            WHERE rm.restaurant_id = table_scarcity_metrics.restaurant_id
            AND rm.user_id = auth.uid()
        )
    );

-- Policy: Allow owners/managers to manage scarcity metrics
CREATE POLICY "Owners and managers can manage scarcity metrics" ON public.table_scarcity_metrics
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.restaurant_memberships rm
            WHERE rm.restaurant_id = table_scarcity_metrics.restaurant_id
            AND rm.user_id = auth.uid()
            AND rm.role IN ('owner', 'manager')
        )
    );

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.demand_profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.table_scarcity_metrics TO authenticated;

-- Update updated_at trigger for demand_profiles
CREATE TRIGGER update_demand_profiles_updated_at
    BEFORE UPDATE ON public.demand_profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

COMMIT;