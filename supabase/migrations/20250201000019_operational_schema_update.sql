-- Operational schema update: drop table assignment & waitlist artifacts, add operating primitives

-- Normalize historical analytics events before removing enum values
UPDATE public.analytics_events
SET event_type = 'booking.created'
WHERE event_type = 'booking.waitlisted';

-- Note: PostgreSQL doesn't support dropping enum values
-- The old 'booking.waitlisted' value will remain in the enum type definition
-- but is no longer used in the data

-- Drop waitlist tracking column from customer profiles
ALTER TABLE public.customer_profiles
  DROP COLUMN IF EXISTS last_waitlist_at;

-- Remove booking table references from bookings table
ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS bookings_table_id_fkey;

ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS no_overlap_per_table;

DROP INDEX IF EXISTS idx_bookings_table;

ALTER TABLE public.bookings
  DROP COLUMN IF EXISTS table_id;

-- Clean up restaurant table artifacts
DROP TRIGGER IF EXISTS restaurant_tables_updated_at ON public.restaurant_tables;

DROP POLICY IF EXISTS "Admins and owners can manage tables" ON public.restaurant_tables;
DROP POLICY IF EXISTS "Staff can view tables" ON public.restaurant_tables;
DROP POLICY IF EXISTS "Service role can manage tables" ON public.restaurant_tables;

DROP TABLE IF EXISTS public.restaurant_tables CASCADE;

-- Drop waitlist table
DROP TABLE IF EXISTS public.waiting_list CASCADE;

-- ---------------------------------------------------------------------------
-- Operating hours & capacity primitives
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.restaurant_operating_hours (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  day_of_week smallint,
  effective_date date,
  opens_at time without time zone,
  closes_at time without time zone,
  is_closed boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT restaurant_operating_hours_scope
    CHECK (day_of_week IS NOT NULL OR effective_date IS NOT NULL),
  CONSTRAINT restaurant_operating_hours_time_order
    CHECK (is_closed OR (opens_at IS NOT NULL AND closes_at IS NOT NULL AND opens_at < closes_at))
);

CREATE INDEX IF NOT EXISTS idx_restaurant_operating_hours_scope
  ON public.restaurant_operating_hours(restaurant_id, COALESCE(day_of_week, -1), effective_date);

CREATE TABLE IF NOT EXISTS public.restaurant_service_periods (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name text NOT NULL,
  day_of_week smallint,
  start_time time without time zone NOT NULL,
  end_time time without time zone NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT restaurant_service_periods_time_order CHECK (start_time < end_time)
);

CREATE INDEX IF NOT EXISTS idx_restaurant_service_periods_scope
  ON public.restaurant_service_periods(restaurant_id, COALESCE(day_of_week, -1));

CREATE TABLE IF NOT EXISTS public.restaurant_capacity_rules (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  service_period_id uuid REFERENCES public.restaurant_service_periods(id) ON DELETE CASCADE,
  day_of_week smallint,
  effective_date date,
  max_covers integer,
  max_parties integer,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT restaurant_capacity_rules_non_negative CHECK (
    (max_covers IS NULL OR max_covers >= 0) AND (max_parties IS NULL OR max_parties >= 0)
  ),
  CONSTRAINT restaurant_capacity_rules_scope
    CHECK (service_period_id IS NOT NULL OR day_of_week IS NOT NULL OR effective_date IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_restaurant_capacity_rules_scope
  ON public.restaurant_capacity_rules(
    restaurant_id,
    COALESCE(day_of_week, -1),
    effective_date
  );

-- Updated_at triggers
CREATE TRIGGER restaurant_operating_hours_updated_at
  BEFORE UPDATE ON public.restaurant_operating_hours
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER restaurant_service_periods_updated_at
  BEFORE UPDATE ON public.restaurant_service_periods
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER restaurant_capacity_rules_updated_at
  BEFORE UPDATE ON public.restaurant_capacity_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- Enable RLS on new tables
ALTER TABLE public.restaurant_operating_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_service_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_capacity_rules ENABLE ROW LEVEL SECURITY;

-- Service role policies
CREATE POLICY "Service role can manage operating hours"
  ON public.restaurant_operating_hours
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Service role can manage service periods"
  ON public.restaurant_service_periods
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Service role can manage capacity rules"
  ON public.restaurant_capacity_rules
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Staff policies scoped to their restaurants
CREATE POLICY "Staff can manage operating hours"
  ON public.restaurant_operating_hours
  USING (restaurant_id IN (SELECT public.user_restaurants()))
  WITH CHECK (restaurant_id IN (SELECT public.user_restaurants()));

CREATE POLICY "Staff can manage service periods"
  ON public.restaurant_service_periods
  USING (restaurant_id IN (SELECT public.user_restaurants()))
  WITH CHECK (restaurant_id IN (SELECT public.user_restaurants()));

CREATE POLICY "Staff can manage capacity rules"
  ON public.restaurant_capacity_rules
  USING (restaurant_id IN (SELECT public.user_restaurants()))
  WITH CHECK (restaurant_id IN (SELECT public.user_restaurants()));

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.restaurant_operating_hours TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.restaurant_operating_hours TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.restaurant_service_periods TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.restaurant_service_periods TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.restaurant_capacity_rules TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.restaurant_capacity_rules TO service_role;
