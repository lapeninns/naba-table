-- Create customer_profiles table to track booking and marketing aggregates per customer

CREATE TABLE IF NOT EXISTS public.customer_profiles (
  customer_id uuid PRIMARY KEY REFERENCES public.customers(id) ON DELETE CASCADE,
  first_booking_at timestamptz,
  last_booking_at timestamptz,
  total_bookings integer NOT NULL DEFAULT 0 CHECK (total_bookings >= 0),
  total_covers integer NOT NULL DEFAULT 0 CHECK (total_covers >= 0),
  total_cancellations integer NOT NULL DEFAULT 0 CHECK (total_cancellations >= 0),
  marketing_opt_in boolean NOT NULL DEFAULT false,
  last_marketing_opt_in_at timestamptz,
  last_waitlist_at timestamptz,
  preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_profiles TO service_role;

ALTER TABLE public.customer_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can manage customer profiles" ON public.customer_profiles;
CREATE POLICY "Service role can manage customer profiles"
  ON public.customer_profiles
  FOR ALL
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Staff can view customer profiles" ON public.customer_profiles;
CREATE POLICY "Staff can view customer profiles"
  ON public.customer_profiles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.customers c
      WHERE c.id = customer_profiles.customer_id
        AND c.restaurant_id IN (SELECT public.user_restaurants())
    )
  );

-- Keep aggregates fast when joining customers
CREATE INDEX IF NOT EXISTS idx_customer_profiles_updated_at
  ON public.customer_profiles(updated_at DESC);
