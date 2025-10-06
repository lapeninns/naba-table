-- Migration: Allow public read access to restaurants table
-- This allows the /reserve page to list all restaurants for browsing and booking

-- ============================================================================
-- Drop ALL existing SELECT policies to avoid conflicts
-- ============================================================================
DO $$ 
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' 
          AND tablename = 'restaurants'
          AND cmd = 'SELECT'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.restaurants', pol.policyname);
    END LOOP;
END $$;

-- ============================================================================
-- Create fresh SELECT policies for all roles
-- ============================================================================

-- Service role gets full read access (used by server-side operations)
CREATE POLICY "service_role_read_all"
  ON public.restaurants 
  FOR SELECT
  TO service_role
  USING (true);

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

-- ============================================================================
-- Ensure proper grants
-- ============================================================================
GRANT SELECT ON public.restaurants TO anon;
GRANT SELECT ON public.restaurants TO authenticated;
GRANT ALL ON public.restaurants TO service_role;

-- Keep the existing policies for create/update/delete (from initial schema)
-- Those policies restrict based on restaurant_memberships
