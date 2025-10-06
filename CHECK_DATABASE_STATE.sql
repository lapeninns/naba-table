-- ============================================================================
-- DIAGNOSTIC SCRIPT - Run this to check your database state
-- ============================================================================

-- Check if RLS is enabled on restaurants
SELECT 
  '=== RLS Status ===' as section,
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public' AND tablename = 'restaurants';

-- List all policies on restaurants table
SELECT 
  '=== Current Policies ===' as section,
  policyname,
  roles::text[] as applies_to_roles,
  cmd as operation,
  permissive,
  qual as using_expression,
  with_check as with_check_expression
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'restaurants'
ORDER BY cmd, policyname;

-- Check grants on restaurants table
SELECT 
  '=== Table Grants ===' as section,
  grantee as role,
  privilege_type
FROM information_schema.table_privileges
WHERE table_schema = 'public' 
  AND table_name = 'restaurants'
ORDER BY grantee, privilege_type;

-- Count restaurants in the database
SELECT 
  '=== Restaurant Count ===' as section,
  count(*) as total_restaurants
FROM public.restaurants;

-- List restaurants (if any)
SELECT 
  '=== Restaurant List ===' as section,
  id,
  name,
  slug,
  timezone,
  capacity,
  created_at
FROM public.restaurants
ORDER BY created_at DESC
LIMIT 10;

-- Check if the user_restaurants() function exists
SELECT 
  '=== Helper Functions ===' as section,
  routine_name as function_name,
  routine_type as type,
  data_type as returns
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'user_restaurants';
