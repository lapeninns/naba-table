-- Fix table_holds and table_hold_members RLS permissions
-- The tenant-scoped policies require X-Restaurant-Id header propagation through PostgREST,
-- which doesn't work with direct service_role connections. This migration adds permissive
-- policies for service_role that don't require tenant context, while keeping tenant-scoped
-- policies for authenticated users.
--
-- Background: The 20251107094000_tenant_rls_foundation.sql migration dropped the permissive
-- "Service role can manage holds" policy and replaced it with a restrictive tenant-scoped
-- policy. This caused "permission denied for table table_holds" errors (42501) when the
-- tenant context wasn't properly set.

-- +goose Up

-- ============================================================================
-- 1. Fix table_holds policies
-- ============================================================================

-- Drop the restrictive tenant-scoped policy for service_role
DROP POLICY IF EXISTS "Tenant service role can manage holds" ON public.table_holds;
DROP POLICY IF EXISTS "Service role can manage table holds" ON public.table_holds;

-- Create a permissive policy for service_role (no tenant context required)
-- Service role is trusted and should have full access
CREATE POLICY "Service role full access to table_holds"
ON public.table_holds
TO service_role
USING (true)
WITH CHECK (true);

-- Keep the authenticated user policy for staff viewing their restaurant's holds
DROP POLICY IF EXISTS "Staff can view table holds" ON public.table_holds;
CREATE POLICY "Staff can view table holds"
ON public.table_holds
FOR SELECT
TO authenticated
USING (
  restaurant_id IN (
    SELECT public.user_restaurants() AS user_restaurants
  )
);

-- ============================================================================
-- 2. Fix table_hold_members policies
-- ============================================================================

-- Drop the restrictive tenant-scoped policy for service_role
DROP POLICY IF EXISTS "Tenant service role can manage table hold members" ON public.table_hold_members;
DROP POLICY IF EXISTS "Service role can manage table hold members" ON public.table_hold_members;

-- Create a permissive policy for service_role (no tenant context required)
CREATE POLICY "Service role full access to table_hold_members"
ON public.table_hold_members
TO service_role
USING (true)
WITH CHECK (true);

-- Keep the authenticated user policy for staff viewing their restaurant's hold members
DROP POLICY IF EXISTS "Staff can view table hold members" ON public.table_hold_members;
CREATE POLICY "Staff can view table hold members"
ON public.table_hold_members
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.table_holds h
    WHERE h.id = table_hold_members.hold_id
      AND h.restaurant_id IN (
        SELECT public.user_restaurants() AS user_restaurants
      )
  )
);

-- ============================================================================
-- 3. Ensure grants are in place
-- ============================================================================

-- Ensure service_role has full permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.table_holds TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.table_hold_members TO service_role;

-- Ensure authenticated users can read
GRANT SELECT ON TABLE public.table_holds TO authenticated;
GRANT SELECT ON TABLE public.table_hold_members TO authenticated;

-- ============================================================================
-- 4. Verify RLS is enabled
-- ============================================================================

ALTER TABLE public.table_holds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.table_hold_members ENABLE ROW LEVEL SECURITY;


-- +goose Down

-- Restore tenant-scoped policies
DROP POLICY IF EXISTS "Service role full access to table_holds" ON public.table_holds;
DROP POLICY IF EXISTS "Staff can view table holds" ON public.table_holds;
DROP POLICY IF EXISTS "Service role full access to table_hold_members" ON public.table_hold_members;
DROP POLICY IF EXISTS "Staff can view table hold members" ON public.table_hold_members;

-- Recreate tenant-scoped policies from 20251107094000
CREATE POLICY "Tenant service role can manage holds"
ON public.table_holds
TO service_role
USING (restaurant_id = public.require_restaurant_context())
WITH CHECK (restaurant_id = public.require_restaurant_context());

CREATE POLICY "Staff can view table holds"
ON public.table_holds
FOR SELECT
TO authenticated
USING (
  restaurant_id IN (
    SELECT public.user_restaurants() AS user_restaurants
  )
);

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

CREATE POLICY "Staff can view table hold members"
ON public.table_hold_members
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.table_holds h
    WHERE h.id = table_hold_members.hold_id
      AND h.restaurant_id IN (
        SELECT public.user_restaurants() AS user_restaurants
      )
  )
);
