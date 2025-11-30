-- Clear legacy configuration tables now that configuration lives in code/env.
-- Tables are preserved to avoid breaking dependencies in database functions.

BEGIN;

DELETE FROM public.strategic_configs;
DELETE FROM public.feature_flag_overrides;

COMMIT;
