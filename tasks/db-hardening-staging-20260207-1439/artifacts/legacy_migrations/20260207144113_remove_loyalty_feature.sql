-- Remove loyalty feature fully. Product confirmed loyalty is permanently deprecated.
-- Staging-first: apply on staging, verify, then follow up with a production rollout task.

SET statement_timeout = '120s';
SET lock_timeout = '5s';

-- Defense-in-depth (if this migration is partially applied / retried).
REVOKE ALL ON TABLE public.loyalty_point_events FROM anon, authenticated;
REVOKE ALL ON TABLE public.loyalty_points FROM anon, authenticated;
REVOKE ALL ON TABLE public.loyalty_programs FROM anon, authenticated;

-- Drop tables (also drops their indexes, policies, triggers, and composite types).
DROP TABLE IF EXISTS public.loyalty_point_events CASCADE;
DROP TABLE IF EXISTS public.loyalty_points CASCADE;
DROP TABLE IF EXISTS public.loyalty_programs CASCADE;

-- Drop enum type once tables are gone.
DROP TYPE IF EXISTS public.loyalty_tier CASCADE;
