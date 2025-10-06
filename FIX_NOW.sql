-- IMMEDIATE FIX: Run this SQL in Supabase SQL Editor
-- URL: https://supabase.com/dashboard/project/mqtchcaavsucsdjskptc/sql

-- ============================================================================
-- STEP 1: Drop ALL existing SELECT policies to avoid conflicts
-- ============================================================================
DROP POLICY IF EXISTS "Users can view their restaurants" ON public.restaurants;
DROP POLICY IF EXISTS "Anyone can view restaurants" ON public.restaurants;
DROP POLICY IF EXISTS "Authenticated users can view all restaurants" ON public.restaurants;
DROP POLICY IF EXISTS "Anonymous users can view all restaurants" ON public.restaurants;
DROP POLICY IF EXISTS "Service role can view all restaurants" ON public.restaurants;

-- ============================================================================
-- STEP 2: Create explicit policies for each role
-- ============================================================================
-- For authenticated users
CREATE POLICY "Authenticated users can view all restaurants"
  ON public.restaurants FOR SELECT
  TO authenticated
  USING (true);

-- For anonymous users (not logged in)
CREATE POLICY "Anonymous users can view all restaurants"
  ON public.restaurants FOR SELECT
  TO anon
  USING (true);

-- For service role (server-side operations)
CREATE POLICY "Service role can view all restaurants"
  ON public.restaurants FOR SELECT
  TO service_role
  USING (true);

-- ============================================================================
-- STEP 3: Verify the policies were created
-- ============================================================================
SELECT 
  policyname,
  roles::text[] as roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'restaurants' AND cmd = 'SELECT'
ORDER BY policyname;

-- ============================================================================
-- STEP 4: Test the fix with different roles
-- ============================================================================
-- This should work now:
SELECT id, name, slug, timezone, capacity
FROM public.restaurants
ORDER BY name
LIMIT 5;
