-- Migration: Restore restaurant_capacity_rules for booking capacity checks
-- Purpose: Add capacity override rules for restaurants/service periods/days with optional scoping.

BEGIN;

CREATE TABLE IF NOT EXISTS public.restaurant_capacity_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL,
  service_period_id uuid,
  day_of_week smallint,
  effective_date date,
  max_covers integer,
  max_parties integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'restaurant_capacity_rules_restaurant_id_fkey'
  ) THEN
    ALTER TABLE public.restaurant_capacity_rules
      ADD CONSTRAINT restaurant_capacity_rules_restaurant_id_fkey
      FOREIGN KEY (restaurant_id)
      REFERENCES public.restaurants(id)
      ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'restaurant_capacity_rules_service_period_id_fkey'
  ) THEN
    ALTER TABLE public.restaurant_capacity_rules
      ADD CONSTRAINT restaurant_capacity_rules_service_period_id_fkey
      FOREIGN KEY (service_period_id)
      REFERENCES public.restaurant_service_periods(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS restaurant_capacity_rules_lookup_idx
  ON public.restaurant_capacity_rules (
    restaurant_id,
    service_period_id,
    day_of_week,
    effective_date
  );

ALTER TABLE public.restaurant_capacity_rules ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'restaurant_capacity_rules_updated_at'
  ) THEN
    CREATE TRIGGER restaurant_capacity_rules_updated_at
      BEFORE UPDATE ON public.restaurant_capacity_rules
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at();
  END IF;
END $$;

COMMENT ON TABLE public.restaurant_capacity_rules IS
  'Capacity override rules scoped by restaurant, optional service period/day/date.';

COMMENT ON COLUMN public.restaurant_capacity_rules.id IS
  'Primary key for capacity rule.';
COMMENT ON COLUMN public.restaurant_capacity_rules.restaurant_id IS
  'Restaurant this capacity rule applies to.';
COMMENT ON COLUMN public.restaurant_capacity_rules.service_period_id IS
  'Optional service period override; null means all periods.';
COMMENT ON COLUMN public.restaurant_capacity_rules.day_of_week IS
  'Optional day-of-week override (0=Sunday..6=Saturday); null means all days.';
COMMENT ON COLUMN public.restaurant_capacity_rules.effective_date IS
  'Optional effective date; null means always active.';
COMMENT ON COLUMN public.restaurant_capacity_rules.max_covers IS
  'Maximum total covers for the rule scope.';
COMMENT ON COLUMN public.restaurant_capacity_rules.max_parties IS
  'Maximum total parties for the rule scope.';
COMMENT ON COLUMN public.restaurant_capacity_rules.created_at IS
  'Creation timestamp.';
COMMENT ON COLUMN public.restaurant_capacity_rules.updated_at IS
  'Last update timestamp.';

GRANT ALL ON TABLE public.restaurant_capacity_rules TO authenticated;
GRANT ALL ON TABLE public.restaurant_capacity_rules TO service_role;

COMMIT;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
