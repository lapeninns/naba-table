BEGIN;

CREATE OR REPLACE FUNCTION public.user_restaurants_admin()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT restaurant_id
  FROM public.restaurant_memberships
  WHERE user_id = auth.uid()
    AND role = ANY (ARRAY['owner'::text, 'manager'::text]);
$$;

ALTER FUNCTION public.user_restaurants_admin() OWNER TO postgres;

GRANT EXECUTE ON FUNCTION public.user_restaurants_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_restaurants_admin() TO service_role;

DROP POLICY IF EXISTS "Owners and admins can manage memberships" ON public.restaurant_memberships;

CREATE POLICY "Owners and admins can manage memberships" ON public.restaurant_memberships
USING (
  restaurant_id IN (SELECT public.user_restaurants_admin())
)
WITH CHECK (
  restaurant_id IN (SELECT public.user_restaurants_admin())
);

COMMIT;
