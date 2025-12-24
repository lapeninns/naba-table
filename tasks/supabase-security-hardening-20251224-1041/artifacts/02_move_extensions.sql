-- ============================================================================
-- Migration: Move Extensions from Public to Extensions Schema
-- ============================================================================
-- 
-- This migration addresses the "extension_in_public" security warning by
-- moving extensions from the public schema to a dedicated extensions schema.
--
-- WHY THIS MATTERS:
-- Extensions in the public schema can be a security concern because:
-- 1. The public schema is accessible by default to all roles
-- 2. Extension objects could be overwritten by malicious actors
-- 3. Better practice to isolate extensions in a dedicated schema
--
-- AFFECTED EXTENSIONS:
-- - btree_gist
-- - citext
-- - pgcrypto
--
-- IMPORTANT:
-- Moving extensions requires DROP and re-CREATE. Dependent objects will need
-- to reference the new schema. Test thoroughly in staging first!
--
-- EXECUTION:
-- Run this script in Supabase SQL Editor (staging first, then production)
-- ============================================================================

-- Begin transaction for atomicity
BEGIN;

-- ============================================================================
-- Step 1: Create the extensions schema if it doesn't exist
-- ============================================================================
CREATE SCHEMA IF NOT EXISTS extensions;

-- Grant usage to necessary roles
GRANT USAGE ON SCHEMA extensions TO postgres, anon, authenticated, service_role;

-- ============================================================================
-- Step 2: Move extensions
-- Note: PostgreSQL doesn't support ALTER EXTENSION SET SCHEMA for all extensions
-- We use a workaround by dropping and recreating
-- ============================================================================

-- Save dependent objects info for later validation
-- (This is informational - run as a separate query to see dependencies)
/*
SELECT 
    e.extname,
    d.objid::regclass AS dependent_object
FROM pg_extension e
JOIN pg_depend d ON d.refobjid = e.oid
WHERE e.extname IN ('btree_gist', 'citext', 'pgcrypto')
  AND d.deptype = 'e';
*/

-- 2.1 Move citext extension
-- citext doesn't have complex dependencies typically
DROP EXTENSION IF EXISTS citext CASCADE;
CREATE EXTENSION IF NOT EXISTS citext WITH SCHEMA extensions;

-- Grant usage on citext types
GRANT ALL ON ALL FUNCTIONS IN SCHEMA extensions TO postgres, anon, authenticated, service_role;

-- 2.2 Move pgcrypto extension
DROP EXTENSION IF EXISTS pgcrypto CASCADE;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- 2.3 Move btree_gist extension
-- Note: btree_gist may have dependent indexes - check first!
DROP EXTENSION IF EXISTS btree_gist CASCADE;
CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA extensions;

-- ============================================================================
-- Step 3: Update search_path to include extensions schema
-- This ensures functions can find extension objects
-- ============================================================================

-- Update database search_path to include extensions schema
ALTER DATABASE postgres SET search_path = public, extensions;

-- Commit the transaction
COMMIT;

-- ============================================================================
-- Post-Migration: Add extensions schema to user search paths
-- Run this after the migration to ensure all roles can access extensions
-- ============================================================================

-- Set search_path for roles (run separately if needed)
-- ALTER ROLE anon SET search_path = public, extensions;
-- ALTER ROLE authenticated SET search_path = public, extensions;
-- ALTER ROLE service_role SET search_path = public, extensions;

-- ============================================================================
-- Verification Query
-- After running the migration, execute this to verify extensions are moved:
-- ============================================================================
/*
SELECT 
    e.extname AS extension_name,
    n.nspname AS schema_name
FROM pg_extension e
JOIN pg_namespace n ON e.extnamespace = n.oid
WHERE e.extname IN ('btree_gist', 'citext', 'pgcrypto')
ORDER BY e.extname;
*/

-- ============================================================================
-- ROLLBACK SCRIPT (if needed)
-- ============================================================================
/*
BEGIN;

-- Move extensions back to public
DROP EXTENSION IF EXISTS citext CASCADE;
CREATE EXTENSION citext WITH SCHEMA public;

DROP EXTENSION IF EXISTS pgcrypto CASCADE;
CREATE EXTENSION pgcrypto WITH SCHEMA public;

DROP EXTENSION IF EXISTS btree_gist CASCADE;
CREATE EXTENSION btree_gist WITH SCHEMA public;

-- Reset search_path
ALTER DATABASE postgres SET search_path = public;

COMMIT;
*/
