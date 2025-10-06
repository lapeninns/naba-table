-- Create loyalty system tables (optional feature)

-- Create tier enum for loyalty tiers
CREATE TYPE loyalty_tier AS ENUM ('bronze', 'silver', 'gold', 'platinum');

-- Loyalty programs per restaurant
CREATE TABLE IF NOT EXISTS public.loyalty_programs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id uuid NOT NULL UNIQUE REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  accrual_rule jsonb NOT NULL DEFAULT '{"type": "per_guest", "base_points": 10, "points_per_guest": 5, "minimum_party_size": 1}'::jsonb,
  tier_definitions jsonb NOT NULL DEFAULT '[{"tier": "bronze", "min_points": 0}]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Loyalty points per customer
CREATE TABLE IF NOT EXISTS public.loyalty_points (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  total_points integer NOT NULL DEFAULT 0,
  tier loyalty_tier NOT NULL DEFAULT 'bronze',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(restaurant_id, customer_id)
);

-- Loyalty point events (history of points earned/redeemed)
CREATE TABLE IF NOT EXISTS public.loyalty_point_events (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  booking_id uuid NULL REFERENCES public.bookings(id) ON DELETE SET NULL,
  points_change integer NOT NULL,
  event_type text NOT NULL,
  schema_version integer NOT NULL DEFAULT 1,
  metadata jsonb NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.loyalty_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_point_events ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Service role can manage loyalty programs"
  ON public.loyalty_programs FOR ALL
  USING (true) WITH CHECK (true);

CREATE POLICY "Service role can manage loyalty points"
  ON public.loyalty_points FOR ALL
  USING (true) WITH CHECK (true);

CREATE POLICY "Service role can manage loyalty events"
  ON public.loyalty_point_events FOR ALL
  USING (true) WITH CHECK (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_loyalty_programs_restaurant 
ON public.loyalty_programs(restaurant_id);

CREATE INDEX IF NOT EXISTS idx_loyalty_points_restaurant_customer 
ON public.loyalty_points(restaurant_id, customer_id);

CREATE INDEX IF NOT EXISTS idx_loyalty_point_events_customer 
ON public.loyalty_point_events(customer_id);

CREATE INDEX IF NOT EXISTS idx_loyalty_point_events_booking 
ON public.loyalty_point_events(booking_id)
WHERE booking_id IS NOT NULL;

-- Triggers
CREATE TRIGGER update_loyalty_programs_updated_at
  BEFORE UPDATE ON public.loyalty_programs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_loyalty_points_updated_at
  BEFORE UPDATE ON public.loyalty_points
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();
