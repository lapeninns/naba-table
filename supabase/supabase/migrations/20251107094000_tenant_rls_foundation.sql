-- Tenant RLS foundation: helper functions + scoped service-role policies

-- Functions ------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.current_restaurant_id() RETURNS uuid
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_raw text;
BEGIN
  v_raw := nullif(current_setting('app.restaurant_id', true), '');
  IF v_raw IS NULL THEN
    v_raw := nullif(current_setting('request.header.x-restaurant-id', true), '');
  END IF;

  IF v_raw IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN v_raw::uuid;
EXCEPTION
  WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'Invalid restaurant context value'
      USING ERRCODE = '22023',
            DETAIL = format('app.restaurant_id=%L', v_raw);
END;
$$;
COMMENT ON FUNCTION public.current_restaurant_id() IS
'Returns the tenant/restaurant scope extracted from app.restaurant_id GUC or the X-Restaurant-Id header.';
CREATE OR REPLACE FUNCTION public.require_restaurant_context() RETURNS uuid
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_restaurant_id uuid;
BEGIN
  v_restaurant_id := public.current_restaurant_id();
  IF v_restaurant_id IS NULL THEN
    RAISE EXCEPTION 'Restaurant context is required' USING ERRCODE = '42501';
  END IF;
  RETURN v_restaurant_id;
END;
$$;
COMMENT ON FUNCTION public.require_restaurant_context() IS
'Raises if no tenant context is present (used by RLS policies).';
CREATE OR REPLACE FUNCTION public.set_restaurant_context(p_restaurant_id uuid) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_restaurant_id IS NULL THEN
    PERFORM set_config('app.restaurant_id', '', false);
    RETURN NULL;
  END IF;
  PERFORM set_config('app.restaurant_id', p_restaurant_id::text, false);
  RETURN p_restaurant_id;
END;
$$;
REVOKE ALL ON FUNCTION public.set_restaurant_context(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_restaurant_context(uuid) TO anon, authenticated, service_role;
COMMENT ON FUNCTION public.set_restaurant_context(uuid) IS
'Allows edge functions / trusted callers to set the tenant context for the current session.';
-- Policies -------------------------------------------------------------------

-- Customers
DROP POLICY IF EXISTS "Service role can manage customers" ON public.customers;
DROP POLICY IF EXISTS "Tenant service role can manage customers" ON public.customers;
CREATE POLICY "Tenant service role can manage customers"
ON public.customers
TO service_role
USING (restaurant_id = public.require_restaurant_context())
WITH CHECK (restaurant_id = public.require_restaurant_context());
-- Bookings
DROP POLICY IF EXISTS "Service role can manage bookings" ON public.bookings;
DROP POLICY IF EXISTS "Tenant service role can manage bookings" ON public.bookings;
CREATE POLICY "Tenant service role can manage bookings"
ON public.bookings
TO service_role
USING (restaurant_id = public.require_restaurant_context())
WITH CHECK (restaurant_id = public.require_restaurant_context());
-- Table holds
DROP POLICY IF EXISTS "Service role can manage holds" ON public.table_holds;
DROP POLICY IF EXISTS "Tenant service role can manage holds" ON public.table_holds;
CREATE POLICY "Tenant service role can manage holds"
ON public.table_holds
TO service_role
USING (restaurant_id = public.require_restaurant_context())
WITH CHECK (restaurant_id = public.require_restaurant_context());
-- Table hold members (join to holds)
DROP POLICY IF EXISTS "Service role can manage table hold members" ON public.table_hold_members;
DROP POLICY IF EXISTS "Tenant service role can manage table hold members" ON public.table_hold_members;
CREATE POLICY "Tenant service role can manage table hold members"
ON public.table_hold_members
TO service_role
USING (
  EXISTS (
    SELECT 1
    FROM public.table_holds h
    WHERE h.id = table_hold_members.hold_id
      AND h.restaurant_id = public.require_restaurant_context()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.table_holds h
    WHERE h.id = table_hold_members.hold_id
      AND h.restaurant_id = public.require_restaurant_context()
  )
);
-- Booking table assignments (join to bookings)
DROP POLICY IF EXISTS "Service role can manage table assignments" ON public.booking_table_assignments;
DROP POLICY IF EXISTS "Tenant service role can manage table assignments" ON public.booking_table_assignments;
CREATE POLICY "Tenant service role can manage table assignments"
ON public.booking_table_assignments
TO service_role
USING (
  EXISTS (
    SELECT 1
    FROM public.bookings b
    WHERE b.id = booking_table_assignments.booking_id
      AND b.restaurant_id = public.require_restaurant_context()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.bookings b
    WHERE b.id = booking_table_assignments.booking_id
      AND b.restaurant_id = public.require_restaurant_context()
  )
);
-- Allocations
DROP POLICY IF EXISTS "Service role can manage allocations" ON public.allocations;
DROP POLICY IF EXISTS "Tenant service role can manage allocations" ON public.allocations;
CREATE POLICY "Tenant service role can manage allocations"
ON public.allocations
TO service_role
USING (restaurant_id = public.require_restaurant_context())
WITH CHECK (restaurant_id = public.require_restaurant_context());
-- Capacity outbox (ensure table protected & RLS on)
ALTER TABLE public.capacity_outbox ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role can manage capacity outbox" ON public.capacity_outbox;
DROP POLICY IF EXISTS "Tenant service role can manage capacity outbox" ON public.capacity_outbox;
CREATE POLICY "Tenant service role can manage capacity outbox"
ON public.capacity_outbox
TO service_role
USING (restaurant_id = public.require_restaurant_context())
WITH CHECK (restaurant_id = public.require_restaurant_context());
