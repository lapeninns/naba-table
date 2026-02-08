-- Migration: Lock down access to table_soft_holds
-- Issue: Soft-holds table was readable/writable by authenticated users, exposing session tokens
-- Fix: Remove direct table privileges/policies; rely on SECURITY DEFINER RPCs only

BEGIN;

-- Remove direct table access for client roles
REVOKE ALL ON TABLE public.table_soft_holds FROM authenticated;
REVOKE ALL ON TABLE public.table_soft_holds FROM anon;

-- Ensure service role retains access
GRANT ALL ON TABLE public.table_soft_holds TO service_role;

-- Remove overly-permissive authenticated policies
DROP POLICY IF EXISTS "Users can view soft holds" ON public.table_soft_holds;
DROP POLICY IF EXISTS "Users can insert soft holds" ON public.table_soft_holds;
DROP POLICY IF EXISTS "Users can delete their own soft holds" ON public.table_soft_holds;

-- Keep RLS enabled; no authenticated policies means no direct access
ALTER TABLE public.table_soft_holds ENABLE ROW LEVEL SECURITY;

-- Ensure the RPCs remain SECURITY DEFINER and scoped to public schema
ALTER FUNCTION public.acquire_soft_holds_atomic(uuid[], tstzrange, uuid, uuid, uuid, integer) SECURITY DEFINER;
ALTER FUNCTION public.acquire_soft_holds_atomic(uuid[], tstzrange, uuid, uuid, uuid, integer) SET search_path = public;

ALTER FUNCTION public.release_soft_holds(uuid, uuid[]) SECURITY DEFINER;
ALTER FUNCTION public.release_soft_holds(uuid, uuid[]) SET search_path = public;

ALTER FUNCTION public.check_soft_hold_ownership(uuid, uuid[], tstzrange) SECURITY DEFINER;
ALTER FUNCTION public.check_soft_hold_ownership(uuid, uuid[], tstzrange) SET search_path = public;

COMMIT;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
