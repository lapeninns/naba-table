-- Migration: Restore restaurant_capacity_rules for capacity enforcement
-- Description: Recreate capacity rules table, enum, policies, and trigger for booking RPCs
-- Task: fix-capacity-rules-20260120-1016
-- Author: AI Assistant
-- Date: 2026-01-20

BEGIN;

-- Ensure enum exists for override_type
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'capacity_override_type'
      AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.capacity_override_type AS ENUM (
      'holiday',
      'event',
      'manual',
      'emergency'
    );
  END IF;
END$$;

-- Restore capacity rules table
CREATE TABLE IF NOT EXISTS public.restaurant_capacity_rules (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4() NOT NULL,
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  service_period_id uuid REFERENCES public.restaurant_service_periods(id) ON DELETE CASCADE,
  day_of_week smallint,
  effective_date date,
  max_covers integer,
  max_parties integer,
  notes text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  label text,
  override_type public.capacity_override_type,
  CONSTRAINT restaurant_capacity_rules_non_negative CHECK (
    ((max_covers IS NULL) OR (max_covers >= 0))
    AND ((max_parties IS NULL) OR (max_parties >= 0))
  ),
  CONSTRAINT restaurant_capacity_rules_scope CHECK (
    (service_period_id IS NOT NULL)
    OR (day_of_week IS NOT NULL)
    OR (effective_date IS NOT NULL)
  )
);

ALTER TABLE public.restaurant_capacity_rules OWNER TO postgres;

COMMENT ON COLUMN public.restaurant_capacity_rules.label
  IS 'Human-friendly name for this capacity rule or override (e.g., “Christmas Eve Dinner”).';
COMMENT ON COLUMN public.restaurant_capacity_rules.override_type
  IS 'Categorizes overrides (holiday, event, manual adjustments, emergencies).';

CREATE INDEX IF NOT EXISTS idx_restaurant_capacity_rules_scope
  ON public.restaurant_capacity_rules (
    restaurant_id,
    COALESCE(day_of_week::integer, -1),
    effective_date
  );

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'restaurant_capacity_rules_updated_at'
      AND tgrelid = 'public.restaurant_capacity_rules'::regclass
  ) THEN
    CREATE TRIGGER restaurant_capacity_rules_updated_at
      BEFORE UPDATE ON public.restaurant_capacity_rules
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at();
  END IF;
END$$;

-- RLS policies
ALTER TABLE public.restaurant_capacity_rules ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'restaurant_capacity_rules'
      AND policyname = 'Service role can manage capacity rules'
  ) THEN
    EXECUTE 'CREATE POLICY "Service role can manage capacity rules" ON public.restaurant_capacity_rules TO service_role USING (true) WITH CHECK (true)';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'restaurant_capacity_rules'
      AND policyname = 'Staff can manage capacity rules'
  ) THEN
    EXECUTE 'CREATE POLICY "Staff can manage capacity rules" ON public.restaurant_capacity_rules USING ((restaurant_id IN ( SELECT public.user_restaurants() AS user_restaurants))) WITH CHECK ((restaurant_id IN ( SELECT public.user_restaurants() AS user_restaurants)))';
  END IF;
END$$;

GRANT SELECT, INSERT, DELETE, UPDATE ON TABLE public.restaurant_capacity_rules TO service_role;
GRANT SELECT, INSERT, DELETE, UPDATE ON TABLE public.restaurant_capacity_rules TO authenticated;

COMMIT;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
