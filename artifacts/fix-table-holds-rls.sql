-- ============================================================================
-- FIX: table_holds and table_hold_members RLS permissions
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================================

-- 1. Fix table_holds policies
DROP POLICY IF EXISTS "Tenant service role can manage holds" ON public.table_holds;
DROP POLICY IF EXISTS "Service role can manage table holds" ON public.table_holds;
DROP POLICY IF EXISTS "Service role full access to table_holds" ON public.table_holds;

CREATE POLICY "Service role full access to table_holds"
ON public.table_holds
TO service_role
USING (true)
WITH CHECK (true);

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

-- 2. Fix table_hold_members policies
DROP POLICY IF EXISTS "Tenant service role can manage table hold members" ON public.table_hold_members;
DROP POLICY IF EXISTS "Service role can manage table hold members" ON public.table_hold_members;
DROP POLICY IF EXISTS "Service role full access to table_hold_members" ON public.table_hold_members;

CREATE POLICY "Service role full access to table_hold_members"
ON public.table_hold_members
TO service_role
USING (true)
WITH CHECK (true);

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

-- 3. Ensure grants are in place
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.table_holds TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.table_hold_members TO service_role;
GRANT SELECT ON TABLE public.table_holds TO authenticated;
GRANT SELECT ON TABLE public.table_hold_members TO authenticated;

-- 4. Verify RLS is enabled
ALTER TABLE public.table_holds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.table_hold_members ENABLE ROW LEVEL SECURITY;

-- Done! The permission denied error should now be fixed.
SELECT 'Migration applied successfully!' as status;
