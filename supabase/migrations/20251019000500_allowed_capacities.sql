-- Migration: Restaurant-specific allowed capacities

BEGIN;

CREATE TABLE IF NOT EXISTS public.allowed_capacities (
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  capacity smallint NOT NULL CHECK (capacity > 0),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT allowed_capacities_pkey PRIMARY KEY (restaurant_id, capacity)
);

CREATE INDEX IF NOT EXISTS allowed_capacities_restaurant_idx
  ON public.allowed_capacities (restaurant_id, capacity);

CREATE OR REPLACE FUNCTION public.allowed_capacities_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := timezone('utc', now());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS allowed_capacities_touch_updated_at ON public.allowed_capacities;
CREATE TRIGGER allowed_capacities_touch_updated_at
  BEFORE UPDATE ON public.allowed_capacities
  FOR EACH ROW
  EXECUTE FUNCTION public.allowed_capacities_set_updated_at();

ALTER TABLE public.allowed_capacities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage allowed capacities"
  ON public.allowed_capacities
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Staff can manage allowed capacities"
  ON public.allowed_capacities
  TO authenticated
  USING (restaurant_id IN (SELECT public.user_restaurants()))
  WITH CHECK (restaurant_id IN (SELECT public.user_restaurants()));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.allowed_capacities TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.allowed_capacities TO authenticated;

INSERT INTO public.allowed_capacities (restaurant_id, capacity)
SELECT r.id, caps.capacity
FROM public.restaurants r
CROSS JOIN LATERAL (VALUES (2), (4), (5), (7)) AS caps(capacity)
ON CONFLICT DO NOTHING;

ALTER TABLE public.table_inventory
  DROP CONSTRAINT IF EXISTS table_inventory_capacity_allowed;

ALTER TABLE public.table_inventory
  ADD CONSTRAINT table_inventory_allowed_capacity_fkey
    FOREIGN KEY (restaurant_id, capacity)
    REFERENCES public.allowed_capacities(restaurant_id, capacity)
    ON UPDATE CASCADE
    ON DELETE RESTRICT;

COMMIT;
