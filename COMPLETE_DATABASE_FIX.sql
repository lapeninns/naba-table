-- ============================================================================
-- COMPLETE DATABASE FIX FOR RESTAURANT LISTING
-- Run this in Supabase SQL Editor
-- URL: https://supabase.com/dashboard/project/mqtchcaavsucsdjskptc/sql
-- ============================================================================

-- ============================================================================
-- STEP 1: Drop ALL existing policies on restaurants table to start fresh
-- ============================================================================
DO $$ 
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' AND tablename = 'restaurants'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.restaurants', pol.policyname);
    END LOOP;
END $$;

-- ============================================================================
-- STEP 2: Create fresh policies for ALL roles with proper permissions
-- ============================================================================

-- Service role gets full access (this is what your server uses)
CREATE POLICY "service_role_all_access"
  ON public.restaurants
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Anonymous users can view all restaurants (public browsing)
CREATE POLICY "anon_read_all"
  ON public.restaurants
  FOR SELECT
  TO anon
  USING (true);

-- Authenticated users can view all restaurants
CREATE POLICY "authenticated_read_all"
  ON public.restaurants
  FOR SELECT
  TO authenticated
  USING (true);

-- Authenticated users can create restaurants (then they become owner via trigger)
CREATE POLICY "authenticated_can_create"
  ON public.restaurants
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- Owners and admins can update their restaurants
CREATE POLICY "owners_admins_can_update"
  ON public.restaurants
  FOR UPDATE
  TO authenticated
  USING (
    id IN (
      SELECT restaurant_id 
      FROM public.restaurant_memberships
      WHERE user_id = auth.uid() 
        AND role IN ('owner', 'admin')
    )
  );

-- Only owners can delete restaurants
CREATE POLICY "owners_can_delete"
  ON public.restaurants
  FOR DELETE
  TO authenticated
  USING (
    id IN (
      SELECT restaurant_id 
      FROM public.restaurant_memberships
      WHERE user_id = auth.uid() 
        AND role = 'owner'
    )
  );

-- ============================================================================
-- STEP 3: Ensure proper grants are in place
-- ============================================================================
GRANT SELECT ON public.restaurants TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.restaurants TO authenticated;
GRANT ALL ON public.restaurants TO service_role;

-- ============================================================================
-- STEP 4: Verify the setup
-- ============================================================================
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles::text[],
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'restaurants'
ORDER BY 
  CASE cmd 
    WHEN 'ALL' THEN 1
    WHEN 'SELECT' THEN 2
    WHEN 'INSERT' THEN 3
    WHEN 'UPDATE' THEN 4
    WHEN 'DELETE' THEN 5
  END,
  policyname;

-- ============================================================================
-- STEP 5: Test queries
-- ============================================================================

-- Test as service_role (what your app uses)
SELECT 'Testing as service_role' as test;
SELECT id, name, slug, timezone FROM public.restaurants LIMIT 3;

-- Check if there are any restaurants
SELECT 
  'Total restaurants: ' || count(*)::text as info
FROM public.restaurants;

-- If no restaurants exist, you need to insert seed data
-- Uncomment below if you need sample data:
/*
INSERT INTO public.restaurants (name, slug, timezone, capacity) VALUES
  ('Sample Restaurant', 'sample-restaurant', 'America/New_York', 50),
  ('Test Venue', 'test-venue', 'Europe/London', 100),
  ('Demo Eatery', 'demo-eatery', 'Asia/Tokyo', 75)
ON CONFLICT (slug) DO NOTHING;
*/

-- ============================================================================
-- STEP 6: Check RLS is still enabled (should be true)
-- ============================================================================
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public' AND tablename = 'restaurants';
