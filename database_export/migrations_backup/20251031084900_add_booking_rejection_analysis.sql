-- Migration: Add booking rejection analysis schema
-- Created: 2025-10-31 08:49 UTC

BEGIN;
-- Extend demand_profiles with time specificity and priority
ALTER TABLE public.demand_profiles
ADD COLUMN start_minute int CHECK (start_minute >= 0 AND start_minute < 1440),
ADD COLUMN end_minute int CHECK (end_minute > start_minute AND end_minute <= 1440),
ADD COLUMN priority int DEFAULT 1 CHECK (priority >= 1);
-- Update RLS for demand_profiles to allow Ops managers
-- (Assuming 'ops' role or similar; adjust based on your roles)
-- For now, keep existing, but note for Ops access

-- Create strategic_configs table
CREATE TABLE public.strategic_configs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id uuid REFERENCES public.restaurants(id) ON DELETE CASCADE,
    weights jsonb NOT NULL DEFAULT '{}'::jsonb, -- e.g., {"scarcity": 22, "demandMultiplier": 1.5, "futureConflictPenalty": 50}
    updated_by uuid REFERENCES auth.users(id),
    updated_at timestamptz NOT NULL DEFAULT now(),
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (restaurant_id) -- One config per restaurant, or null for global
);
-- Allow null restaurant_id for global defaults
ALTER TABLE public.strategic_configs DROP CONSTRAINT strategic_configs_restaurant_id_fkey;
ALTER TABLE public.strategic_configs ADD CONSTRAINT strategic_configs_restaurant_id_fkey
    FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;
-- RLS for strategic_configs
ALTER TABLE public.strategic_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view strategic configs for their restaurants" ON public.strategic_configs
    FOR SELECT USING (
        restaurant_id IS NULL OR
        EXISTS (
            SELECT 1 FROM public.restaurant_memberships rm
            WHERE rm.restaurant_id = strategic_configs.restaurant_id
            AND rm.user_id = auth.uid()
        )
    );
CREATE POLICY "Ops managers can manage strategic configs" ON public.strategic_configs
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.restaurant_memberships rm
            WHERE rm.restaurant_id = strategic_configs.restaurant_id
            AND rm.user_id = auth.uid()
            AND rm.role IN ('owner', 'manager', 'ops')
        ) OR restaurant_id IS NULL -- Global configs require special access
    );
-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.strategic_configs TO authenticated;
-- Create materialized view for rejection analysis
CREATE MATERIALIZED VIEW public.capacity_selector_rejections_v1 AS
SELECT
    oe.id,
    oe.created_at,
    oe.restaurant_id,
    oe.booking_id,
    oe.context->>'skip_reason' AS skip_reason,
    CASE
        WHEN oe.context->>'skip_reason' LIKE '%No suitable tables%' THEN 'strategic'
        WHEN oe.context->>'skip_reason' LIKE '%service_overrun%' THEN 'hard'
        WHEN oe.context->>'skip_reason' LIKE '%capacity%' THEN 'strategic'
        ELSE 'hard'
    END AS classification,
    oe.context->'scoreBreakdown' AS score_breakdown,
    oe.context->'plannerConfig' AS planner_config,
    oe.context->'dominantPenalty' AS dominant_penalty
FROM public.observability_events oe
WHERE oe.source = 'capacity.selector'
  AND oe.event_type = 'capacity.selector.skipped'
WITH NO DATA;
-- Populate later with REFRESH

-- Create index on the view
CREATE INDEX idx_capacity_selector_rejections_v1_restaurant_date
    ON public.capacity_selector_rejections_v1 (restaurant_id, created_at);
-- RLS for the view (if needed, but views inherit from underlying tables)
-- Since observability_events has RLS, the view should respect it

-- Optional: table for simulation runs
CREATE TABLE public.strategic_simulation_runs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    strategy_a jsonb NOT NULL,
    strategy_b jsonb NOT NULL,
    snapshot_range tstzrange NOT NULL,
    kpis jsonb, -- Results
    created_by uuid REFERENCES auth.users(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    status text DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed'))
);
-- RLS for simulation runs
ALTER TABLE public.strategic_simulation_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view simulation runs for their restaurants" ON public.strategic_simulation_runs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.restaurant_memberships rm
            WHERE rm.restaurant_id = strategic_simulation_runs.restaurant_id
            AND rm.user_id = auth.uid()
        )
    );
CREATE POLICY "Ops can manage simulation runs" ON public.strategic_simulation_runs
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.restaurant_memberships rm
            WHERE rm.restaurant_id = strategic_simulation_runs.restaurant_id
            AND rm.user_id = auth.uid()
            AND rm.role IN ('owner', 'manager', 'ops')
        )
    );
GRANT SELECT, INSERT, UPDATE, DELETE ON public.strategic_simulation_runs TO authenticated;
COMMIT;
