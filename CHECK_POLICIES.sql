-- ============================================================================
-- DIAGNOSTIC: Check current RLS policies on restaurants table
-- ============================================================================
-- Run this in Supabase SQL Editor to see what policies exist

SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'restaurants'
ORDER BY policyname;

-- ============================================================================
-- Expected output should show:
-- - "Anyone can view restaurants" with cmd='SELECT' and qual='true'
-- - Other policies for INSERT, UPDATE, DELETE
-- ============================================================================
