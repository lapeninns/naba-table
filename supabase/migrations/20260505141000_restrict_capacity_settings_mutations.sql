-- Sprint 2 tenant authorization hardening.
-- Restrictive policies narrow authenticated direct writes even when older broad
-- staff policies remain present. Backend routes still perform their own
-- route-level authorization before privileged helper calls.

CREATE OR REPLACE FUNCTION public.user_restaurants_with_roles(allowed_roles text[])
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT rm.restaurant_id
  FROM public.restaurant_memberships rm
  WHERE rm.user_id = auth.uid()
    AND rm.role = ANY (allowed_roles);
$$;

REVOKE ALL ON FUNCTION public.user_restaurants_with_roles(text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_restaurants_with_roles(text[]) TO authenticated;

ALTER TABLE public.table_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_turn_bands ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owner manager can insert table inventory" ON public.table_inventory;
CREATE POLICY "Owner manager can insert table inventory"
  ON public.table_inventory
  AS RESTRICTIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (
    restaurant_id IN (
      SELECT public.user_restaurants_with_roles(ARRAY['owner', 'manager'])
    )
  );

DROP POLICY IF EXISTS "Owner manager can update table inventory" ON public.table_inventory;
CREATE POLICY "Owner manager can update table inventory"
  ON public.table_inventory
  AS RESTRICTIVE
  FOR UPDATE
  TO authenticated
  USING (
    restaurant_id IN (
      SELECT public.user_restaurants_with_roles(ARRAY['owner', 'manager'])
    )
  )
  WITH CHECK (
    restaurant_id IN (
      SELECT public.user_restaurants_with_roles(ARRAY['owner', 'manager'])
    )
  );

DROP POLICY IF EXISTS "Owner manager can delete table inventory" ON public.table_inventory;
CREATE POLICY "Owner manager can delete table inventory"
  ON public.table_inventory
  AS RESTRICTIVE
  FOR DELETE
  TO authenticated
  USING (
    restaurant_id IN (
      SELECT public.user_restaurants_with_roles(ARRAY['owner', 'manager'])
    )
  );

DROP POLICY IF EXISTS "Owner manager can insert zones" ON public.zones;
CREATE POLICY "Owner manager can insert zones"
  ON public.zones
  AS RESTRICTIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (
    restaurant_id IN (
      SELECT public.user_restaurants_with_roles(ARRAY['owner', 'manager'])
    )
  );

DROP POLICY IF EXISTS "Owner manager can update zones" ON public.zones;
CREATE POLICY "Owner manager can update zones"
  ON public.zones
  AS RESTRICTIVE
  FOR UPDATE
  TO authenticated
  USING (
    restaurant_id IN (
      SELECT public.user_restaurants_with_roles(ARRAY['owner', 'manager'])
    )
  )
  WITH CHECK (
    restaurant_id IN (
      SELECT public.user_restaurants_with_roles(ARRAY['owner', 'manager'])
    )
  );

DROP POLICY IF EXISTS "Owner manager can delete zones" ON public.zones;
CREATE POLICY "Owner manager can delete zones"
  ON public.zones
  AS RESTRICTIVE
  FOR DELETE
  TO authenticated
  USING (
    restaurant_id IN (
      SELECT public.user_restaurants_with_roles(ARRAY['owner', 'manager'])
    )
  );

DROP POLICY IF EXISTS "Owner manager can insert turn bands" ON public.restaurant_turn_bands;
CREATE POLICY "Owner manager can insert turn bands"
  ON public.restaurant_turn_bands
  AS RESTRICTIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (
    restaurant_id IN (
      SELECT public.user_restaurants_with_roles(ARRAY['owner', 'manager'])
    )
  );

DROP POLICY IF EXISTS "Owner manager can update turn bands" ON public.restaurant_turn_bands;
CREATE POLICY "Owner manager can update turn bands"
  ON public.restaurant_turn_bands
  AS RESTRICTIVE
  FOR UPDATE
  TO authenticated
  USING (
    restaurant_id IN (
      SELECT public.user_restaurants_with_roles(ARRAY['owner', 'manager'])
    )
  )
  WITH CHECK (
    restaurant_id IN (
      SELECT public.user_restaurants_with_roles(ARRAY['owner', 'manager'])
    )
  );

DROP POLICY IF EXISTS "Owner manager can delete turn bands" ON public.restaurant_turn_bands;
CREATE POLICY "Owner manager can delete turn bands"
  ON public.restaurant_turn_bands
  AS RESTRICTIVE
  FOR DELETE
  TO authenticated
  USING (
    restaurant_id IN (
      SELECT public.user_restaurants_with_roles(ARRAY['owner', 'manager'])
    )
  );
