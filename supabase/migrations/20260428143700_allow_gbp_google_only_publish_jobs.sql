BEGIN;

ALTER TABLE public.restaurant_external_profile_publish_jobs
  DROP CONSTRAINT IF EXISTS restaurant_external_profile_publish_jobs_mode_check;

ALTER TABLE public.restaurant_external_profile_publish_jobs
  ADD CONSTRAINT restaurant_external_profile_publish_jobs_mode_check
  CHECK (mode IN ('nabatable_only', 'nabatable_and_google', 'google_only'));

COMMENT ON CONSTRAINT restaurant_external_profile_publish_jobs_mode_check
ON public.restaurant_external_profile_publish_jobs IS
  'Allows reviewed GBP publishes to apply Google-to-Nabatable, Google-to-Nabatable plus Google sync, or Google-only write-back jobs.';

COMMIT;
