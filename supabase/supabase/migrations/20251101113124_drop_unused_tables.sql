-- Drop legacy tables and views that are no longer referenced by the application.
-- Targets:
--   • public.capacity_selector_rejections_v1 (materialized view)
--   • public.strategic_simulation_runs (analysis table)
--   • public.stripe_events (old webhook ingestion staging table)
-- Each drop uses IF EXISTS and CASCADE to remove dependent indexes/policies.

BEGIN;
DROP MATERIALIZED VIEW IF EXISTS public.capacity_selector_rejections_v1 CASCADE;
DROP TABLE IF EXISTS public.strategic_simulation_runs CASCADE;
DROP TABLE IF EXISTS public.stripe_events CASCADE;
COMMIT;
