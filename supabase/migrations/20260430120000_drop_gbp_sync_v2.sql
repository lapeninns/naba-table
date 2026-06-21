-- Phase 5 of the unified dual-sync rollout.
--
-- The Google Business Profile Sync V2 engine has been retired in favour of
-- the canonical dual-sync engine (`server/dual-sync/`, tables prefixed with
-- `dual_sync_*`). This migration drops the five additive `gbp_sync_v2_*`
-- tables introduced by `20260428232200_add_gbp_sync_v2.sql`.
--
-- Rollback: re-run the original `20260428232200_add_gbp_sync_v2.sql`. The
-- table contents are not preserved by this drop; if audit history must be
-- archived, snapshot the rows out before applying this migration on staging
-- or production.

BEGIN;

-- Tables are dropped in reverse order of dependency (publish_events ->
-- publish_jobs -> decisions -> drafts -> workflows). `CASCADE` removes any
-- dependent triggers, indexes, and policies that survived the V2 rollout
-- without listing each one explicitly.

DROP TABLE IF EXISTS public.gbp_sync_v2_publish_events CASCADE;
DROP TABLE IF EXISTS public.gbp_sync_v2_publish_jobs CASCADE;
DROP TABLE IF EXISTS public.gbp_sync_v2_decisions CASCADE;
DROP TABLE IF EXISTS public.gbp_sync_v2_drafts CASCADE;
DROP TABLE IF EXISTS public.gbp_sync_v2_workflows CASCADE;

COMMIT;
